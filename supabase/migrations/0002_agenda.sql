-- ============================================================================
-- StyloApp · 0002_agenda (Fase 3, oleada 2)
-- Clientes de cada negocio, citas, bloqueos y series; horas ocupadas, reputación, los
-- límites de las citas y sus avisos en la bandeja. También lo que usa la Fase 4
-- (bloqueos, series y clientes bloqueados), porque es de la misma oleada.
-- Fuente: TECH-SPEC-styloapp.md §4.2 y el Blueprint (T-3.1.1 y T-3.1.2). No se edita
-- después de su commit (invariante 6): los arreglos van en una migración nueva.
-- ============================================================================

-- ============================================
-- Tabla: clients (la ficha del cliente en cada negocio)
-- profile_id: si tiene cuenta en la app (lo pone client_book en la Fase 5).
-- El celular no se lee directo: sale por client_phone() según quién pregunta.
-- ============================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null check (char_length(full_name) between 2 and 80),
  phone text check (phone ~ '^\+57[0-9]{10}$'),
  birth_date date,
  gender text check (gender in ('male', 'female', 'other')),
  notes text check (char_length(notes) <= 500),
  whatsapp_ok boolean not null default true,
  promos_ok boolean not null default false,
  is_blocked boolean not null default false,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, profile_id)
);
create index idx_clients_search on public.clients (business_id, full_name);
create index idx_clients_profile on public.clients (profile_id);

-- ============================================
-- Agenda
-- ============================================
create table public.recurring_bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  frequency public.recurring_frequency not null,
  starts_on date not null,
  occurrences int not null check (occurrences between 1 and 52),
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index idx_recurring_business on public.recurring_bookings (business_id);

-- La exclusión no deja dos citas activas cruzadas del mismo profesional (pegadas sí:
-- tstzrange es [inicio, fin)). Su error es 23P01 y la app lo muestra como SLOT_TAKEN.
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  client_id uuid references public.clients (id) on delete set null,
  guest_name text check (char_length(guest_name) between 2 and 80),  -- "sin agregar cliente"
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price int not null check (price >= 0),
  booked_by public.booked_by not null default 'owner',     -- lo pone bookings_guard
  created_by uuid references public.profiles (id) default auth.uid(),
  status public.booking_status not null default 'pending',
  punctuality smallint check (punctuality in (1, 3, 5)),     -- no llegó, tarde, a tiempo
  punctuality_at timestamptz,
  note text check (char_length(note) <= 500),
  recurring_id uuid references public.recurring_bookings (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (client_id is not null or guest_name is not null),
  constraint bookings_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelled')
);
create index idx_bookings_agenda on public.bookings (business_id, starts_at);
create index idx_bookings_staff_day on public.bookings (staff_id, starts_at);
create index idx_bookings_client on public.bookings (client_id, starts_at desc);
create index idx_bookings_recurring on public.bookings (recurring_id);

create table public.agenda_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index idx_blocks_staff_day on public.agenda_blocks (staff_id, starts_at);

-- La bandeja ya guardaba booking_id (0001); ahora que existe bookings, su referencia.
alter table public.demo_messages
  add constraint demo_messages_booking_id_fkey
  foreign key (booking_id) references public.bookings (id) on delete cascade;
create index idx_demo_messages_booking on public.demo_messages (booking_id);

-- ============================================
-- Fechas de los avisos, en hora de Bogotá y como se dicen en Colombia
-- ("sábado 31 de octubre a las 11:00 a. m."). La base corre en inglés, así que
-- los nombres van en arreglos.
-- ============================================
create function public.booking_time_text(p_at timestamptz) returns text
language sql stable set search_path = '' as $$
  select ((extract(hour from l)::int + 11) % 12 + 1)::text || ':' || to_char(l, 'MI')
         || case when extract(hour from l) < 12 then ' a. m.' else ' p. m.' end
  from (select p_at at time zone 'America/Bogota' as l) t;
$$;

