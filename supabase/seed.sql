-- ============================================================================
-- StyloApp · semilla de la demo
-- No es una migración: se puede editar y crece en las Fases 3 y 5. Define las funciones
-- (create or replace) y al final siembra. `npm run db:reset` la corre después de las
-- migraciones; el botón "Reiniciar demo" llama a reset_demo() con la llave de servicio.
-- Todas las personas y negocios son ficticios; los celulares son +57 300 555 01xx.
-- ============================================================================

-- ============================================
-- Persona de demo creada por SQL (handle_new_user le crea el perfil).
-- p_side y p_order quedan en raw_app_meta_data para la lista de la pantalla de inicio:
-- el profesional sin negocio y un cliente se verían iguales en la base. Sin p_side, la
-- cuenta existe pero no sale en esa lista (los clientes de relleno de la Fase 3).
-- ============================================
create or replace function public.create_demo_person(
  p_phone text, p_name text, p_side text, p_order int
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_raw text := ltrim(p_phone, '+');
begin
  if p_side is not null and p_side not in ('owner', 'staff', 'client') then
    raise exception 'Lado de demo desconocido: %', p_side;
  end if;
  insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data,
    raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new,
    email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_raw, now(),
    jsonb_build_object('provider', 'phone', 'providers', jsonb_build_array('phone'),
                       'demo_side', p_side, 'demo_order', p_order),
    '{}', now(), now(), '', '', '', '');
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'phone', v_raw), 'phone', now(), now(), now());
  update public.profiles set full_name = p_name where id = v_id;
  return v_id;
end;
$$;
revoke execute on function public.create_demo_person(text, text, text, int) from public, anon, authenticated;

