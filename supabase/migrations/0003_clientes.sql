-- ============================================================================
-- StyloApp · 0003_clientes (Fase 5, oleada 3)
-- La app de clientes: reseñas, seguidores y promociones; las calificaciones del negocio y de
-- cada profesional; reservar, cancelar y cambiar la hora como cliente, y los contadores del
-- inicio con seguidores y calificación.
-- Fuente: TECH-SPEC-styloapp.md §4.2 y el Blueprint (T-5.1.1 y T-5.1.2). No se edita
-- después de su commit (invariante 6): los arreglos van en una migración nueva.
-- ============================================================================

-- ============================================
-- Tablas
-- ============================================
-- Una reseña por cita. business_id, staff_id y author_id los pone reviews_fill desde la cita y
-- la sesión; el navegador solo manda la cita, las dos calificaciones y el comentario.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  attention smallint not null check (attention between 1 and 5),  -- atención y trato
  quality smallint not null check (quality between 1 and 5),      -- resultado del servicio
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index idx_reviews_business on public.reviews (business_id, created_at desc);
create index idx_reviews_staff on public.reviews (staff_id);
create index idx_reviews_author on public.reviews (author_id, created_at desc);

create table public.follows (
  profile_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, business_id)
);
create index idx_follows_business on public.follows (business_id);

-- Ofertas de la app de clientes: en el MVP solo las trae la semilla (se gestionan en la oleada 6).
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('promo', 'combo')),
  name text not null check (char_length(name) between 2 and 60),
  description text check (char_length(description) <= 300),
  price int not null check (price >= 0),
  discount_pct int check (discount_pct between 1 and 90),
  ends_on date,                                               -- null = indefinida
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_promotions_business on public.promotions (business_id);

-- ============================================
-- Calificaciones: promedio de las dos notas de cada reseña. Las reseñas las lee cualquiera, así
-- que las vistas responden igual con o sin cuenta.
-- ============================================
create view public.business_rating with (security_invoker = true) as
select business_id,
       round(avg((attention + quality) / 2.0), 1) as score,
       round(avg(attention), 1) as attention,
       round(avg(quality), 1) as quality,
       count(*) as reviews
from public.reviews group by business_id;

create view public.staff_rating with (security_invoker = true) as
select staff_id, round(avg((attention + quality) / 2.0), 1) as score, count(*) as reviews
from public.reviews group by staff_id;

-- ============================================
-- Funciones de lectura
-- ============================================
-- Los números de cada negocio para Explorar y su página (US-024 y US-026): seguidores,
-- agendamientos (sin las canceladas), calificación y si quien pregunta lo sigue. Los seguidores y
-- las citas no se leen directo (cada quien ve solo los suyos), por eso es security definer y
-- devuelve solo conteos. Solo negocios listados, o el propio del equipo.
create function public.business_stats(p_business uuid default null)
returns table (business_id uuid, followers bigint, bookings bigint, score numeric, reviews bigint,
               following boolean)
language sql stable security definer set search_path = '' as $$
  select b.id,
         (select count(*) from public.follows f where f.business_id = b.id),
         (select count(*) from public.bookings k where k.business_id = b.id and k.status <> 'cancelled'),
         (select round(avg((r.attention + r.quality) / 2.0), 1) from public.reviews r
          where r.business_id = b.id),
         (select count(*) from public.reviews r where r.business_id = b.id),
         exists (select 1 from public.follows f where f.business_id = b.id and f.profile_id = auth.uid())
  from public.businesses b
  where (p_business is null or b.id = p_business)
    and (b.is_listed or public.is_staff_of(b.id));
$$;
revoke execute on function public.business_stats(uuid) from public;
grant execute on function public.business_stats(uuid) to anon, authenticated;

-- Contadores del inicio, v3: seguidores del negocio, y la calificación del negocio para el dueño
-- y la suya para el profesional (como los agendamientos). Facturas, en la oleada 4.
create or replace function public.home_counters(p_business uuid)
returns table (followers bigint, bookings bigint, rating numeric, reviews bigint, invoices bigint)
language sql stable security definer set search_path = '' as $$
  with me as (
    select public.is_owner_of(p_business) as is_owner, public.my_staff_id(p_business) as staff_id
  ),
  mine as (
    select r.attention, r.quality from public.reviews r, me
    where r.business_id = p_business and (me.is_owner or r.staff_id = me.staff_id)
  )
  select (select count(*) from public.follows f where f.business_id = p_business),
         (select count(*) from public.bookings b
          where b.business_id = p_business and b.status <> 'cancelled'
            and (me.is_owner or b.staff_id = me.staff_id)),
         (select round(avg((mine.attention + mine.quality) / 2.0), 1) from mine),
         (select count(*) from mine),
         0::bigint
  from me
  where public.is_staff_of(p_business);
$$;

-- ============================================
-- Reservar como cliente (US-027 y US-029)
-- Errores (en message): NO_SESSION, NOT_FOUND, ONLINE_BOOKING_OFF, CLIENT_BLOCKED,
-- OUT_OF_HOURS, TOO_LATE y BOOKING_LOCKED; el cruce con otra cita o un bloqueo sigue saliendo
-- como 23P01 (la exclusión y bookings_guard). Ni el fin ni el precio vienen del navegador.
-- ============================================

