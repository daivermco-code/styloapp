-- ============================================================================
-- StyloApp · 0001_base (Fase 1)
-- Personas, negocios, equipo, horarios, catálogo y la bandeja de la demo.
-- Fuente: TECH-SPEC-styloapp.md §4.2. Esta migración no se edita después de su
-- commit (invariante 6): los arreglos van en una migración nueva.
-- ============================================================================

-- ============================================
-- Extensiones y tipos
-- ============================================
-- btree_gist: la exclusión de citas cruzadas de 0002 (staff_id con = dentro de un índice gist).
create extension if not exists btree_gist with schema extensions;

create type public.staff_role as enum ('owner', 'staff');
create type public.booking_status as enum ('pending', 'successful', 'unsuccessful', 'cancelled');
create type public.booked_by as enum ('owner', 'staff', 'client');
create type public.price_type as enum ('fixed', 'from', 'range');
create type public.recurring_frequency as enum ('weekly', 'biweekly', 'monthly');
create type public.message_channel as enum ('sms', 'whatsapp', 'push');

-- ============================================
-- Tabla: profiles
-- Cada persona de la demo (dueño, profesional o cliente). La crea handle_new_user.
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) between 2 and 80),
  phone text not null unique check (phone ~ '^\+57[0-9]{10}$'),
  gender text check (gender in ('male', 'female', 'other')),
  birth_date date,
  avatar_url text,
  share_phone_on_booking boolean not null default true,
  share_phone_with_followed boolean not null default false,
  whatsapp_booking_messages boolean not null default true,
  whatsapp_promotions boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Persona de la demo; full_name es null hasta completar el perfil';

-- ============================================
-- Tabla: businesses
-- ============================================
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  name text not null check (char_length(name) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  kind text not null check (kind in ('barbershop', 'nail_spa', 'salon', 'spa')),
  address text not null,
  neighborhood text,
  city text not null default 'Bogotá',
  lat double precision,
  lng double precision,
  whatsapp text check (whatsapp ~ '^\+57[0-9]{10}$'),
  logo_url text,
  cover_url text,
  online_booking boolean not null default true,
  cancel_limit_minutes int not null default 15 check (cancel_limit_minutes >= 0),
  slot_interval_minutes int not null default 30 check (slot_interval_minutes in (15, 30, 60)),
  min_notice_minutes int not null default 0 check (min_notice_minutes >= 0),
  max_advance_days int check (max_advance_days > 0),          -- null = siempre
  show_owner_agenda boolean not null default true,
  is_listed boolean not null default true,                    -- aparece en Explorar
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_businesses_owner on public.businesses (owner_id);

-- ============================================
-- Tabla: business_link_codes
-- El código de 6 letras para vincular profesionales. Va aparte de businesses (ajuste de
-- la Fase 1): businesses se lee sin cuenta, y con el código cualquiera entraría al equipo
-- y vería los clientes del negocio (invariante 3). Solo lo lee el dueño.
-- ============================================
create table public.business_link_codes (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z]{6}$')
);

-- ============================================
-- Tabla: team_permissions (una fila por negocio; valores iniciales de la app estudiada)
-- ============================================
create table public.team_permissions (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  internal_clients boolean not null default true,
  invoicing boolean not null default true,
  manual_booking boolean not null default true,
  manual_block boolean not null default true,
  see_client_phone boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ============================================
-- Tabla: staff (dueño y profesionales de un negocio)
-- ============================================
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.staff_role not null default 'staff',
  display_name text not null check (char_length(display_name) between 2 and 40),
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, profile_id)
);
create unique index uq_staff_one_active_business on public.staff (profile_id) where is_active;

-- ============================================
-- Tabla: work_hours (horario del negocio si staff_id es null; si no, del profesional)
-- ============================================
create table public.work_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid references public.staff (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),  -- 0 = domingo
  starts time not null,
  ends time not null,
  check (ends > starts)
);
create index idx_work_hours_lookup on public.work_hours (business_id, staff_id, weekday);

-- ============================================
-- Catálogo
-- ============================================
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  position int not null default 0,
  unique (business_id, name)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid not null references public.service_categories (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 60),
  audience text not null default 'unisex' check (audience in ('male', 'female', 'unisex')),
  description text check (char_length(description) <= 300),
  duration_minutes int not null check (duration_minutes between 5 and 600),
  price_type public.price_type not null default 'fixed',
  price int not null check (price >= 0),                      -- pesos, sin decimales
  price_to int,
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price_type <> 'range' or price_to >= price)
);
create index idx_services_business on public.services (business_id, category_id);