create function public.booking_when_text(p_at timestamptz) returns text
language sql stable set search_path = '' as $$
  select (array['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'])
           [extract(dow from l)::int + 1]
         || ' ' || extract(day from l)::int || ' de '
         || (array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
                   'septiembre', 'octubre', 'noviembre', 'diciembre'])[extract(month from l)::int]
         || case when extract(hour from l)::int % 12 = 1 then ' a la ' else ' a las ' end
         || public.booking_time_text(p_at)
  from (select p_at at time zone 'America/Bogota' as l) t;
$$;
revoke execute on function public.booking_time_text(timestamptz) from public, anon, authenticated;
revoke execute on function public.booking_when_text(timestamptz) from public, anon, authenticated;

-- ============================================
-- Funciones de lectura
-- ============================================

-- El celular de una ficha, solo para quien puede verlo (US-018): el cliente mismo; el dueño, y el
-- profesional si el negocio le dio el permiso (viene apagado). Si el cliente tiene cuenta y no
-- comparte su celular al reservar, no lo ve nadie del negocio.
create function public.client_phone(p_client uuid) returns text
language sql stable security definer set search_path = '' as $$
  select c.phone
  from public.clients c
  left join public.profiles p on p.id = c.profile_id
  where c.id = p_client
    and (c.profile_id = auth.uid()
         or ((p.id is null or p.share_phone_on_booking)
             and (public.is_owner_of(c.business_id)
                  or (public.is_staff_of(c.business_id)
                      and coalesce(public.team_can(c.business_id, 'see_client_phone'), false)))));
$$;
revoke execute on function public.client_phone(uuid) from public, anon;
grant execute on function public.client_phone(uuid) to authenticated;