-- Lo que dura y cuesta un servicio con un profesional: su duración y precio propios o los del
-- servicio. Sin filas si el servicio está archivado, si el profesional no está activo o no lo
-- hace, o si el negocio no sale en Explorar.
create function public.client_service_terms(p_service uuid, p_staff uuid)
returns table (business_id uuid, minutes int, price int)
language sql stable security definer set search_path = '' as $$
  select sv.business_id, coalesce(ss.duration_minutes, sv.duration_minutes), coalesce(ss.price, sv.price)
  from public.services sv
  join public.staff_services ss on ss.service_id = sv.id and ss.staff_id = p_staff
  join public.staff s on s.id = ss.staff_id and s.business_id = sv.business_id and s.is_active
  join public.businesses b on b.id = sv.business_id and b.is_listed
  where sv.id = p_service and sv.is_active;
$$;
revoke execute on function public.client_service_terms(uuid, uuid) from public, anon, authenticated;

-- Las reglas de la reserva en línea para quien llama: el negocio la recibe, el cliente no está
-- bloqueado ahí, la hora respeta la antelación mínima y los días máximos, y la cita entera cabe
-- en el horario del profesional y del negocio ese día (en hora de Bogotá).
create function public.client_booking_rules(
  p_business uuid, p_staff uuid, p_starts_at timestamptz, p_ends_at timestamptz
) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_online boolean;
  v_notice int;
  v_advance int;
  v_day date := (p_starts_at at time zone 'America/Bogota')::date;
  v_from time := (p_starts_at at time zone 'America/Bogota')::time;
  v_to time := (p_ends_at at time zone 'America/Bogota')::time;
begin
  select b.online_booking, b.min_notice_minutes, b.max_advance_days
    into v_online, v_notice, v_advance
  from public.businesses b where b.id = p_business;
  if not v_online then
    raise exception 'ONLINE_BOOKING_OFF' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.clients c
             where c.business_id = p_business and c.profile_id = auth.uid() and c.is_blocked) then
    raise exception 'CLIENT_BLOCKED' using errcode = 'P0001';
  end if;
  if p_starts_at < now() + make_interval(mins => v_notice)
     or (v_advance is not null
         and v_day > (now() at time zone 'America/Bogota')::date + v_advance)
     or (p_ends_at at time zone 'America/Bogota')::date <> v_day
     or not exists (
       select 1
       from public.work_hours ws
       join public.work_hours wb on wb.business_id = ws.business_id and wb.staff_id is null
                                and wb.weekday = ws.weekday
       where ws.staff_id = p_staff and ws.weekday = extract(dow from v_day)
         and greatest(ws.starts, wb.starts) <= v_from
         and least(ws.ends, wb.ends) >= v_to) then
    raise exception 'OUT_OF_HOURS' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.client_booking_rules(uuid, uuid, timestamptz, timestamptz)
  from public, anon, authenticated;