create table public.staff_services (
  staff_id uuid not null references public.staff (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  duration_minutes int check (duration_minutes between 5 and 600),  -- null = la del servicio
  price int check (price >= 0),                                     -- oleada 4
  commission_pct numeric(5, 2) check (commission_pct between 0 and 100),  -- oleada 4
  primary key (staff_id, service_id)
);
create index idx_staff_services_service on public.staff_services (service_id);

-- ============================================
-- Tabla: demo_messages (bandeja de la demo: lo que se habría enviado)
-- booking_id queda sin referencia: bookings llega en 0002, que la agrega con alter table.
-- ============================================
create table public.demo_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles (id) on delete cascade,  -- null mientras no hay cuenta
  recipient_phone text not null,
  channel public.message_channel not null,
  kind text not null check (kind in (
    'login_code', 'booking_confirmed', 'booking_new_for_staff', 'reminder_1', 'reminder_2',
    'booking_changed', 'booking_cancelled', 'booking_successful'
  )),
  title text not null,
  body text not null,
  booking_id uuid,
  deliver_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_demo_messages_inbox on public.demo_messages (recipient_phone, deliver_at desc);
create index idx_demo_messages_recipient on public.demo_messages (recipient_id, deliver_at desc);

-- ============================================
-- Funciones de apoyo para RLS (security definer, search_path vacío, solo miran a quien llama)
-- ============================================
create function public.is_owner_of(p_business uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s
                 where s.business_id = p_business and s.profile_id = auth.uid()
                   and s.role = 'owner' and s.is_active);
$$;

create function public.is_staff_of(p_business uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s
                 where s.business_id = p_business and s.profile_id = auth.uid() and s.is_active);
$$;

create function public.my_staff_id(p_business uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select s.id from public.staff s
  where s.business_id = p_business and s.profile_id = auth.uid() and s.is_active;
$$;

create function public.team_can(p_business uuid, p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_permission
    when 'manual_booking' then tp.manual_booking
    when 'manual_block' then tp.manual_block
    when 'internal_clients' then tp.internal_clients
    when 'see_client_phone' then tp.see_client_phone
    else false end
  from public.team_permissions tp where tp.business_id = p_business;
$$;

-- El celular de quien llama (+57…), para que la bandeja muestre también lo que llegó a su
-- número antes de tener cuenta.
create function public.my_phone() returns text
language sql stable security definer set search_path = '' as $$
  select p.phone from public.profiles p where p.id = auth.uid();
$$;

-- ============================================
-- Triggers
-- ============================================

-- Perfil de cada cuenta nueva. Supabase Auth guarda el celular sin "+" (573…): aquí se le pone.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.phone is null or new.phone = '' then
    return new;
  end if;
  insert into public.profiles (id, phone) values (new.id, '+' || ltrim(new.phone, '+'));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.team_permissions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- Código de vinculación al azar: 6 letras mayúsculas que no use otro negocio.
create function public.new_link_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_code text;
begin
  loop
    select string_agg(chr(65 + floor(random() * 26)::int), '') into v_code
    from generate_series(1, 6);
    exit when not exists (select 1 from public.business_link_codes c where c.code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke execute on function public.new_link_code() from public, anon, authenticated;

-- Negocio nuevo: sus permisos de equipo, su código de vinculación y la fila del dueño en staff
-- (con su primer nombre, como sale para los clientes).
create function public.businesses_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_full_name text;
  v_display_name text;
begin
  insert into public.team_permissions (business_id) values (new.id);
  insert into public.business_link_codes (business_id, code) values (new.id, public.new_link_code());

  select btrim(p.full_name) into v_full_name from public.profiles p where p.id = new.owner_id;
  v_display_name := split_part(coalesce(v_full_name, ''), ' ', 1);
  if char_length(v_display_name) < 2 then
    v_display_name := left(coalesce(v_full_name, 'Dueño'), 40);
  end if;
  insert into public.staff (business_id, profile_id, role, display_name, position)
  values (new.id, new.owner_id, 'owner', v_display_name, 0);
  return new;
end;
$$;
create trigger businesses_defaults
  after insert on public.businesses
  for each row execute function public.businesses_defaults();

-- RLS no limita columnas. Este trigger pone dos reglas en staff_services:
-- el servicio y el profesional son del mismo negocio, y el profesional (que no es el dueño)
-- solo cambia la duración: el precio y la comisión son del dueño (oleada 4).
create function public.staff_services_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_staff_business uuid;
  v_service_business uuid;
begin
  select s.business_id into v_staff_business from public.staff s where s.id = new.staff_id;
  select sv.business_id into v_service_business from public.services sv where sv.id = new.service_id;
  if v_staff_business is distinct from v_service_business then
    raise exception 'El servicio no es de este negocio' using errcode = '23514';
  end if;

  -- auth.uid() es null en la semilla y con la llave de servicio.
  if auth.uid() is not null and not public.is_owner_of(v_staff_business) then
    if tg_op = 'INSERT' then
      if new.price is not null or new.commission_pct is not null then
        raise exception 'El precio y la comisión los pone el dueño' using errcode = '42501';
      end if;
    elsif new.staff_id <> old.staff_id or new.service_id <> old.service_id
       or new.price is distinct from old.price
       or new.commission_pct is distinct from old.commission_pct then
      raise exception 'El profesional solo cambia la duración de sus servicios' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger staff_services_guard
  before insert or update on public.staff_services
  for each row execute function public.staff_services_guard();

-- ============================================
-- Hook de Supabase Auth: el código de entrada va a la bandeja de la demo, no a un SMS.
-- Cuando corre, el perfil ya existe (Auth crea la cuenta antes de mandar el código).
-- ============================================
create function public.send_sms_demo(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_phone text := '+' || ltrim(event #>> '{user,phone}', '+');
  v_code text := event #>> '{sms,otp}';
begin
  insert into public.demo_messages (recipient_id, recipient_phone, channel, kind, title, body)
  values (
    (select p.id from public.profiles p where p.phone = v_phone),
    v_phone, 'sms', 'login_code', 'Código de StyloApp',
    'Tu código para entrar a StyloApp es ' || v_code || '.'
  );
  return '{}'::jsonb;
end;
$$;
revoke execute on function public.send_sms_demo(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.send_sms_demo(jsonb) to supabase_auth_admin;

-- ============================================
-- Funciones de negocio
-- ============================================

-- Un profesional sin negocio entra al equipo con el código (US-012). Errores (en message):
-- LINK_CODE_NOT_FOUND, ALREADY_LINKED (detail = nombre del negocio) y TEAM_FULL.
-- Cupo: 5 profesionales activos además del dueño (valor propio de la demo, Fase 1).
create function public.link_staff(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_business uuid;
  v_current text;
  v_staff uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select b.name into v_current
  from public.staff s join public.businesses b on b.id = s.business_id
  where s.profile_id = v_uid and s.is_active;
  if found then
    raise exception 'ALREADY_LINKED' using errcode = 'P0001', detail = v_current;
  end if;

  select c.business_id into v_business
  from public.business_link_codes c where c.code = upper(btrim(p_code));
  if v_business is null then
    raise exception 'LINK_CODE_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Un vínculo a la vez por negocio, para que el cupo no se pase.
  perform 1 from public.businesses b where b.id = v_business for update;
  if (select count(*) from public.staff s
      where s.business_id = v_business and s.role = 'staff' and s.is_active) >= 5 then
    raise exception 'TEAM_FULL' using errcode = 'P0001';
  end if;

  insert into public.staff (business_id, profile_id, role, display_name, position)
  values (
    v_business, v_uid, 'staff', btrim(p_display_name),
    (select coalesce(max(s.position), 0) + 1 from public.staff s where s.business_id = v_business)
  )
  on conflict (business_id, profile_id)
  do update set is_active = true, display_name = excluded.display_name, position = excluded.position
  returning id into v_staff;
  return v_staff;
end;
$$;
revoke execute on function public.link_staff(text, text) from public, anon;
grant execute on function public.link_staff(text, text) to authenticated;

-- Contadores del inicio (US-006 y US-007). v1: todavía no hay citas, reseñas ni seguidores;
-- las Fases 3 y 5 la reescriben con create or replace (mismas columnas). Solo responde al equipo.
create function public.home_counters(p_business uuid)
returns table (followers bigint, bookings bigint, rating numeric, reviews bigint, invoices bigint)
language sql stable security definer set search_path = '' as $$
  select 0::bigint, 0::bigint, null::numeric, 0::bigint, 0::bigint
  where public.is_staff_of(p_business);
$$;
revoke execute on function public.home_counters(uuid) from public, anon;
grant execute on function public.home_counters(uuid) to authenticated;

-- ============================================
-- RLS (todas las tablas)
-- ============================================
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_link_codes enable row level security;
alter table public.team_permissions enable row level security;
alter table public.staff enable row level security;
alter table public.work_hours enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.staff_services enable row level security;
alter table public.demo_messages enable row level security;

-- profiles: cada quien el suyo. El equipo verá a sus clientes por clients (0002).
-- El celular y el id no se cambian desde la app.
create policy "cada quien ve su perfil" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "cada quien cambia su perfil" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, gender, birth_date, avatar_url, share_phone_on_booking,
  share_phone_with_followed, whatsapp_booking_messages, whatsapp_promotions)
  on public.profiles to authenticated;

-- businesses: todos ven los que salen en Explorar; el equipo, el suyo. Solo el dueño cambia.
-- Los negocios los crea la semilla (no hay "crear negocio" en el MVP).
create policy "todos ven los negocios listados y el equipo el suyo" on public.businesses
  for select to anon, authenticated using (is_listed or public.is_staff_of(id));
create policy "el dueño cambia su negocio" on public.businesses
  for update to authenticated using (public.is_owner_of(id)) with check (public.is_owner_of(id));
revoke insert, update, delete on public.businesses from anon, authenticated;
grant update (name, kind, address, neighborhood, city, lat, lng, whatsapp, logo_url, cover_url,
  online_booking, cancel_limit_minutes, slot_interval_minutes, min_notice_minutes, max_advance_days,
  show_owner_agenda, is_listed)
  on public.businesses to authenticated;

-- business_link_codes: solo el dueño (para mostrarlo con su QR en Equipo).
create policy "el dueño ve su código" on public.business_link_codes
  for select to authenticated using (public.is_owner_of(business_id));
revoke insert, update, delete on public.business_link_codes from anon, authenticated;

-- team_permissions: el equipo lee, el dueño cambia.
create policy "el equipo ve los permisos" on public.team_permissions
  for select to authenticated using (public.is_staff_of(business_id));
create policy "el dueño cambia los permisos" on public.team_permissions
  for update to authenticated using (public.is_owner_of(business_id))
  with check (public.is_owner_of(business_id));
revoke insert, delete on public.team_permissions from anon, authenticated;

-- staff: todos leen (nombre y foto salen en la app de clientes). El dueño cambia nombre,
-- orden y activo; nadie se agrega por la API (se entra con link_staff).
create policy "todos ven el equipo" on public.staff
  for select to anon, authenticated using (true);
create policy "el dueño cambia su equipo" on public.staff
  for update to authenticated using (public.is_owner_of(business_id))
  with check (public.is_owner_of(business_id));
revoke insert, update, delete on public.staff from anon, authenticated;
grant update (display_name, is_active, position) on public.staff to authenticated;

-- work_hours: todos leen; el dueño escribe las del negocio y de cualquiera de su equipo;
-- el profesional, las suyas.
create policy "todos ven los horarios" on public.work_hours
  for select to anon, authenticated using (true);
create policy "dueño y profesional escriben horarios" on public.work_hours
  for all to authenticated
  using (public.is_owner_of(business_id)
         or (staff_id is not null and staff_id = public.my_staff_id(business_id)))
  with check (
    (public.is_owner_of(business_id)
     or (staff_id is not null and staff_id = public.my_staff_id(business_id)))
    and (staff_id is null or exists (select 1 from public.staff s
                                     where s.id = staff_id and s.business_id = work_hours.business_id))
  );

-- Catálogo: todos leen; el dueño escribe.
create policy "todos ven las categorías" on public.service_categories
  for select to anon, authenticated using (true);
create policy "el dueño escribe categorías" on public.service_categories
  for all to authenticated using (public.is_owner_of(business_id))
  with check (public.is_owner_of(business_id));

create policy "todos ven los servicios" on public.services
  for select to anon, authenticated using (true);
create policy "el dueño escribe servicios" on public.services
  for all to authenticated using (public.is_owner_of(business_id))
  with check (
    public.is_owner_of(business_id)
    and exists (select 1 from public.service_categories c
                where c.id = category_id and c.business_id = services.business_id)
  );

-- staff_services: todos leen; el dueño y el profesional (sus filas) escriben.
-- Qué columnas puede cambiar el profesional lo pone staff_services_guard.
create policy "todos ven quién hace cada servicio" on public.staff_services
  for select to anon, authenticated using (true);
create policy "dueño y profesional escriben sus servicios" on public.staff_services
  for all to authenticated
  using (exists (select 1 from public.staff s
                 where s.id = staff_services.staff_id
                   and (public.is_owner_of(s.business_id)
                        or (s.profile_id = (select auth.uid()) and s.is_active))))
  with check (exists (select 1 from public.staff s
                      where s.id = staff_services.staff_id
                        and (public.is_owner_of(s.business_id)
                             or (s.profile_id = (select auth.uid()) and s.is_active))));

-- demo_messages: solo el destinatario (por su cuenta o por su celular). Los escriben
-- triggers y funciones; desde la app solo se marca como leído.
create policy "el destinatario ve sus mensajes" on public.demo_messages
  for select to authenticated
  using (recipient_id = (select auth.uid()) or recipient_phone = (select public.my_phone()));
create policy "el destinatario marca sus mensajes leídos" on public.demo_messages
  for update to authenticated
  using (recipient_id = (select auth.uid()) or recipient_phone = (select public.my_phone()))
  with check (recipient_id = (select auth.uid()) or recipient_phone = (select public.my_phone()));
revoke insert, update, delete on public.demo_messages from anon, authenticated;
grant update (read_at) on public.demo_messages to authenticated;

-- ============================================
-- Realtime (bookings y staff llegan en 0002; reviews en 0003)
-- ============================================
alter publication supabase_realtime add table public.demo_messages;