-- ============================================
-- Fase 3: los clientes del negocio completo (US-005). 26 con cuenta (los 6 de la pantalla de
-- inicio y 20 que no salen ahí, +57 300 555 02xx) y 54 sin cuenta (+57 300 555 03xx; los
-- últimos 14 sin celular). Nombres ficticios armados con dos listas.
-- ============================================
create or replace function public.seed_demo_clients(p_business uuid, p_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_first text[] := array[
    'Alejandro', 'Carlos', 'Daniel', 'David', 'Diego', 'Esteban', 'Felipe', 'Gabriel', 'Jorge', 'José',
    'Juan Pablo', 'Luis', 'Manuel', 'Miguel', 'Nicolás', 'Óscar', 'Ricardo', 'Samuel', 'Tomás', 'Martín',
    'Adriana', 'Ana María', 'Camila', 'Carolina', 'Catalina', 'Diana', 'Gabriela', 'Juliana', 'Lucía',
    'Luisa', 'María José', 'Paula', 'Sara', 'Valeria', 'Verónica', 'Ximena', 'Alejandra', 'Manuela',
    'Andrea', 'Melissa'];
  v_last text[] := array[
    'Rodríguez', 'Martínez', 'García', 'Hernández', 'Ramírez', 'Sánchez', 'Moreno', 'Jiménez', 'Díaz',
    'Ospina', 'Restrepo', 'Cardona', 'Zapata', 'Osorio', 'Quintero', 'Arango', 'Mejía', 'Castaño',
    'Salazar', 'Valencia', 'Rincón', 'Pardo', 'Acosta', 'Bermúdez', 'Duque', 'Giraldo', 'Montoya',
    'Ortiz', 'Aguilar', 'Patiño'];
  v_name text;
  v_phone text;
  v_gender text;
begin
  for i in 1..74 loop
    v_name := v_first[(i - 1) % 40 + 1] || ' ' || v_last[(i * 7 - 1) % 30 + 1];
    v_gender := case when (i - 1) % 40 < 20 then 'male' else 'female' end;
    if i <= 20 then
      v_phone := '+5730055502' || lpad(i::text, 2, '0');
      perform public.create_demo_person(v_phone, v_name, null, null);
      update public.profiles set gender = v_gender where phone = v_phone;
    else
      v_phone := case when i <= 60 then '+573005550' || (280 + i)::text end;
      insert into public.clients (business_id, full_name, phone, gender, created_by)
      values (p_business, v_name, v_phone, v_gender, p_owner);
    end if;
  end loop;

  insert into public.clients (business_id, profile_id, full_name, phone, gender, created_by)
  select p_business, pr.id, pr.full_name, pr.phone, pr.gender, p_owner
  from public.profiles pr
  where pr.phone between '+573005550121' and '+573005550126'
     or pr.phone between '+573005550201' and '+573005550220';
end;
$$;
revoke execute on function public.seed_demo_clients(uuid, uuid) from public, anon, authenticated;

-- ============================================
-- El relleno de una agenda, de 60 días atrás a 21 adelante, dentro del horario de cada
-- profesional (Fase 3 en el negocio completo; Fase 5 en los sencillos, con p_scale menor). Las
-- pasadas tienen la llegada marcada (o están canceladas) y las futuras están pendientes; algunas
-- las reservó un cliente con cuenta. Si una choca con las que ya están, no entra.
-- ============================================
create or replace function public.seed_demo_agenda(p_business uuid, p_scale float8) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_owner uuid;
  v_day date;
  v_start timestamptz;
  v_range record;
  v_at timestamptz;
  v_end timestamptz;
  v_finish timestamptz;
  v_density float8;
  v_service record;
  v_client_id uuid;
  v_client_profile uuid;
  v_guest text;
  v_booked public.booked_by;
  v_creator uuid;
  v_status public.booking_status;
  v_punctuality smallint;
  v_r float8;
  v_guests text[] := array['Andrea', 'Mauricio', 'Fernanda', 'Hernán', 'Claudia', 'Rodrigo'];
begin
  select b.owner_id into v_owner from public.businesses b where b.id = p_business;
  for n in 0..81 loop
    v_day := v_today - 60 + n;
    v_density := p_scale * case when v_day < v_today then 0.7 when v_day <= v_today + 3 then 0.55 else 0.3 end;
    for v_range in
      select wh.staff_id, wh.starts, wh.ends, s.profile_id, s.role
      from public.work_hours wh join public.staff s on s.id = wh.staff_id
      where wh.business_id = p_business and s.is_active and wh.weekday = extract(dow from v_day)
      order by s.position, wh.starts
    loop
      v_at := (v_day + v_range.starts) at time zone 'America/Bogota';
      v_end := (v_day + v_range.ends) at time zone 'America/Bogota';
      while v_at < v_end loop
        if random() >= v_density then
          v_at := v_at + interval '30 minutes';
          continue;
        end if;
        select sv.id, sv.price, coalesce(ss.duration_minutes, sv.duration_minutes) as minutes
          into v_service
        from public.staff_services ss join public.services sv on sv.id = ss.service_id
        where ss.staff_id = v_range.staff_id and sv.is_active
        order by random() limit 1;
        v_finish := v_at + make_interval(mins => v_service.minutes);
        if v_finish > v_end
           or exists (select 1 from public.agenda_blocks k
                      where k.staff_id = v_range.staff_id
                        and k.starts_at < v_finish and k.ends_at > v_at) then
          v_at := v_at + interval '30 minutes';
          continue;
        end if;

        -- Cliente: una ficha al azar, o alguien de paso sin ficha.
        v_guest := null;
        v_client_id := null;
        v_client_profile := null;
        if random() < 0.08 then
          v_guest := v_guests[floor(random() * 6)::int + 1];
        else
          select c.id, c.profile_id into v_client_id, v_client_profile
          from public.clients c where c.business_id = p_business order by random() limit 1;
        end if;

        v_r := random();
        if v_client_profile is not null and v_r < 0.3 then
          v_booked := 'client';
          v_creator := v_client_profile;
        elsif v_range.role = 'owner' or v_r < 0.75 then
          v_booked := 'owner';
          v_creator := v_owner;
        else
          v_booked := 'staff';
          v_creator := v_range.profile_id;
        end if;

        v_status := 'pending';
        v_punctuality := null;
        v_r := random();
        if v_at < v_now then
          if v_r < 0.06 then
            v_status := 'cancelled';
          elsif v_r < 0.11 then
            v_status := 'unsuccessful';
            v_punctuality := 1;
          elsif v_r < 0.2 then
            v_status := 'successful';
            v_punctuality := 3;
          else
            v_status := 'successful';
            v_punctuality := 5;
          end if;
        elsif v_r < 0.04 then
          v_status := 'cancelled';
        end if;

        -- Si choca con una de las de arriba, no entra.
        insert into public.bookings (business_id, staff_id, service_id, client_id, guest_name, starts_at,
          ends_at, price, booked_by, created_by, status, punctuality, punctuality_at, cancelled_at,
          cancelled_by)
        values (p_business, v_range.staff_id, v_service.id, v_client_id, v_guest, v_at, v_finish,
          v_service.price, v_booked, v_creator, v_status, v_punctuality,
          case when v_punctuality is not null then least(v_at + interval '10 minutes', v_now) end,
          case when v_status = 'cancelled' then least(v_at - interval '1 day', v_now) end,
          case when v_status = 'cancelled' then v_creator end)
        on conflict do nothing;

        -- La siguiente, en el próximo cuarto de hora.
        v_at := to_timestamp(ceil(extract(epoch from v_finish) / 900) * 900);
      end loop;
    end loop;
  end loop;
end;
$$;
revoke execute on function public.seed_demo_agenda(uuid, float8) from public, anon, authenticated;

-- ============================================
-- Fase 3: la agenda del negocio completo (US-005). Primero los casos que se muestran: la cita de
-- Mateo ya empezada sin marcar, la de Daniela por calificar, un bloqueo de Camilo, la serie de
-- Sebastián y la de Santiago a unas 2 h 10 min, la única que deja avisos (su recordatorio llega a
-- la bandeja de 5 a 10 minutos después del reinicio). Después, el relleno de seed_demo_agenda.
-- Lo demás se siembra sin avisos.
-- ============================================
create or replace function public.seed_demo_bookings(p_business uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_owner uuid;
  v_camilo record;
  v_julian record;
  v_day date;
  v_start timestamptz;
begin
  select b.owner_id into v_owner from public.businesses b where b.id = p_business;
  select s.id, s.profile_id into v_camilo from public.staff s
    join public.profiles p on p.id = s.profile_id where p.phone = '+573005550111';
  select s.id, s.profile_id into v_julian from public.staff s
    join public.profiles p on p.id = s.profile_id where p.phone = '+573005550112';

  -- Bloqueo de Camilo: el próximo día que trabaja, de 1:00 a 2:00 p. m.
  v_day := v_today + case when extract(dow from v_today + 1) = 0 then 2 else 1 end;
  insert into public.agenda_blocks (business_id, staff_id, starts_at, ends_at, created_by)
  values (p_business, v_camilo.id, (v_day + time '13:00') at time zone 'America/Bogota',
          (v_day + time '14:00') at time zone 'America/Bogota', v_camilo.profile_id);

  -- Mateo: empezó hace 20 minutos con Camilo y nadie ha marcado la llegada.
  v_start := to_timestamp(floor(extract(epoch from v_now - interval '20 minutes') / 300) * 300);
  insert into public.bookings (business_id, staff_id, service_id, client_id, starts_at, ends_at, price,
    booked_by, created_by)
  select p_business, v_camilo.id, sv.id, c.id, v_start, v_start + interval '40 minutes', sv.price,
         'client', c.profile_id
  from public.services sv, public.clients c join public.profiles p on p.id = c.profile_id
  where sv.business_id = p_business and sv.name = 'Corte fade'
    and c.business_id = p_business and p.phone = '+573005550121';

  -- Daniela: el último día con atención antes de hoy, a las 4:00 p. m.; llegó a tiempo y le
  -- falta calificar (seed_demo_reviews la deja sin reseña).
  v_day := v_today - case when extract(dow from v_today - 1) = 0 then 2 else 1 end;
  v_start := (v_day + time '16:00') at time zone 'America/Bogota';
  insert into public.bookings (business_id, staff_id, service_id, client_id, starts_at, ends_at, price,
    booked_by, created_by, status, punctuality, punctuality_at)
  select p_business, v_camilo.id, sv.id, c.id, v_start, v_start + interval '30 minutes', sv.price,
         'client', c.profile_id, 'successful', 5, v_start + interval '5 minutes'
  from public.services sv, public.clients c join public.profiles p on p.id = c.profile_id
  where sv.business_id = p_business and sv.name = 'Corte clásico'
    and c.business_id = p_business and p.phone = '+573005550122';

  -- Santiago: en 2 h 10 min con Julián, agendada por la dueña. Esta sí deja sus avisos.
  v_start := to_timestamp(floor(extract(epoch from v_now + interval '130 minutes') / 300) * 300);
  perform set_config('app.seeding', 'off', true);
  insert into public.bookings (business_id, staff_id, service_id, client_id, starts_at, ends_at, price,
    booked_by, created_by)
  select p_business, v_julian.id, sv.id, c.id, v_start, v_start + interval '30 minutes', sv.price,
         'owner', v_owner
  from public.services sv, public.clients c join public.profiles p on p.id = c.profile_id
  where sv.business_id = p_business and sv.name = 'Corte clásico'
    and c.business_id = p_business and p.phone = '+573005550123';
  perform set_config('app.seeding', 'on', true);

  -- Sebastián (Fase 4, US-022): su corte de cada martes a las 10:00 a. m. con Julián, una serie
  -- de 8 que empezó cinco martes antes de esta semana, así termina antes de los 21 días que llenan
  -- las demás citas (las pruebas buscan días vacíos después). A las que ya pasaron llegó a tiempo.
  -- Si una choca con la de Santiago, no entra.
  v_day := v_today - (extract(dow from v_today)::int + 5) % 7 - 35;
  with serie as (
    insert into public.recurring_bookings (business_id, staff_id, service_id, client_id, weekday,
      start_time, frequency, starts_on, occurrences, created_by)
    select p_business, v_julian.id, sv.id, c.id, 2, time '10:00', 'weekly', v_day, 8, v_owner
    from public.services sv, public.clients c join public.profiles p on p.id = c.profile_id
    where sv.business_id = p_business and sv.name = 'Corte clásico'
      and c.business_id = p_business and p.phone = '+573005550125'
    returning id, service_id, client_id
  )
  insert into public.bookings (business_id, staff_id, service_id, client_id, starts_at, ends_at, price,
    booked_by, created_by, status, punctuality, punctuality_at, recurring_id)
  select p_business, v_julian.id, serie.service_id, serie.client_id, x.t, x.t + interval '30 minutes',
         sv.price, 'owner', v_owner,
         case when x.t < v_now then 'successful' else 'pending' end::public.booking_status,
         case when x.t < v_now then 5 end,
         case when x.t < v_now then least(x.t + interval '5 minutes', v_now) end,
         serie.id
  from serie
  join public.services sv on sv.id = serie.service_id
  cross join lateral (
    select ((v_day + 7 * w) + time '10:00') at time zone 'America/Bogota' as t
    from generate_series(0, 7) w
  ) x
  on conflict do nothing;

  perform public.seed_demo_agenda(p_business, 1);
end;
$$;
revoke execute on function public.seed_demo_bookings(uuid) from public, anon, authenticated;

-- ============================================
-- Fase 5: los clientes de un negocio sencillo. 8 con cuenta, al azar entre los 20 que no salen en
-- la pantalla de inicio (así los 6 de la demo solo tienen ficha en La Clásica), y 6 sin cuenta.
-- ============================================
create or replace function public.seed_demo_simple_clients(p_business uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  select b.owner_id into v_owner from public.businesses b where b.id = p_business;
  insert into public.clients (business_id, profile_id, full_name, phone, gender, created_by)
  select p_business, pr.id, pr.full_name, pr.phone, pr.gender, v_owner
  from public.profiles pr
  where pr.phone between '+573005550201' and '+573005550220'
  order by random() limit 8;

  insert into public.clients (business_id, full_name, phone, gender, created_by)
  select p_business, c.name, c.phone, c.gender, v_owner
  from (values ('Liliana Forero', '+573005550401', 'female'), ('Hugo Benavides', '+573005550402', 'male'),
               ('Marcela Ibáñez', '+573005550403', 'female'), ('Jairo Londoño', '+573005550404', 'male'),
               ('Gloria Cifuentes', null, 'female'), ('Wilson Becerra', null, 'male')
  ) as c(name, phone, gender);
end;
$$;
revoke execute on function public.seed_demo_simple_clients(uuid) from public, anon, authenticated;

-- ============================================
-- Fase 5: reseñas de las citas efectivas de clientes con cuenta (US-030). Las de los 6 clientes
-- de la demo, todas menos la de Daniela por calificar; las de los demás, dos de cada tres. Casi
-- todas de 4 y 5 estrellas; algunas con comentario. Quedan escritas unas horas después de la cita.
-- ============================================
create or replace function public.seed_demo_reviews() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_daniela_at timestamptz;
  v_comments text[] := array[
    'Muy buena atención, llegué y me atendieron a la hora.',
    'Quedé feliz con el resultado. Vuelvo seguro.',
    'Excelente servicio y el lugar muy limpio.',
    'Buen trabajo, aunque me tocó esperar un poco.',
    'Me explicaron todo y quedó como lo pedí.',
    'Súper amables. Recomendado.',
    'El resultado bien, la atención podría mejorar.',
    'Puntuales y muy profesionales.',
    'Me encantó, el mejor de la zona.',
    'Todo bien, precio justo.'];
begin
  -- La de Daniela por calificar (seed_demo_bookings): el último día con atención antes de hoy.
  v_daniela_at := ((v_today - case when extract(dow from v_today - 1) = 0 then 2 else 1 end)
                   + time '16:00') at time zone 'America/Bogota';
  with candidates as (
    select b.id, b.ends_at, c.profile_id,
           pr.phone between '+573005550121' and '+573005550126' as is_demo,
           random() as r1, random() as r2, random() as r3, random() as r4
    from public.bookings b
    join public.clients c on c.id = b.client_id
    join public.profiles pr on pr.id = c.profile_id
    where b.status = 'successful'
      and not (pr.phone = '+573005550122' and b.starts_at = v_daniela_at)
    order by b.starts_at, b.id
  )
  insert into public.reviews (booking_id, author_id, attention, quality, comment, created_at)
  select k.id, k.profile_id,
         case when k.r1 < 0.6 then 5 when k.r1 < 0.88 then 4 when k.r1 < 0.96 then 3
              when k.r1 < 0.99 then 2 else 1 end,
         case when k.r2 < 0.55 then 5 when k.r2 < 0.85 then 4 when k.r2 < 0.95 then 3
              when k.r2 < 0.99 then 2 else 1 end,
         case when k.r3 < 0.45 then v_comments[floor(k.r3 / 0.45 * 10)::int + 1] end,
         least(k.ends_at + make_interval(hours => 1 + floor(k.r4 * 20)::int), now())
  from candidates k
  where k.is_demo or k.r4 < 0.67;
end;
$$;
revoke execute on function public.seed_demo_reviews() from public, anon, authenticated;

-- ============================================
-- Fase 5: seguidores. Los clientes de la demo siguen uno o dos negocios (Sebastián, ninguno); los
-- demás con cuenta siguen La Clásica con probabilidad 0,6 y cada negocio sencillo con 0,3.
-- ============================================
create or replace function public.seed_demo_follows() returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.follows (profile_id, business_id)
  select pr.id, b.id
  from (values
    ('+573005550121', 'barberia-la-clasica'), ('+573005550121', 'barberia-norte-93'),
    ('+573005550122', 'unas-y-arte-spa'), ('+573005550122', 'salon-aurora'),
    ('+573005550123', 'barberia-la-clasica'),
    ('+573005550124', 'salon-aurora'), ('+573005550124', 'spa-raices'),
    ('+573005550126', 'unas-y-arte-spa')
  ) as f(phone, slug)
  join public.profiles pr on pr.phone = f.phone
  join public.businesses b on b.slug = f.slug;

  insert into public.follows (profile_id, business_id)
  select k.profile_id, k.business_id
  from (select pr.id as profile_id, b.id as business_id, b.slug, random() as r
        from public.profiles pr cross join public.businesses b
        where pr.phone between '+573005550201' and '+573005550220'
        order by pr.phone, b.slug) k
  where k.r < case when k.slug = 'barberia-la-clasica' then 0.6 else 0.3 end;
end;
$$;
revoke execute on function public.seed_demo_follows() from public, anon, authenticated;

-- ============================================
-- Fase 5: promociones y combos de cada negocio: activos (con fecha de fin o sin ella), uno
-- inactivo y uno vencido, que no salen en la app de clientes. Las imágenes son las muestras.
-- ============================================
create or replace function public.seed_demo_promotions() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
begin
  insert into public.promotions (business_id, kind, name, description, price, discount_pct, ends_on,
    image_url, is_active)
  select b.id, p.kind, p.name, p.description, p.price, p.discount, v_today + p.ends_in,
         '/demo/muestras/' || b.kind || '-' || p.image || '.svg', p.active
  from (values
    ('barberia-la-clasica', 'promo', 'Corte fade entre semana', 'De lunes a jueves, antes de las 3:00 p. m.', 24000, 20, 30, 1, true),
    ('barberia-la-clasica', 'combo', 'Corte, barba y cejas', 'El servicio completo a mejor precio.', 40000, null, null, 2, true),
    ('barberia-la-clasica', 'promo', 'Cejas a mitad de precio', 'Con cualquier corte.', 4000, 50, 20, 4, false),
    ('barberia-la-clasica', 'promo', 'Barba de fin de mes', 'Arreglo de barba con toalla caliente.', 17000, 23, -3, 3, true),
    ('unas-y-arte-spa', 'promo', 'Semipermanente de martes', 'Manicure semipermanente los martes.', 36000, 20, 25, 1, true),
    ('unas-y-arte-spa', 'combo', 'Manos y pies', 'Manicure tradicional y pedicure spa.', 58000, null, null, 4, true),
    ('unas-y-arte-spa', 'promo', 'Pedicure de temporada', 'Pedicure spa con descuento.', 32000, 20, -5, 3, true),
    ('salon-aurora', 'promo', 'Cepillado entre semana', 'De lunes a miércoles.', 24000, 20, 15, 2, true),
    ('salon-aurora', 'combo', 'Corte y cepillado', 'Corte de dama con cepillado.', 58000, null, null, 1, true),
    ('salon-aurora', 'promo', 'Tinte de temporada', 'Tinte completo con descuento.', 72000, 20, 40, 4, false),
    ('barberia-norte-93', 'promo', 'Fade del viernes', 'Corte fade los viernes.', 27000, 15, 20, 3, true),
    ('barberia-norte-93', 'combo', 'Corte y barba', 'Corte clásico y arreglo de barba.', 40000, null, null, 2, true),
    ('barberia-norte-93', 'promo', 'Barba de aniversario', 'Arreglo de barba con descuento.', 12000, 33, -10, 4, true),
    ('spa-raices', 'promo', 'Masaje relajante de domingo', 'Los domingos, masaje de 60 minutos.', 72000, 20, 45, 1, true),
    ('spa-raices', 'combo', 'Masaje y facial', 'Masaje relajante y facial hidratante.', 140000, null, null, 3, true),
    ('spa-raices', 'promo', 'Piedras calientes', 'Masaje con piedras calientes.', 96000, 20, 10, 2, false)
  ) as p(slug, kind, name, description, price, discount, ends_in, image, active)
  join public.businesses b on b.slug = p.slug;
end;
$$;
revoke execute on function public.seed_demo_promotions() from public, anon, authenticated;

-- ============================================
-- Oleada 4 (Fase 7): el dinero del negocio completo (Tech Spec O4.5). Sin random(): no cambia
-- nada de lo sembrado antes. En orden:
-- 1. Sofía con comisión del 40 % y un precio propio (Limpieza facial a $ 50.000).
-- 2. Un cliente bloqueado (sin cuenta ni celular) y una serie quincenal de Sofía, para que las
--    dos listas de Configurar no estén vacías. Sus citas quitan las del relleno que caen encima
--    (todavía no hay facturas; la hora se elige para no tocar las que tienen reseña).
-- 3. Camilo con dos citas empezadas sin marcar: la de Mateo y la última de antes de hoy que no
--    tiene reseña (no la de Daniela, que falta calificar).
-- 4. Las citas efectivas de las últimas dos semanas, facturadas (una de cada tres en Banco, las
--    demás en Efectivo) con la comisión de cada profesional; la penúltima, anulada.
-- 5. Un pago a Julián el sábado de la semana pasada, por sus facturas de antes de esta semana.
-- 6. Cinco gastos del mes.
-- ============================================
create or replace function public.seed_demo_money(p_business uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_monday date := (now() at time zone 'America/Bogota')::date
                   - (extract(dow from (now() at time zone 'America/Bogota')::date)::int + 6) % 7;
  v_owner uuid;
  v_efectivo uuid;
  v_banco uuid;
  v_sofia uuid;
  v_julian uuid;
  v_camilo uuid;
  v_day date;
  v_time time;
  v_series record;
  v_payment uuid;
  v_ids uuid[];
  v_amount bigint;
begin
  select b.owner_id into v_owner from public.businesses b where b.id = p_business;
  select pm.id into v_efectivo from public.payment_methods pm
    where pm.business_id = p_business and pm.name = 'Efectivo';
  select pm.id into v_banco from public.payment_methods pm
    where pm.business_id = p_business and pm.name = 'Banco';
  select s.id into v_camilo from public.staff s join public.profiles p on p.id = s.profile_id
    where p.phone = '+573005550111';
  select s.id into v_julian from public.staff s join public.profiles p on p.id = s.profile_id
    where p.phone = '+573005550112';
  select s.id into v_sofia from public.staff s join public.profiles p on p.id = s.profile_id
    where p.phone = '+573005550113';

  -- 1. Precio y comisión de Sofía.
  update public.staff_services set commission_pct = 40 where staff_id = v_sofia;
  update public.staff_services ss set price = 50000
  from public.services sv
  where ss.service_id = sv.id and ss.staff_id = v_sofia and sv.name = 'Limpieza facial';

  -- 2. Cliente bloqueado y serie quincenal: el próximo día entre semana desde mañana, con la
  --    primera dos semanas antes (ya pasó y llegó a tiempo). Las tres caen dentro de los 21 días
  --    que llena el relleno (las pruebas buscan días vacíos después). La hora es la más tarde, de
  --    4:30 p. m. hacia atrás, en que ese día pasado no hay una cita con reseña (esas se quedan).
  update public.clients set is_blocked = true
  where id = (select c.id from public.clients c
              where c.business_id = p_business and c.profile_id is null and c.phone is null
              order by c.full_name desc limit 1);

  v_day := v_today + 1;
  while extract(dow from v_day) not between 1 and 5 loop
    v_day := v_day + 1;
  end loop;
  select t::time into v_time
  from generate_series(timestamp '2000-01-01 16:30', timestamp '2000-01-01 09:00', interval '-30 minutes') t
  where not exists (
    select 1 from public.bookings b join public.reviews r on r.booking_id = b.id
    where b.staff_id = v_sofia
      and b.starts_at < (((v_day - 14) + t::time + interval '30 minutes') at time zone 'America/Bogota')
      and b.ends_at > (((v_day - 14) + t::time) at time zone 'America/Bogota'))
  order by t desc limit 1;
  with r as (
    insert into public.recurring_bookings (business_id, staff_id, service_id, client_id, weekday,
      start_time, frequency, starts_on, occurrences, created_by)
    select p_business, v_sofia, sv.id,
           (select c.id from public.clients c
            where c.business_id = p_business and c.profile_id is null and c.phone is not null
            order by c.full_name limit 1),
           extract(dow from v_day)::smallint, v_time, 'biweekly', v_day - 14, 3, v_owner
    from public.services sv where sv.business_id = p_business and sv.name = 'Mascarilla facial'
    returning id, service_id, client_id
  )
  select r.id, r.service_id, r.client_id, sv.price into v_series
  from r join public.services sv on sv.id = r.service_id;

  delete from public.bookings b
  where b.staff_id = v_sofia and b.recurring_id is null
    and not exists (select 1 from public.reviews r where r.booking_id = b.id)
    and exists (select 1 from (values (v_day - 14), (v_day), (v_day + 14)) d(day)
                where b.starts_at < ((d.day + v_time + interval '30 minutes') at time zone 'America/Bogota')
                  and b.ends_at > ((d.day + v_time) at time zone 'America/Bogota'));
  insert into public.bookings (business_id, staff_id, service_id, client_id, starts_at, ends_at, price,
    booked_by, created_by, status, punctuality, punctuality_at, recurring_id)
  select p_business, v_sofia, v_series.service_id, v_series.client_id, x.t, x.t + interval '30 minutes',
         v_series.price, 'owner', v_owner,
         case when x.t < v_now then 'successful' else 'pending' end::public.booking_status,
         case when x.t < v_now then 5 end,
         case when x.t < v_now then x.t + interval '5 minutes' end,
         v_series.id
  from (select ((v_day + 14 * w) + v_time) at time zone 'America/Bogota' as t
        from generate_series(-1, 1) w) x
  on conflict do nothing;

  -- 3. La segunda cita de Camilo sin marcar.
  update public.bookings set punctuality = null
  where id = (select b.id from public.bookings b
              left join public.clients c on c.id = b.client_id
              left join public.profiles p on p.id = c.profile_id
              where b.staff_id = v_camilo and b.status = 'successful'
                and b.starts_at < (v_today::timestamp at time zone 'America/Bogota')
                and p.phone is distinct from '+573005550122'
                and not exists (select 1 from public.reviews r where r.booking_id = b.id)
              order by b.starts_at desc limit 1);

  -- 4. Facturas de las citas efectivas de las últimas dos semanas, una por cita.
  with src as (
    select b.id as booking_id, b.client_id, b.guest_name, b.service_id, b.staff_id, b.price,
           b.starts_at, row_number() over (order by b.starts_at, b.id) as rn
    from public.bookings b
    where b.business_id = p_business and b.status = 'successful' and b.starts_at < v_now
      and b.starts_at >= ((v_today - 14)::timestamp at time zone 'America/Bogota')
  ),
  inv as (
    insert into public.invoices (business_id, number, client_id, guest_name, booking_id,
      payment_method_id, issued_on, total, created_by, created_at, updated_at)
    select p_business, src.rn, src.client_id, case when src.client_id is null then src.guest_name end,
           src.booking_id, case when src.rn % 3 = 0 then v_banco else v_efectivo end,
           (src.starts_at at time zone 'America/Bogota')::date, src.price, v_owner,
           least(src.starts_at + interval '45 minutes', v_now),
           least(src.starts_at + interval '45 minutes', v_now)
    from src
    returning id, booking_id
  )
  insert into public.invoice_items (invoice_id, business_id, service_id, staff_id, price, commission_pct,
    position)
  select inv.id, p_business, src.service_id, src.staff_id, src.price,
         public.staff_commission(src.staff_id, src.service_id), 1
  from inv join src on src.booking_id = inv.booking_id;

  update public.invoices i
  set status = 'void', voided_by = v_owner, voided_at = least(i.created_at + interval '10 minutes', v_now)
  where i.id = (select x.id from public.invoices x where x.business_id = p_business
                order by x.number desc offset 1 limit 1);

  -- 5. El pago a Julián.
  select array_agg(ii.id), sum(ii.commission) into v_ids, v_amount
  from public.invoice_items ii
  join public.invoices i on i.id = ii.invoice_id and i.status = 'paid'
  where ii.staff_id = v_julian and i.issued_on < v_monday;
  if coalesce(v_amount, 0) > 0 then
    insert into public.staff_payments (business_id, staff_id, amount, payment_method_id, paid_on, note,
      created_by, created_at)
    values (p_business, v_julian, v_amount, v_efectivo, v_monday - 2, 'Comisiones de la semana',
      v_owner, ((v_monday - 2) + time '21:00') at time zone 'America/Bogota')
    returning id into v_payment;
    update public.invoice_items set staff_payment_id = v_payment where id = any (v_ids);
  end if;

  -- 6. Gastos del mes (hoy si el mes apenas empieza).
  insert into public.expenses (business_id, name, category, paid_on, amount, payment_method_id,
    created_by)
  select p_business, e.name, e.category::public.expense_category,
         least(date_trunc('month', v_today)::date + e.offset_days, v_today), e.amount,
         case e.method when 'Banco' then v_banco else v_efectivo end, v_owner
  from (values
    ('Arriendo del local', 'rent', 0, 2500000, 'Banco'),
    ('Energía, agua e internet', 'utilities', 4, 380000, 'Banco'),
    ('Insumos de barbería', 'supplies', 6, 290000, 'Efectivo'),
    ('Publicidad en redes', 'advertising', 9, 150000, 'Banco'),
    ('Mantenimiento de las sillas', 'maintenance', 12, 120000, 'Efectivo')
  ) as e(name, category, offset_days, amount, method);
end;
$$;
revoke execute on function public.seed_demo_money(uuid) from public, anon, authenticated;

-- ============================================
-- Oleada 5: los meses de antes del negocio completo, para que los informes (Mes, Año y sus
-- variaciones) y Estadísticas tengan números (O5.5).
-- 1. Facturas pagadas sin cita (clientes de paso, sin ficha) de lunes a sábado, desde el primer
--    día de hace 4 meses hasta 15 días atrás: no tocan las dos semanas que factura
--    seed_demo_money. Camilo no sale en ellas desde el mes de hace 14 días, para que su "Total
--    comisiones" de esos meses siga siendo lo que tiene pendiente (prueba del liquidador). Toman
--    los números más bajos: las de seed_demo_money corren hacia arriba.
-- 2. Un pago a cada profesional al final de cada uno de esos meses, que las cubre: el liquidador
--    queda igual.
-- 3. Gastos fijos de esos meses, sin tocar el mes de hoy.
-- 4. Visitas al perfil de los últimos 90 días, más los fines de semana.
-- Las cantidades salen de hashtext y no de random(): no mueven la secuencia de setseed y dan lo
-- mismo en cada reinicio del mismo día.
-- ============================================
create or replace function public.seed_demo_reports(p_business uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_start date := (date_trunc('month', (now() at time zone 'America/Bogota')::date)
                   - interval '4 months')::date;
  v_end date := (now() at time zone 'America/Bogota')::date - 15;
  v_recent date := date_trunc('month', (now() at time zone 'America/Bogota')::date - 14)::date;
  v_owner uuid;
  v_owner_staff uuid;
  v_efectivo uuid;
  v_banco uuid;
  v_camilo uuid;
  v_julian uuid;
  v_sofia uuid;
  v_old int;
  v_group record;
  v_payment uuid;
  v_paid_on date;
  v_guests text[] := array['Carlos Ramírez', 'Andrea Molina', 'Luis Fernando Ortiz',
    'Juliana Castaño', 'Diego Salazar', 'Camila Restrepo', 'Jorge Patiño', 'Valeria Ospina',
    'Ricardo Mejía', 'Paula Quintero', 'Esteban Arango', 'Natalia Gil', 'Óscar Beltrán',
    'Manuela Rincón', 'Hernán Duque', 'Lina Cifuentes'];
begin
  select b.owner_id into v_owner from public.businesses b where b.id = p_business;
  select s.id into v_owner_staff from public.staff s
    where s.business_id = p_business and s.role = 'owner';
  select pm.id into v_efectivo from public.payment_methods pm
    where pm.business_id = p_business and pm.name = 'Efectivo';
  select pm.id into v_banco from public.payment_methods pm
    where pm.business_id = p_business and pm.name = 'Banco';
  select s.id into v_camilo from public.staff s join public.profiles p on p.id = s.profile_id
    where p.phone = '+573005550111';
  select s.id into v_julian from public.staff s join public.profiles p on p.id = s.profile_id
    where p.phone = '+573005550112';
  select s.id into v_sofia from public.staff s join public.profiles p on p.id = s.profile_id
    where p.phone = '+573005550113';

  -- 1. Las facturas de seed_demo_money corren lejos para dejarles los números bajos a estas.
  update public.invoices set number = number + 100000 where business_id = p_business;

  with days as (
    select d::date as day,
           4 + abs(hashtext('dia ' || d::date)::bigint) % 3
             + case when extract(dow from d) = 6 then 2 else 0 end as n
    from generate_series(v_start, v_end, interval '1 day') d
    where extract(dow from d) between 1 and 6
  ),
  slots as (
    select ds.day, k, abs(hashtext(ds.day || ' ' || k)::bigint) as h
    from days ds cross join lateral generate_series(1, ds.n) k
  ),
  picked as (
    select sl.day, sl.k, sl.h,
           case sl.h % 7
             when 0 then v_owner_staff
             when 1 then case when sl.day >= v_recent then v_julian else v_camilo end
             when 2 then case when sl.day >= v_recent then v_sofia else v_camilo end
             when 3 then v_julian
             when 4 then v_julian
             else v_sofia
           end as staff_id
    from slots sl
  ),
  src as (
    select pk.day, pk.k, pk.h, pk.staff_id, x.service_id, x.price,
           row_number() over (order by pk.day, pk.k) as rn
    from picked pk
    cross join lateral (
      select t.service_id, t.price
      from (select ss.service_id, coalesce(ss.price, sv.price) as price,
                   row_number() over (order by sv.position, sv.name) - 1 as i,
                   count(*) over () as c
            from public.staff_services ss
            join public.services sv on sv.id = ss.service_id and sv.is_active
            where ss.staff_id = pk.staff_id) t
      where t.i = (pk.h / 7) % t.c
    ) x
  ),
  inv as (
    insert into public.invoices (business_id, number, guest_name, payment_method_id, issued_on, total,
      created_by, created_at, updated_at)
    select p_business, src.rn, v_guests[1 + (src.h / 49) % array_length(v_guests, 1)],
           case when (src.h / 13) % 3 = 0 then v_banco else v_efectivo end,
           src.day, src.price, v_owner,
           ((src.day + time '09:00' + src.k * interval '55 minutes') at time zone 'America/Bogota'),
           ((src.day + time '09:00' + src.k * interval '55 minutes') at time zone 'America/Bogota')
    from src
    returning id, number
  )
  insert into public.invoice_items (invoice_id, business_id, service_id, staff_id, price, commission_pct,
    position)
  select inv.id, p_business, src.service_id, src.staff_id, src.price,
         public.staff_commission(src.staff_id, src.service_id), 1
  from inv join src on src.rn = inv.number;

  select count(*) into v_old from public.invoices i
  where i.business_id = p_business and i.number < 100000;
  update public.invoices set number = number - 100000 + v_old
  where business_id = p_business and number > 100000;

  -- 2. El pago de cada mes a cada profesional (el dueño no se paga a sí mismo).
  for v_group in
    select ii.staff_id, date_trunc('month', i.issued_on)::date as month,
           sum(ii.commission) as amount, array_agg(ii.id) as ids
    from public.invoice_items ii
    join public.invoices i on i.id = ii.invoice_id and i.status = 'paid'
    join public.staff s on s.id = ii.staff_id and s.role = 'staff'
    where i.business_id = p_business and i.booking_id is null and i.issued_on <= v_end
      and ii.staff_payment_id is null
    group by ii.staff_id, date_trunc('month', i.issued_on)
    having sum(ii.commission) > 0
    order by 2, 1
  loop
    v_paid_on := least((v_group.month + interval '1 month' - interval '1 day')::date, v_end);
    insert into public.staff_payments (business_id, staff_id, amount, payment_method_id, paid_on, note,
      created_by, created_at)
    values (p_business, v_group.staff_id, v_group.amount, v_efectivo, v_paid_on, 'Comisiones del mes',
      v_owner, (v_paid_on + time '21:00') at time zone 'America/Bogota')
    returning id into v_payment;
    update public.invoice_items set staff_payment_id = v_payment where id = any (v_group.ids);
  end loop;

  -- 3. Gastos fijos de los meses de antes (el mes de hoy ya los tiene).
  insert into public.expenses (business_id, name, category, paid_on, amount, payment_method_id,
    created_by)
  select p_business, e.name, e.category::public.expense_category, m::date + e.offset_days,
         e.amount + (abs(hashtext(e.name || m::date)::bigint) % 5) * e.step,
         case e.method when 'Banco' then v_banco else v_efectivo end, v_owner
  from generate_series(v_start, date_trunc('month', v_today)::date - interval '1 month',
                       interval '1 month') m
  cross join (values
    ('Arriendo del local', 'rent', 0, 2500000, 0, 'Banco'),
    ('Energía, agua e internet', 'utilities', 4, 340000, 15000, 'Banco'),
    ('Insumos de barbería', 'supplies', 6, 230000, 20000, 'Efectivo'),
    ('Mantenimiento de las sillas', 'maintenance', 12, 90000, 10000, 'Efectivo')
  ) as e(name, category, offset_days, amount, step, method);

  -- 4. Visitas al perfil: de 3 a 7 cada día, y 4 más los sábados y domingos.
  insert into public.profile_visits (business_id, visited_at)
  select p_business,
         ((d::date + time '08:00' + (abs(hashtext('visita ' || d::date || ' ' || k)::bigint) % 720)
            * interval '1 minute') at time zone 'America/Bogota')
  from generate_series(v_today - 90, v_today - 1, interval '1 day') d
  cross join lateral generate_series(
    1, 3 + (abs(hashtext('visitas ' || d::date)::bigint) % 5)::int
         + case when extract(dow from d) in (0, 6) then 4 else 0 end) k;
end;
$$;
revoke execute on function public.seed_demo_reports(uuid) from public, anon, authenticated;

-- ============================================
-- seed_demo(): todos los datos de la demo.
-- Fase 1: personas, negocios, horarios, catálogo y servicios por profesional.
-- Fase 3: clientes y agenda del negocio completo.
-- Fase 5: logos y portadas, clientes y agenda de los negocios sencillos, reseñas, seguidores y
-- promociones (en ese orden, para que la secuencia al azar de La Clásica no cambie).
-- Oleada 4: el dinero del negocio completo, al final (los métodos de pago de cada negocio los
-- crea payment_methods_defaults).
-- Oleada 5: los meses de antes del negocio completo, para los informes y Estadísticas.
-- ============================================
create or replace function public.seed_demo() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_clasica uuid;
  v_valentina_staff uuid;
  v_camilo_staff uuid;
  v_julian_staff uuid;
  v_sofia_staff uuid;
  v_simple uuid;
begin
  -- Personas. Orden de la pantalla de inicio: el dueño del negocio completo primero.
  perform public.create_demo_person(p.phone, p.name, p.side, p.ord)
  from (values
    ('+573005550101', 'Valentina Ríos', 'owner', 1),
    ('+573005550102', 'Andrés Castillo', 'owner', 2),
    ('+573005550103', 'Paola Herrera', 'owner', 3),
    ('+573005550104', 'Felipe Murillo', 'owner', 4),
    ('+573005550105', 'Natalia Vargas', 'owner', 5),
    ('+573005550111', 'Camilo Rojas', 'staff', 11),
    ('+573005550112', 'Julián Torres', 'staff', 12),
    ('+573005550113', 'Sofía Martínez', 'staff', 13),
    ('+573005550114', 'Laura Méndez', 'staff', 14),
    ('+573005550121', 'Mateo Gómez', 'client', 21),
    ('+573005550122', 'Daniela Ruiz', 'client', 22),
    ('+573005550123', 'Santiago López', 'client', 23),
    ('+573005550124', 'Mariana Suárez', 'client', 24),
    ('+573005550125', 'Sebastián Peña', 'client', 25),
    ('+573005550126', 'Isabella Cárdenas', 'client', 26)
  ) as p(phone, name, side, ord);

  update public.profiles pr set gender = g.gender
  from (values
    ('+573005550101', 'female'), ('+573005550102', 'male'), ('+573005550103', 'female'),
    ('+573005550104', 'male'), ('+573005550105', 'female'), ('+573005550111', 'male'),
    ('+573005550112', 'male'), ('+573005550113', 'female'), ('+573005550114', 'female'),
    ('+573005550121', 'male'), ('+573005550122', 'female'), ('+573005550123', 'male'),
    ('+573005550124', 'female'), ('+573005550125', 'male'), ('+573005550126', 'female')
  ) as g(phone, gender)
  where pr.phone = g.phone;

  -- Negocios (barrios de Bogotá). businesses_defaults crea los permisos del equipo, el código
  -- de vinculación y la fila del dueño en staff.
  insert into public.businesses (owner_id, name, slug, kind, address, neighborhood, lat, lng, whatsapp)
  select pr.id, b.name, b.slug, b.kind, b.address, b.neighborhood, b.lat, b.lng, b.owner_phone
  from (values
    ('+573005550101', 'Barbería La Clásica', 'barberia-la-clasica', 'barbershop',
     'Calle 57 # 9-23', 'Chapinero', 4.6440, -74.0640),
    ('+573005550102', 'Uñas y Arte Spa', 'unas-y-arte-spa', 'nail_spa',
     'Carrera 6 # 119-24', 'Usaquén', 4.6960, -74.0310),
    ('+573005550103', 'Salón Aurora', 'salon-aurora', 'salon',
     'Calle 39 # 17-40', 'Teusaquillo', 4.6280, -74.0700),
    ('+573005550104', 'Barbería Norte 93', 'barberia-norte-93', 'barbershop',
     'Calle 93 # 13-45', 'Chicó', 4.6770, -74.0490),
    ('+573005550105', 'Spa Raíces', 'spa-raices', 'spa',
     'Calle 11 # 3-50', 'La Candelaria', 4.5970, -74.0720)
  ) as b(owner_phone, name, slug, kind, address, neighborhood, lat, lng)
  join public.profiles pr on pr.phone = b.owner_phone;

  select b.id into v_clasica from public.businesses b where b.slug = 'barberia-la-clasica';

  -- Equipo del negocio completo (Laura queda sin negocio para vincularse con el código).
  insert into public.staff (business_id, profile_id, role, display_name, position)
  select v_clasica, pr.id, 'staff', s.display_name, s.pos
  from (values ('+573005550111', 'Camilo', 1), ('+573005550112', 'Julián', 2),
               ('+573005550113', 'Sofía', 3)) as s(phone, display_name, pos)
  join public.profiles pr on pr.phone = s.phone;

  select s.id into v_valentina_staff from public.staff s where s.business_id = v_clasica and s.role = 'owner';
  select s.id into v_camilo_staff from public.staff s join public.profiles p on p.id = s.profile_id
    where p.phone = '+573005550111';
  select s.id into v_julian_staff from public.staff s join public.profiles p on p.id = s.profile_id
    where p.phone = '+573005550112';
  select s.id into v_sofia_staff from public.staff s join public.profiles p on p.id = s.profile_id
    where p.phone = '+573005550113';

  -- Horario de los negocios (0 = domingo): todos de lunes a sábado; Spa Raíces también el domingo.
  insert into public.work_hours (business_id, staff_id, weekday, starts, ends)
  select b.id, null, d, h.starts::time, h.ends::time
  from (values
    ('barberia-la-clasica', '09:00', '19:00'),
    ('unas-y-arte-spa', '10:00', '19:00'),
    ('salon-aurora', '08:00', '18:00'),
    ('barberia-norte-93', '09:00', '20:00'),
    ('spa-raices', '09:00', '18:00')
  ) as h(slug, starts, ends)
  join public.businesses b on b.slug = h.slug
  cross join generate_series(1, 6) as d;
  insert into public.work_hours (business_id, staff_id, weekday, starts, ends)
  select b.id, null, 0, '10:00', '16:00' from public.businesses b where b.slug = 'spa-raices';

  -- Horario de cada profesional del negocio completo (dentro del horario del negocio).
  insert into public.work_hours (business_id, staff_id, weekday, starts, ends)
  select v_clasica, w.staff_id, d, w.starts::time, w.ends::time
  from (values
    (v_valentina_staff, 1, 5, '09:00', '13:00'),
    (v_camilo_staff, 1, 6, '09:00', '19:00'),
    (v_julian_staff, 2, 6, '10:00', '13:00'),
    (v_julian_staff, 2, 6, '14:00', '19:00'),
    (v_sofia_staff, 1, 5, '09:00', '17:00')
  ) as w(staff_id, first_day, last_day, starts, ends)
  cross join lateral generate_series(w.first_day, w.last_day) as d;

  -- En los negocios sencillos, el dueño atiende en todo el horario del negocio.
  insert into public.work_hours (business_id, staff_id, weekday, starts, ends)
  select wh.business_id, s.id, wh.weekday, wh.starts, wh.ends
  from public.work_hours wh
  join public.staff s on s.business_id = wh.business_id and s.role = 'owner'
  where wh.staff_id is null and wh.business_id <> v_clasica;

  -- Categorías de los cinco negocios.
  insert into public.service_categories (business_id, name, position)
  select b.id, c.name, c.pos
  from (values
    ('barberia-la-clasica', 'Cortes', 1),
    ('barberia-la-clasica', 'Barba', 2),
    ('barberia-la-clasica', 'Corte y barba', 3),
    ('barberia-la-clasica', 'Afeitado', 4),
    ('barberia-la-clasica', 'Cejas', 5),
    ('barberia-la-clasica', 'Diseños', 6),
    ('barberia-la-clasica', 'Color', 7),
    ('barberia-la-clasica', 'Tratamientos', 8),
    ('barberia-la-clasica', 'Peinados', 9),
    ('unas-y-arte-spa', 'Manos', 1),
    ('unas-y-arte-spa', 'Pies', 2),
    ('salon-aurora', 'Cabello', 1),
    ('salon-aurora', 'Color', 2),
    ('barberia-norte-93', 'Cortes', 1),
    ('barberia-norte-93', 'Barba', 2),
    ('spa-raices', 'Masajes', 1),
    ('spa-raices', 'Faciales', 2)
  ) as c(slug, name, pos)
  join public.businesses b on b.slug = c.slug;

  -- Servicios: 25 en el negocio completo, pocos en los sencillos. Precios en pesos.
  insert into public.services (business_id, category_id, name, audience, description, duration_minutes,
    price_type, price, price_to, position)
  select b.id, sc.id, s.name, s.audience, s.description, s.minutes, s.price_type::public.price_type,
         s.price, s.price_to, s.pos
  from (values
    ('barberia-la-clasica', 'Cortes', 'Corte clásico', 'male', 'Tijera y máquina, con lavado y peinado.', 30, 'fixed', 25000, null::int, 1),
    ('barberia-la-clasica', 'Cortes', 'Corte fade', 'male', 'Degradado a ras con máquina y acabado a navaja.', 40, 'fixed', 30000, null, 2),
    ('barberia-la-clasica', 'Cortes', 'Corte con tijera', 'unisex', 'Todo a tijera, para cabello largo o medio.', 45, 'fixed', 32000, null, 3),
    ('barberia-la-clasica', 'Cortes', 'Corte infantil', 'unisex', 'Para niños hasta 12 años.', 30, 'fixed', 20000, null, 4),
    ('barberia-la-clasica', 'Cortes', 'Rapado', 'male', 'Máquina a un solo número.', 20, 'fixed', 15000, null, 5),
    ('barberia-la-clasica', 'Barba', 'Arreglo de barba', 'male', 'Recorte y forma con máquina y tijera.', 20, 'fixed', 15000, null, 1),
    ('barberia-la-clasica', 'Barba', 'Barba con toalla caliente', 'male', 'Arreglo con toalla caliente y aceite.', 30, 'fixed', 22000, null, 2),
    ('barberia-la-clasica', 'Barba', 'Perfilado de barba', 'male', 'Solo el contorno, a navaja.', 15, 'fixed', 12000, null, 3),
    ('barberia-la-clasica', 'Corte y barba', 'Corte y barba', 'male', 'Corte clásico más arreglo de barba.', 60, 'fixed', 38000, null, 1),
    ('barberia-la-clasica', 'Corte y barba', 'Corte, barba y cejas', 'male', 'El servicio completo.', 70, 'fixed', 45000, null, 2),
    ('barberia-la-clasica', 'Afeitado', 'Afeitado clásico', 'male', 'Con espuma caliente y máquina.', 30, 'fixed', 25000, null, 1),
    ('barberia-la-clasica', 'Afeitado', 'Afeitado con navaja', 'male', 'A navaja, con toalla caliente.', 35, 'fixed', 28000, null, 2),
    ('barberia-la-clasica', 'Cejas', 'Cejas con navaja', 'unisex', 'Limpieza y forma a navaja.', 10, 'fixed', 8000, null, 1),
    ('barberia-la-clasica', 'Cejas', 'Cejas con hilo', 'unisex', 'Depilación con hilo.', 15, 'fixed', 12000, null, 2),
    ('barberia-la-clasica', 'Diseños', 'Diseño en el corte', 'unisex', 'Una figura sencilla a máquina.', 15, 'fixed', 10000, null, 1),
    ('barberia-la-clasica', 'Diseños', 'Línea o raya', 'unisex', 'Una línea marcada a navaja.', 10, 'fixed', 5000, null, 2),
    ('barberia-la-clasica', 'Color', 'Tinte de barba', 'male', 'Color para cubrir canas en la barba.', 30, 'fixed', 25000, null, 1),
    ('barberia-la-clasica', 'Color', 'Mechas', 'unisex', 'El precio cambia con el largo.', 90, 'from', 80000, null, 2),
    ('barberia-la-clasica', 'Color', 'Decoloración', 'unisex', 'Según el largo y el tono de partida.', 120, 'range', 90000, 150000, 3),
    ('barberia-la-clasica', 'Tratamientos', 'Mascarilla facial', 'unisex', 'Mascarilla de carbón y vapor.', 30, 'fixed', 30000, null, 1),
    ('barberia-la-clasica', 'Tratamientos', 'Limpieza facial', 'unisex', 'Limpieza profunda con extracción.', 45, 'fixed', 45000, null, 2),
    ('barberia-la-clasica', 'Tratamientos', 'Hidratación capilar', 'unisex', 'Mascarilla y masaje en el cuero cabelludo.', 30, 'fixed', 28000, null, 3),
    ('barberia-la-clasica', 'Tratamientos', 'Exfoliación', 'unisex', 'Exfoliación suave de rostro.', 20, 'fixed', 20000, null, 4),
    ('barberia-la-clasica', 'Peinados', 'Peinado para evento', 'unisex', 'Lavado, secado y peinado.', 30, 'fixed', 25000, null, 1),
    ('barberia-la-clasica', 'Peinados', 'Keratina', 'unisex', 'Alisado con keratina; depende del largo.', 120, 'from', 120000, null, 2),
    ('unas-y-arte-spa', 'Manos', 'Manicure tradicional', 'female', 'Limado, cutícula y esmalte.', 45, 'fixed', 25000, null, 1),
    ('unas-y-arte-spa', 'Manos', 'Manicure semipermanente', 'female', 'Esmalte en gel que dura hasta tres semanas.', 60, 'fixed', 45000, null, 2),
    ('unas-y-arte-spa', 'Pies', 'Pedicure spa', 'unisex', 'Exfoliación, masaje y esmalte.', 60, 'fixed', 40000, null, 1),
    ('salon-aurora', 'Cabello', 'Corte de dama', 'female', 'Corte con lavado y secado.', 45, 'fixed', 35000, null, 1),
    ('salon-aurora', 'Cabello', 'Cepillado', 'female', 'Lavado y cepillado.', 40, 'fixed', 30000, null, 2),
    ('salon-aurora', 'Color', 'Tinte completo', 'female', 'Color de raíz a puntas.', 90, 'from', 90000, null, 1),
    ('barberia-norte-93', 'Cortes', 'Corte clásico', 'male', 'Tijera y máquina.', 30, 'fixed', 28000, null, 1),
    ('barberia-norte-93', 'Cortes', 'Corte fade', 'male', 'Degradado a ras.', 40, 'fixed', 32000, null, 2),
    ('barberia-norte-93', 'Barba', 'Arreglo de barba', 'male', 'Recorte y forma.', 20, 'fixed', 18000, null, 1),
    ('spa-raices', 'Masajes', 'Masaje relajante', 'unisex', 'Masaje de cuerpo completo con aceites.', 60, 'fixed', 90000, null, 1),
    ('spa-raices', 'Masajes', 'Masaje con piedras calientes', 'unisex', 'Masaje con piedras volcánicas.', 75, 'fixed', 120000, null, 2),
    ('spa-raices', 'Faciales', 'Facial hidratante', 'unisex', 'Limpieza e hidratación profunda.', 50, 'fixed', 70000, null, 1)
  ) as s(slug, category, name, audience, description, minutes, price_type, price, price_to, pos)
  join public.businesses b on b.slug = s.slug
  join public.service_categories sc on sc.business_id = b.id and sc.name = s.category;

  -- Quién hace cada servicio en el negocio completo (duración propia donde se demora más).
  insert into public.staff_services (staff_id, service_id, duration_minutes)
  select a.staff_id, sv.id, null
  from (values
    (v_camilo_staff, 'Cortes'), (v_camilo_staff, 'Barba'), (v_camilo_staff, 'Corte y barba'),
    (v_camilo_staff, 'Afeitado'), (v_camilo_staff, 'Diseños'),
    (v_julian_staff, 'Cortes'), (v_julian_staff, 'Barba'), (v_julian_staff, 'Corte y barba'),
    (v_julian_staff, 'Color'),
    (v_sofia_staff, 'Cejas'), (v_sofia_staff, 'Tratamientos'), (v_sofia_staff, 'Peinados'),
    (v_sofia_staff, 'Color')
  ) as a(staff_id, category)
  join public.service_categories sc on sc.business_id = v_clasica and sc.name = a.category
  join public.services sv on sv.category_id = sc.id;

  insert into public.staff_services (staff_id, service_id, duration_minutes)
  select v_valentina_staff, sv.id, null
  from public.services sv
  where sv.business_id = v_clasica and sv.name in ('Corte clásico', 'Corte con tijera', 'Corte y barba');

  update public.staff_services ss set duration_minutes = 45
  from public.services sv
  where ss.service_id = sv.id and ss.staff_id = v_julian_staff and sv.name = 'Corte fade';

  -- En los negocios sencillos, el dueño hace todos los servicios.
  insert into public.staff_services (staff_id, service_id)
  select s.id, sv.id
  from public.services sv
  join public.staff s on s.business_id = sv.business_id and s.role = 'owner'
  where sv.business_id <> v_clasica;

  -- Fase 3. Sin avisos mientras se siembra (bookings_messages lo revisa), y con la misma
  -- secuencia al azar en cada reinicio.
  perform set_config('app.seeding', 'on', true);
  perform setseed(0.31);
  perform public.seed_demo_clients(v_clasica, (select b.owner_id from public.businesses b where b.id = v_clasica));
  perform public.seed_demo_bookings(v_clasica);

  -- Fase 5. Las imágenes son ilustraciones propias de la demo (public/demo).
  update public.businesses b
  set logo_url = '/demo/logos/' || b.slug || '.svg', cover_url = '/demo/portadas/' || b.slug || '.svg'
  where true;  -- reset_demo llega por la API, y pg_safeupdate no deja cambiar sin where
  for v_simple in select b.id from public.businesses b where b.id <> v_clasica order by b.slug loop
    perform public.seed_demo_simple_clients(v_simple);
    perform public.seed_demo_agenda(v_simple, 0.4);
  end loop;
  perform public.seed_demo_reviews();
  perform public.seed_demo_follows();
  perform public.seed_demo_promotions();
  perform public.seed_demo_money(v_clasica);
  perform public.seed_demo_reports(v_clasica);
end;
$$;
revoke execute on function public.seed_demo() from public, anon, authenticated;

-- ============================================
-- reset_demo(): borra todo lo de public y las cuentas, y vuelve a sembrar. Cierra todas las
-- sesiones (se borran con las cuentas). Solo con la llave de servicio (botón "Reiniciar demo").
-- ============================================
create or replace function public.reset_demo() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_tables text;
  v_try int;
begin
  select string_agg(format('%I.%I', t.schemaname, t.tablename), ', ')
    into v_tables
  from pg_catalog.pg_tables t where t.schemaname = 'public';
  -- El lector de Realtime toma las tablas mientras decodifica: a veces el truncate choca con él
  -- (deadlock). Se reintenta unas veces antes de rendirse.
  for v_try in 1..5 loop
    begin
      execute 'truncate table ' || v_tables || ' cascade';
      exit;
    exception when deadlock_detected or lock_not_available then
      if v_try = 5 then
        raise;
      end if;
      perform pg_sleep(0.2 * v_try);
    end;
  end loop;
  -- "where true": por la API, pg_safeupdate no deja borrar sin where.
  delete from auth.users where true;
  perform public.seed_demo();
end;
$$;
revoke execute on function public.reset_demo() from public, anon, authenticated;
grant execute on function public.reset_demo() to service_role;

select public.seed_demo();