-- Reserva del cliente con cuenta: revisa las reglas, crea o reutiliza su ficha en el negocio (con
-- su nombre y celular del perfil) e inserta la cita como reservada por el cliente. p_promos es la
-- casilla "promociones por WhatsApp" de la verificación: marcada, la ficha queda con permiso;
-- sin marcar no le quita el que ya tenía. Devuelve el id de la cita.
create function public.client_book(
  p_service uuid, p_staff uuid, p_starts_at timestamptz, p_promos boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_terms record;
  v_ends timestamptz;
  v_client uuid;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'NO_SESSION' using errcode = '42501';
  end if;
  select * into v_terms from public.client_service_terms(p_service, p_staff);
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  v_ends := p_starts_at + make_interval(mins => v_terms.minutes);
  perform public.client_booking_rules(v_terms.business_id, p_staff, p_starts_at, v_ends);

  insert into public.clients (business_id, profile_id, full_name, phone, gender, birth_date, promos_ok,
    created_by)
  select v_terms.business_id, p.id, coalesce(p.full_name, 'Cliente ' || right(p.phone, 4)), p.phone,
         p.gender, p.birth_date, p_promos, v_me
  from public.profiles p where p.id = v_me
  on conflict (business_id, profile_id)
    do update set promos_ok = public.clients.promos_ok or excluded.promos_ok
  returning id into v_client;

  insert into public.bookings (business_id, staff_id, service_id, client_id, starts_at, ends_at, price,
    booked_by, created_by)
  values (v_terms.business_id, p_staff, p_service, v_client, p_starts_at, v_ends, v_terms.price,
    'client', v_me)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.client_book(uuid, uuid, timestamptz, boolean) from public, anon;
grant execute on function public.client_book(uuid, uuid, timestamptz, boolean) to authenticated;

-- Una cita propia y pendiente a la que todavía le falta más que el límite de cancelación del
-- negocio; la deja bloqueada para cambiarla. Errores NOT_FOUND, BOOKING_LOCKED o TOO_LATE.
create function public.client_own_booking(p_booking uuid)
returns table (business_id uuid, staff_id uuid, service_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'NO_SESSION' using errcode = '42501';
  end if;
  select b.business_id, b.staff_id, b.service_id, b.starts_at, b.status, bu.cancel_limit_minutes
    into v_row
  from public.bookings b
  join public.clients c on c.id = b.client_id and c.profile_id = auth.uid()
  join public.businesses bu on bu.id = b.business_id
  where b.id = p_booking
  for update of b;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'BOOKING_LOCKED' using errcode = '42501', detail = 'status';
  end if;
  if v_row.starts_at - make_interval(mins => v_row.cancel_limit_minutes) <= now() then
    raise exception 'TOO_LATE' using errcode = 'P0001';
  end if;
  return query select v_row.business_id, v_row.staff_id, v_row.service_id;
end;
$$;
revoke execute on function public.client_own_booking(uuid) from public, anon, authenticated;

-- Cancelar como cliente (Fase 6 la usa en Mis Reservas). Los avisos al negocio y al profesional
-- los manda bookings_messages.
create function public.client_cancel(p_booking uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.client_own_booking(p_booking);
  update public.bookings set status = 'cancelled' where id = p_booking;
end;
$$;
revoke execute on function public.client_cancel(uuid) from public, anon;
grant execute on function public.client_cancel(uuid) to authenticated;

-- Cambiar la hora como cliente, con el mismo servicio y profesional y las mismas reglas de la
-- reserva. El precio queda el de la reserva.
create function public.client_reschedule(p_booking uuid, p_starts_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_own record;
  v_terms record;
  v_ends timestamptz;
begin
  select * into v_own from public.client_own_booking(p_booking);
  select * into v_terms from public.client_service_terms(v_own.service_id, v_own.staff_id);
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  v_ends := p_starts_at + make_interval(mins => v_terms.minutes);
  perform public.client_booking_rules(v_own.business_id, v_own.staff_id, p_starts_at, v_ends);
  update public.bookings set starts_at = p_starts_at, ends_at = v_ends where id = p_booking;
end;
$$;
revoke execute on function public.client_reschedule(uuid, timestamptz) from public, anon;
grant execute on function public.client_reschedule(uuid, timestamptz) to authenticated;

-- ============================================
-- Triggers
-- ============================================
-- La reseña toma el negocio y el profesional de su cita, y el autor es quien la escribe (la
-- semilla, sin sesión, pone el suyo). Si la cita no existe, business_id queda vacío y la base la
-- rechaza. Las reglas de quién puede calificar están en la política de insert.
create function public.reviews_fill() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select b.business_id, b.staff_id into new.business_id, new.staff_id
  from public.bookings b where b.id = new.booking_id;
  if auth.uid() is not null then
    new.author_id := auth.uid();
  end if;
  return new;
end;
$$;
create trigger reviews_fill
  before insert on public.reviews
  for each row execute function public.reviews_fill();

-- ============================================
-- RLS (todas las tablas nuevas)
-- ============================================
alter table public.reviews enable row level security;
alter table public.follows enable row level security;
alter table public.promotions enable row level security;

-- reviews: las lee cualquiera (también sin cuenta). Las escribe el autor, una vez por cita propia
-- (unique en booking_id) ya empezada, no cancelada ni marcada "no llegó" (US-030). La política
-- corre después de reviews_fill. No se cambian ni se borran.
create policy "todos leen las reseñas" on public.reviews
  for select to anon, authenticated using (true);
create policy "el cliente califica su cita" on public.reviews
  for insert to authenticated
  with check (author_id = (select auth.uid())
              and exists (select 1 from public.bookings b
                          join public.clients c on c.id = b.client_id
                          where b.id = reviews.booking_id
                            and c.profile_id = (select auth.uid())
                            and b.starts_at <= now()
                            and b.status not in ('cancelled', 'unsuccessful')));
revoke insert, update, delete on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (booking_id, attention, quality, comment) on public.reviews to authenticated;

-- follows: cada quien ve, crea y borra los suyos, de negocios que puede ver. El conteo sale por
-- business_stats y home_counters.
create policy "cada quien ve a quién sigue" on public.follows
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "cada quien sigue negocios" on public.follows
  for insert to authenticated
  with check (profile_id = (select auth.uid())
              and exists (select 1 from public.businesses b where b.id = follows.business_id));
create policy "cada quien deja de seguir" on public.follows
  for delete to authenticated using (profile_id = (select auth.uid()));
revoke select, insert, update, delete on public.follows from anon, authenticated;
grant select, delete on public.follows to authenticated;
grant insert (business_id) on public.follows to authenticated;

-- promotions: las lee cualquiera; el dueño las gestionará en la oleada 6.
create policy "todos leen las promociones" on public.promotions
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.promotions from anon, authenticated;
grant select on public.promotions to anon, authenticated;

grant select on public.business_rating, public.staff_rating to anon, authenticated;

-- ============================================
-- Realtime: el inicio del negocio cambia su calificación cuando entra una reseña (US-006 y
-- US-030). Las reseñas ya las lee cualquiera, así que no se abre nada nuevo.
-- ============================================
alter publication supabase_realtime add table public.reviews;