-- Los clientes de un negocio para el buscador del editor (US-017), con el celular solo si quien
-- pregunta puede verlo. Solo responde al equipo de ese negocio.
create function public.business_clients(p_business uuid)
returns table (id uuid, full_name text, phone text, has_account boolean, is_blocked boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.full_name, public.client_phone(c.id), c.profile_id is not null, c.is_blocked
  from public.clients c
  where c.business_id = p_business and public.is_staff_of(p_business)
  order by c.full_name;
$$;
revoke execute on function public.business_clients(uuid) from public, anon;
grant execute on function public.business_clients(uuid) to authenticated;

-- Horas ocupadas de un profesional un día (citas activas y bloqueos). Solo rangos, nunca de
-- quién son; p_except deja libre la cita que se está modificando. La usa también la app de
-- clientes sin cuenta.
create function public.busy_ranges(p_staff uuid, p_day date, p_except uuid default null)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with dia as (
    select (p_day::timestamp at time zone 'America/Bogota') as desde,
           ((p_day + 1)::timestamp at time zone 'America/Bogota') as hasta
  )
  select b.starts_at, b.ends_at from public.bookings b, dia
  where b.staff_id = p_staff and b.status <> 'cancelled'
    and (p_except is null or b.id <> p_except)
    and b.starts_at < dia.hasta and b.ends_at > dia.desde
  union all
  select k.starts_at, k.ends_at from public.agenda_blocks k, dia
  where k.staff_id = p_staff and k.starts_at < dia.hasta and k.ends_at > dia.desde;
$$;
grant execute on function public.busy_ranges(uuid, date, uuid) to anon, authenticated;

-- La reputación es de la persona en todos los negocios: una vista con RLS solo sumaría las citas
-- que puede leer quien pregunta. Devuelve solo el promedio y el conteo, a la persona misma o al
-- equipo de un negocio donde es cliente.
create function public.client_reputation(p_profile uuid)
returns table (score numeric, rated_bookings bigint)
language sql stable security definer set search_path = '' as $$
  select round(avg(b.punctuality)::numeric, 2), count(*)
  from public.bookings b
  join public.clients c on c.id = b.client_id
  where c.profile_id = p_profile and b.punctuality is not null
    and (p_profile = auth.uid()
         or exists (select 1 from public.clients mine
                    where mine.profile_id = p_profile and public.is_staff_of(mine.business_id)));
$$;
revoke execute on function public.client_reputation(uuid) from public, anon;
grant execute on function public.client_reputation(uuid) to authenticated;

-- Contadores del inicio, v2: los agendamientos (sin las canceladas) del negocio para el dueño y
-- los suyos para el profesional. Seguidores y calificación llegan en la Fase 5; facturas, en la
-- oleada 4.
create or replace function public.home_counters(p_business uuid)
returns table (followers bigint, bookings bigint, rating numeric, reviews bigint, invoices bigint)
language sql stable security definer set search_path = '' as $$
  with me as (
    select public.is_owner_of(p_business) as is_owner, public.my_staff_id(p_business) as staff_id
  )
  select 0::bigint,
         (select count(*) from public.bookings b
          where b.business_id = p_business and b.status <> 'cancelled'
            and (me.is_owner or b.staff_id = me.staff_id)),
         null::numeric, 0::bigint, 0::bigint
  from me
  where public.is_staff_of(p_business);
$$;

-- ============================================
-- Triggers
-- ============================================
create trigger set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- Lo que RLS no puede poner por columna (Tech Spec §4.2 y US-018):
-- - Ninguna cita cae encima de un bloqueo (para todos; error 23P01, como la exclusión).
-- - Al crearla, quien la crea y si fue el negocio o el profesional los pone la base.
-- - Sin el permiso de agendar, el profesional solo marca la llegada y escribe la nota.
-- - La que reservó un cliente nadie del negocio la cambia: solo la cancela o marca la llegada.
-- - Después de que empezó, nadie la cambia ni la cancela: solo la llegada y la nota.
-- - La llegada se marca desde que empieza la cita; el estado solo cambia al cancelar o por la
--   llegada (bookings_set_status); una cancelada ya no cambia.
-- Errores (en message): SLOT_TAKEN, NO_PERMISSION_TEAM y BOOKING_LOCKED (detail: client,
-- started, not_started o cancelled). La semilla, la llave de servicio y las funciones del
-- cliente (Fase 5, que revisan sus propias reglas) pasan sin estos límites.
create function public.bookings_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_owner boolean;
  v_moved boolean;
  v_changed boolean;
  v_cancelling boolean;
begin
  if tg_op = 'INSERT' then
    v_moved := true;
  else
    v_moved := new.staff_id <> old.staff_id or new.starts_at <> old.starts_at
               or new.ends_at <> old.ends_at;
  end if;

  if new.status <> 'cancelled' and v_moved
     and exists (select 1 from public.agenda_blocks k
                 where k.staff_id = new.staff_id
                   and k.starts_at < new.ends_at and k.ends_at > new.starts_at) then
    raise exception 'SLOT_TAKEN' using errcode = '23P01', detail = 'block';
  end if;

  if auth.uid() is null or not public.is_staff_of(new.business_id) then
    return new;
  end if;
  v_owner := public.is_owner_of(new.business_id);

  if tg_op = 'INSERT' then
    v_changed := true;
  else
    v_changed := v_moved or new.service_id <> old.service_id
                 or new.client_id is distinct from old.client_id
                 or new.guest_name is distinct from old.guest_name
                 or new.price <> old.price;
  end if;

  -- El profesional, el servicio y el cliente son de este negocio, y el profesional está activo.
  if v_changed and (
       not exists (select 1 from public.staff s
                   where s.id = new.staff_id and s.business_id = new.business_id and s.is_active)
       or not exists (select 1 from public.services sv
                      where sv.id = new.service_id and sv.business_id = new.business_id)
       or (new.client_id is not null
           and not exists (select 1 from public.clients c
                           where c.id = new.client_id and c.business_id = new.business_id))) then
    raise exception 'La cita mezcla datos de otro negocio' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if new.recurring_id is not null and not v_owner then
      raise exception 'NO_PERMISSION_TEAM' using errcode = '42501';
    end if;
    new.created_by := auth.uid();
    new.booked_by := case when v_owner then 'owner'::public.booked_by else 'staff'::public.booked_by end;
    new.status := 'pending';
    new.punctuality := null;
    new.punctuality_at := null;
    new.cancelled_at := null;
    new.cancelled_by := null;
    return new;
  end if;

  v_cancelling := new.status = 'cancelled' and old.status <> 'cancelled';

  if old.status = 'cancelled' then
    if v_changed or new.status <> old.status or new.punctuality is distinct from old.punctuality then
      raise exception 'BOOKING_LOCKED' using errcode = '42501', detail = 'cancelled';
    end if;
    return new;
  end if;

  if new.status <> old.status and not v_cancelling then
    raise exception 'BOOKING_LOCKED' using errcode = '42501', detail = 'status';
  end if;

  if v_changed or v_cancelling then
    if not v_owner and not coalesce(public.team_can(new.business_id, 'manual_booking'), false) then
      raise exception 'NO_PERMISSION_TEAM' using errcode = '42501';
    end if;
    if old.starts_at <= now() then
      raise exception 'BOOKING_LOCKED' using errcode = '42501', detail = 'started';
    end if;
    if v_changed and old.booked_by = 'client' then
      raise exception 'BOOKING_LOCKED' using errcode = '42501', detail = 'client';
    end if;
  end if;

  if new.punctuality is distinct from old.punctuality and old.starts_at > now() then
    raise exception 'BOOKING_LOCKED' using errcode = '42501', detail = 'not_started';
  end if;
  return new;
end;
$$;
create trigger bookings_guard
  before insert or update on public.bookings
  for each row execute function public.bookings_guard();

-- Después de bookings_guard (los triggers corren en orden de nombre): la llegada 5 o 3 deja la
-- cita efectiva y 1 abandonada; al cancelar queda quién y cuándo.
create function public.bookings_set_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.punctuality is distinct from old.punctuality then
    new.punctuality_at := case when new.punctuality is null then null else now() end;
    new.status := case new.punctuality
                    when 5 then 'successful'::public.booking_status
                    when 3 then 'successful'::public.booking_status
                    when 1 then 'unsuccessful'::public.booking_status
                    else 'pending'::public.booking_status
                  end;
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := now();
    new.cancelled_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger bookings_set_status
  before update on public.bookings
  for each row execute function public.bookings_set_status();

-- Un mensaje de la bandeja para una persona. Los de WhatsApp respetan si apagó los mensajes de
-- sus citas (US-023 y US-032). Solo la llaman los triggers.
create function public.booking_notify(
  p_profile uuid, p_channel public.message_channel, p_kind text, p_title text, p_body text,
  p_booking uuid, p_deliver_at timestamptz default now()
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_phone text;
  v_whatsapp boolean;
begin
  if p_profile is null then
    return;
  end if;
  select p.phone, p.whatsapp_booking_messages into v_phone, v_whatsapp
  from public.profiles p where p.id = p_profile;
  if v_phone is null or (p_channel = 'whatsapp' and not v_whatsapp) then
    return;
  end if;
  insert into public.demo_messages
    (recipient_id, recipient_phone, channel, kind, title, body, booking_id, deliver_at)
  values (p_profile, v_phone, p_channel, p_kind, p_title, p_body, p_booking, p_deliver_at);
end;
$$;
revoke execute on function public.booking_notify(uuid, public.message_channel, text, text, text, uuid, timestamptz)
  from public, anon, authenticated;

-- Los recordatorios de una cita: 24 h y 2 h antes, al cliente con cuenta, solo si esa hora no
-- ha pasado. Salen en la bandeja a su hora (deliver_at).
create function public.booking_reminders(
  p_booking uuid, p_client_profile uuid, p_starts_at timestamptz,
  p_business text, p_address text, p_service text, p_staff text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  -- " a las 11:00 a. m." o " a la 1:00 p. m.", sacado de la fecha larga.
  v_at text := substr(public.booking_when_text(p_starts_at),
                      strpos(public.booking_when_text(p_starts_at), ' a la'));
begin
  if p_starts_at - interval '24 hours' > now() then
    perform public.booking_notify(p_client_profile, 'whatsapp', 'reminder_1', 'Tu cita es mañana',
      'Te esperamos mañana' || v_at || ' en ' || p_business || ' para ' || p_service || ' con '
      || p_staff || '.',
      p_booking, p_starts_at - interval '24 hours');
  end if;
  if p_starts_at - interval '2 hours' > now() then
    perform public.booking_notify(p_client_profile, 'whatsapp', 'reminder_2', 'Tu cita es en 2 horas',
      'Hoy' || v_at || ' tienes ' || p_service || ' con ' || p_staff || ' en ' || p_business
      || ' (' || p_address || ').',
      p_booking, p_starts_at - interval '2 hours');
  end if;
end;
$$;
revoke execute on function public.booking_reminders(uuid, uuid, timestamptz, text, text, text, text)
  from public, anon, authenticated;

-- Los avisos de cada cita (US-023), con textos propios: confirmación y recordatorios al cliente
-- con cuenta, aviso al profesional, cambio, cancelación e invitación a calificar. Quien hizo el
-- cambio no recibe su propio aviso (salvo la confirmación del cliente). Al cambiar o cancelar,
-- los recordatorios que no han salido se borran. La semilla los apaga con app.seeding.
create function public.bookings_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_business text;
  v_address text;
  v_service text;
  v_staff text;
  v_staff_profile uuid;
  v_old_staff_profile uuid;
  v_client_profile uuid;
  v_client_name text;
  v_when text;
begin
  if coalesce(current_setting('app.seeding', true), '') = 'on' then
    return null;
  end if;

  select b.name, b.address into v_business, v_address
  from public.businesses b where b.id = new.business_id;
  select sv.name into v_service from public.services sv where sv.id = new.service_id;
  select s.display_name, s.profile_id into v_staff, v_staff_profile
  from public.staff s where s.id = new.staff_id;
  select c.profile_id, c.full_name into v_client_profile, v_client_name
  from public.clients c where c.id = new.client_id;
  v_client_name := coalesce(v_client_name, new.guest_name, 'Un cliente');
  v_when := public.booking_when_text(new.starts_at);

  if tg_op = 'INSERT' then
    if new.status = 'cancelled' then
      return null;
    end if;
    perform public.booking_notify(v_client_profile, 'whatsapp', 'booking_confirmed', 'Cita confirmada',
      v_business || ': tu cita de ' || v_service || ' con ' || v_staff || ' quedó para el '
      || v_when, new.id);
    if v_staff_profile is distinct from v_actor then
      perform public.booking_notify(v_staff_profile, 'push', 'booking_new_for_staff', 'Nueva cita',
        'Te agendaron ' || v_service || ' con ' || v_client_name || ' para el ' || v_when, new.id);
    end if;
    perform public.booking_reminders(new.id, v_client_profile, new.starts_at, v_business, v_address,
      v_service, v_staff);
    return null;
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    delete from public.demo_messages m
    where m.booking_id = new.id and m.kind in ('reminder_1', 'reminder_2') and m.deliver_at > now();
    if v_client_profile is distinct from v_actor then
      perform public.booking_notify(v_client_profile, 'whatsapp', 'booking_cancelled', 'Cita cancelada',
        'Se canceló tu cita de ' || v_service || ' en ' || v_business || ' del ' || v_when, new.id);
    end if;
    if v_staff_profile is distinct from v_actor then
      perform public.booking_notify(v_staff_profile, 'push', 'booking_cancelled', 'Cita cancelada',
        'Se canceló la cita de ' || v_client_name || ' (' || v_service || ') del ' || v_when,
        new.id);
    end if;
    return null;
  end if;

  if new.status = 'pending' and (new.starts_at <> old.starts_at or new.staff_id <> old.staff_id
                                 or new.service_id <> old.service_id) then
    delete from public.demo_messages m
    where m.booking_id = new.id and m.kind in ('reminder_1', 'reminder_2') and m.deliver_at > now();
    if v_client_profile is distinct from v_actor then
      perform public.booking_notify(v_client_profile, 'whatsapp', 'booking_changed', 'Tu cita cambió',
        v_business || ' cambió tu cita: ahora es ' || v_service || ' con ' || v_staff || ' el '
        || v_when, new.id);
    end if;
    if v_staff_profile is distinct from v_actor then
      perform public.booking_notify(v_staff_profile, 'push', 'booking_changed', 'Cita cambiada',
        'La cita de ' || v_client_name || ' ahora es ' || v_service || ' el ' || v_when, new.id);
    end if;
    if new.staff_id <> old.staff_id then
      select s.profile_id into v_old_staff_profile from public.staff s where s.id = old.staff_id;
      if v_old_staff_profile is distinct from v_actor then
        perform public.booking_notify(v_old_staff_profile, 'push', 'booking_changed', 'Cita cambiada',
          'La cita de ' || v_client_name || ' del ' || public.booking_when_text(old.starts_at)
          || ' pasó a ' || v_staff || '.', new.id);
      end if;
    end if;
    perform public.booking_reminders(new.id, v_client_profile, new.starts_at, v_business, v_address,
      v_service, v_staff);
    return null;
  end if;

  if new.status = 'successful' and old.status <> 'successful' then
    perform public.booking_notify(v_client_profile, 'push', 'booking_successful', '¿Cómo te fue?',
      'Gracias por venir a ' || v_business || '. Califica tu cita de ' || v_service || ' con '
      || v_staff || '.', new.id);
  end if;
  return null;
end;
$$;
create trigger bookings_messages
  after insert or update on public.bookings
  for each row execute function public.bookings_messages();

-- Bloqueos: el profesional es del negocio, queda quién lo creó y no cae encima de una cita
-- activa (error BLOCK_OVERLAP, US-021).
create function public.agenda_blocks_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.staff s
                 where s.id = new.staff_id and s.business_id = new.business_id) then
    raise exception 'El profesional no es de este negocio' using errcode = '23514';
  end if;
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  if exists (select 1 from public.bookings b
             where b.staff_id = new.staff_id and b.status <> 'cancelled'
               and b.starts_at < new.ends_at and b.ends_at > new.starts_at) then
    raise exception 'BLOCK_OVERLAP' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger agenda_blocks_guard
  before insert or update on public.agenda_blocks
  for each row execute function public.agenda_blocks_guard();

-- ============================================
-- RLS (todas las tablas nuevas)
-- ============================================
alter table public.clients enable row level security;
alter table public.recurring_bookings enable row level security;
alter table public.bookings enable row level security;
alter table public.agenda_blocks enable row level security;

-- clients: el equipo ve las fichas de su negocio y el cliente la suya. Crea el dueño, o el
-- profesional si tiene el permiso de clientes internos; cambia solo el dueño (también el
-- bloqueo, US-020). El celular no se lee directo (client_phone).
create policy "el equipo y el cliente ven las fichas" on public.clients
  for select to authenticated
  using (public.is_staff_of(business_id) or profile_id = (select auth.uid()));
create policy "el dueño y el profesional con permiso crean fichas" on public.clients
  for insert to authenticated
  with check (public.is_owner_of(business_id)
              or (public.is_staff_of(business_id)
                  and coalesce(public.team_can(business_id, 'internal_clients'), false)));
create policy "el dueño cambia las fichas" on public.clients
  for update to authenticated
  using (public.is_owner_of(business_id)) with check (public.is_owner_of(business_id));
revoke select, insert, update, delete on public.clients from anon, authenticated;
grant select (id, business_id, profile_id, full_name, birth_date, gender, notes, whatsapp_ok, promos_ok,
  is_blocked, created_by, created_at, updated_at) on public.clients to authenticated;
grant insert (business_id, full_name, phone, birth_date, gender, notes, whatsapp_ok, promos_ok)
  on public.clients to authenticated;
grant update (full_name, phone, birth_date, gender, notes, whatsapp_ok, promos_ok, is_blocked)
  on public.clients to authenticated;

-- recurring_bookings: el equipo las ve; solo el dueño crea y borra series (US-022).
create policy "el equipo ve las series" on public.recurring_bookings
  for select to authenticated using (public.is_staff_of(business_id));
create policy "el dueño crea series" on public.recurring_bookings
  for insert to authenticated with check (public.is_owner_of(business_id));
create policy "el dueño borra series" on public.recurring_bookings
  for delete to authenticated using (public.is_owner_of(business_id));
revoke insert, update, delete on public.recurring_bookings from anon, authenticated;
grant insert (business_id, staff_id, service_id, client_id, weekday, start_time, frequency, starts_on,
  occurrences) on public.recurring_bookings to authenticated;
grant delete on public.recurring_bookings to authenticated;

-- bookings: el dueño ve y cambia todas las de su negocio; el profesional, las suyas (agenda
-- solo con el permiso, que revisa también bookings_guard); el cliente ve las de su ficha y las
-- cambia por sus funciones (Fase 5). No se borran: se cancelan.
create policy "dueño ve las citas de su negocio" on public.bookings
  for select to authenticated using (public.is_owner_of(business_id));
create policy "profesional ve sus citas" on public.bookings
  for select to authenticated using (staff_id = public.my_staff_id(business_id));
create policy "cliente ve sus citas" on public.bookings
  for select to authenticated
  using (exists (select 1 from public.clients c
                 where c.id = bookings.client_id and c.profile_id = (select auth.uid())));
create policy "dueño crea citas" on public.bookings
  for insert to authenticated with check (public.is_owner_of(business_id));
create policy "profesional agenda en su columna si tiene permiso" on public.bookings
  for insert to authenticated
  with check (staff_id = public.my_staff_id(business_id)
              and coalesce(public.team_can(business_id, 'manual_booking'), false));
create policy "dueño cambia citas" on public.bookings
  for update to authenticated
  using (public.is_owner_of(business_id)) with check (public.is_owner_of(business_id));
create policy "profesional cambia sus citas" on public.bookings
  for update to authenticated
  using (staff_id = public.my_staff_id(business_id))
  with check (staff_id = public.my_staff_id(business_id));
revoke insert, update, delete on public.bookings from anon, authenticated;
grant insert (business_id, staff_id, service_id, client_id, guest_name, starts_at, ends_at, price, note,
  recurring_id) on public.bookings to authenticated;
grant update (staff_id, service_id, client_id, guest_name, starts_at, ends_at, price, status, punctuality,
  note) on public.bookings to authenticated;

-- agenda_blocks: el equipo los ve (el cliente solo ve horas ocupadas, por busy_ranges). Crea y
-- quita el dueño, o el profesional en su columna si tiene el permiso de bloquear.
create policy "el equipo ve los bloqueos" on public.agenda_blocks
  for select to authenticated using (public.is_staff_of(business_id));
create policy "dueño y profesional con permiso bloquean" on public.agenda_blocks
  for insert to authenticated
  with check (public.is_owner_of(business_id)
              or (staff_id = public.my_staff_id(business_id)
                  and coalesce(public.team_can(business_id, 'manual_block'), false)));
create policy "dueño y profesional con permiso quitan bloqueos" on public.agenda_blocks
  for delete to authenticated
  using (public.is_owner_of(business_id)
         or (staff_id = public.my_staff_id(business_id)
             and coalesce(public.team_can(business_id, 'manual_block'), false)));
revoke insert, update, delete on public.agenda_blocks from anon, authenticated;
grant insert (business_id, staff_id, starts_at, ends_at) on public.agenda_blocks to authenticated;
grant delete on public.agenda_blocks to authenticated;

-- ============================================
-- Realtime: la agenda escucha las citas y el equipo (columna nueva al vincularse, US-012).
-- staff ya lo lee cualquiera, así que no se abre nada nuevo.
-- ============================================
alter publication supabase_realtime add table public.bookings, public.staff;
