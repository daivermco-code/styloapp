-- ============================================================================
-- StyloApp · 0004_dinero (Fase 7, oleada 4)
-- El dinero del negocio: métodos de pago, facturas con sus ítems y su comisión, gastos y pagos
-- a los profesionales; el permiso de facturación, el liquidador, los números de cada cliente y
-- el contador de facturas del inicio.
-- Fuente: TECH-SPEC-styloapp.md, anexo "Oleada 4" (O4.2) y el Blueprint (T-7.1.1 y T-7.1.2).
-- Lista Roja: invariantes 9 a 11. No se edita después de su commit (invariante 6): los
-- arreglos van en una migración nueva.
-- ============================================================================

-- ============================================
-- Tipos
-- ============================================
create type public.invoice_status as enum ('paid', 'void');
create type public.expense_category as enum
  ('rent', 'utilities', 'payroll', 'supplies', 'maintenance', 'advertising', 'other');

-- ============================================
-- Tablas
-- ============================================
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 30),
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

-- Se pagan: nacen pagadas; anular deja la fila con status 'void'. number es el consecutivo del
-- negocio. Una cita tiene a lo sumo una factura pagada (índice de abajo): la anulada guarda su
-- cita y la cita se puede volver a facturar.
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  number int not null,
  client_id uuid references public.clients (id) on delete set null,
  guest_name text check (char_length(guest_name) between 2 and 80),
  booking_id uuid references public.bookings (id) on delete set null,
  payment_method_id uuid not null references public.payment_methods (id) on delete restrict,
  issued_on date not null,                                    -- día de Bogotá
  status public.invoice_status not null default 'paid',
  total int not null check (total >= 0),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, number)
);
create index idx_invoices_period on public.invoices (business_id, issued_on);
create unique index uq_invoices_paid_booking on public.invoices (booking_id) where status = 'paid';
create index idx_invoices_client on public.invoices (client_id);

-- Va antes que invoice_items, por la llave. El valor lo pone pay_staff y no cambia.
create table public.staff_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete restrict,
  amount int not null check (amount > 0),
  payment_method_id uuid not null references public.payment_methods (id) on delete restrict,
  paid_on date not null,
  note text check (char_length(note) <= 200),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index idx_staff_payments_period on public.staff_payments (business_id, paid_on);

-- Un servicio vendido. La comisión se copia al facturar; staff_payment_id dice si ya se le pagó.
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  staff_id uuid not null references public.staff (id) on delete restrict,
  price int not null check (price >= 0),
  commission_pct numeric(5, 2) not null check (commission_pct between 0 and 100),
  commission int generated always as (round(price * commission_pct / 100)::int) stored,
  staff_payment_id uuid references public.staff_payments (id) on delete restrict,
  position int not null default 0
);
create index idx_invoice_items_invoice on public.invoice_items (invoice_id);
create index idx_invoice_items_payroll on public.invoice_items (staff_id, staff_payment_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  category public.expense_category not null,
  paid_on date not null,
  amount int not null check (amount > 0),
  payment_method_id uuid references public.payment_methods (id) on delete restrict,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_expenses_period on public.expenses (business_id, paid_on);

-- ============================================
-- Triggers
-- ============================================
create trigger set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

-- Negocio nuevo: nace con Efectivo y Banco (US-039).
create function public.payment_methods_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.payment_methods (business_id, name, position)
  values (new.id, 'Efectivo', 1), (new.id, 'Banco', 2);
  return new;
end;
$$;
create trigger payment_methods_defaults
  after insert on public.businesses
  for each row execute function public.payment_methods_defaults();

-- Los negocios que ya existen también.
insert into public.payment_methods (business_id, name, position)
select b.id, m.name, m.pos
from public.businesses b
cross join (values ('Efectivo', 1), ('Banco', 2)) as m(name, pos)
on conflict (business_id, name) do nothing;

-- Siempre queda un método activo: no deja desactivar ni borrar el último (LAST_ACTIVE_METHOD).
-- Borrar uno que ya está en facturas, gastos o pagos lo para la llave (restrict, 23503). Al
-- borrar el negocio entero (en cascada, desde otro trigger) no aplica.
create function public.payment_methods_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if old.is_active and (tg_op = 'DELETE' or not new.is_active) then
    -- Dos cambios a la vez en el mismo negocio van en fila; la revisión de abajo ya ve el otro.
    perform 1 from public.businesses b where b.id = old.business_id for no key update;
    if not exists (select 1 from public.payment_methods pm
                   where pm.business_id = old.business_id and pm.id <> old.id and pm.is_active) then
      raise exception 'LAST_ACTIVE_METHOD' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger payment_methods_guard
  before update or delete on public.payment_methods
  for each row execute function public.payment_methods_guard();

-- ============================================
-- Funciones internas
-- ============================================

-- Los 5 permisos del equipo (US-038); 0001 no leía el de facturación. Ahora solo responde al
-- equipo de ese negocio, y sin cuenta no se llama (todas sus llamadas son de alguien con cuenta).
create or replace function public.team_can(p_business uuid, p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_permission
    when 'manual_booking' then tp.manual_booking
    when 'manual_block' then tp.manual_block
    when 'internal_clients' then tp.internal_clients
    when 'see_client_phone' then tp.see_client_phone
    when 'invoicing' then tp.invoicing
    else false end
  from public.team_permissions tp
  where tp.business_id = p_business and public.is_staff_of(p_business);
$$;
revoke execute on function public.team_can(uuid, text) from public, anon;
grant execute on function public.team_can(uuid, text) to authenticated;

-- La comisión de un profesional en un servicio: la suya o 50 % (comisión vacía = 50 %).
create function public.staff_commission(p_staff uuid, p_service uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select ss.commission_pct from public.staff_services ss
                   where ss.staff_id = p_staff and ss.service_id = p_service), 50);
$$;
revoke execute on function public.staff_commission(uuid, uuid) from public, anon, authenticated;

-- ============================================
-- Facturas (US-040 a US-043). Errores (en message): NO_SESSION, NO_PERMISSION_INVOICING,
-- NOT_OWN_ITEMS, NOT_FOUND (detail: invoice, booking, client, method, service o staff),
-- BOOKING_NOT_MARKED, ALREADY_INVOICED, METHOD_INACTIVE, ITEMS_COUNT, INVALID_ITEMS,
-- INVOICE_VOID e INVOICE_PAID_OUT. La comisión no viene del navegador: la copia la base.
-- ============================================

-- Quien llama puede facturar estos ítems: el dueño, o un profesional con el permiso de
-- facturación y todos los ítems a su nombre.
create function public.invoice_can_write(p_business uuid, p_staff_ids uuid[]) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid;
begin
  if auth.uid() is null then
    raise exception 'NO_SESSION' using errcode = '42501';
  end if;
  if public.is_owner_of(p_business) then
    return;
  end if;
  v_me := public.my_staff_id(p_business);
  if v_me is null or not coalesce(public.team_can(p_business, 'invoicing'), false) then
    raise exception 'NO_PERMISSION_INVOICING' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(p_staff_ids) s where s is distinct from v_me) then
    raise exception 'NOT_OWN_ITEMS' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.invoice_can_write(uuid, uuid[]) from public, anon, authenticated;

-- Crea (p_invoice null) o edita una factura con sus ítems, en una sola transacción. p_items es
-- un arreglo de {service_id, staff_id, price}. Lo opcional va al final, con null por defecto. Revisa, en este orden: quién llama; la cita; el
-- cliente, el método, los servicios y los profesionales; y, si edita, que se pueda editar.
-- Devuelve el id de la factura.
create function public.save_invoice(
  p_business uuid, p_method uuid, p_items jsonb, p_invoice uuid default null,
  p_client uuid default null, p_guest_name text default null, p_booking uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_items jsonb := case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end;
  v_staff_ids uuid[];
  v_booking record;
  v_old record;
  v_id uuid;
  v_number int;
begin
  -- Ids con forma de uuid antes de convertirlos (si no, INVALID_ITEMS y no un 22P02).
  if exists (select 1 from jsonb_array_elements(v_items) i
             where coalesce(i ->> 'service_id', '') !~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
                or coalesce(i ->> 'staff_id', '') !~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$') then
    raise exception 'INVALID_ITEMS' using errcode = 'P0001';
  end if;
  select coalesce(array_agg((i ->> 'staff_id')::uuid), '{}') into v_staff_ids
  from jsonb_array_elements(v_items) i;

  -- 1. Quién llama.
  perform public.invoice_can_write(p_business, v_staff_ids);

  -- 2. La cita: del negocio (y del profesional que factura), con la llegada marcada y sin otra
  --    factura pagada.
  if p_booking is not null then
    select b.staff_id, b.punctuality into v_booking
    from public.bookings b where b.id = p_booking and b.business_id = p_business
    for update;
    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'booking';
    end if;
    if not public.is_owner_of(p_business) and v_booking.staff_id <> public.my_staff_id(p_business) then
      raise exception 'NOT_OWN_ITEMS' using errcode = '42501';
    end if;
    if v_booking.punctuality is null or v_booking.punctuality not in (3, 5) then
      raise exception 'BOOKING_NOT_MARKED' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.invoices i
               where i.booking_id = p_booking and i.status = 'paid'
                 and i.id is distinct from p_invoice) then
      raise exception 'ALREADY_INVOICED' using errcode = 'P0001';
    end if;
  end if;

  -- 3. Cliente, método, cantidad de ítems, precios, servicios y profesionales.
  if p_client is not null
     and not exists (select 1 from public.clients c where c.id = p_client and c.business_id = p_business) then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'client';
  end if;
  if not exists (select 1 from public.payment_methods pm
                 where pm.id = p_method and pm.business_id = p_business) then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'method';
  end if;
  -- Un método desactivado no sirve para facturar; al editar se puede dejar el que ya tenía.
  if not exists (select 1 from public.payment_methods pm where pm.id = p_method and pm.is_active)
     and not exists (select 1 from public.invoices i
                     where i.id = p_invoice and i.payment_method_id = p_method) then
    raise exception 'METHOD_INACTIVE' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_items) not between 1 and 20 then
    raise exception 'ITEMS_COUNT' using errcode = 'P0001';
  end if;
  -- Precio en pesos enteros, de 0 a 100 millones (el case evita leer como número lo que no lo es).
  if exists (select 1 from jsonb_array_elements(v_items) i
             where case when jsonb_typeof(i -> 'price') = 'number'
                        then (i ->> 'price')::numeric < 0
                             or (i ->> 'price')::numeric <> trunc((i ->> 'price')::numeric)
                             or (i ->> 'price')::numeric > 100000000
                        else true end) then
    raise exception 'INVALID_ITEMS' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(v_items) i
             where not exists (select 1 from public.services sv
                               where sv.id = (i ->> 'service_id')::uuid
                                 and sv.business_id = p_business)) then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'service';
  end if;
  if exists (select 1 from unnest(v_staff_ids) s
             where not exists (select 1 from public.staff st
                               where st.id = s and st.business_id = p_business)) then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'staff';
  end if;

  -- 4. Editar: pagada, sin nada pagado al profesional, y quien edita podía crearla.
  if p_invoice is not null then
    select i.id, i.status into v_old
    from public.invoices i where i.id = p_invoice and i.business_id = p_business
    for update;
    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'invoice';
    end if;
    -- Primero la factura y después sus ítems, como void_invoice y pay_staff: si se está pagando,
    -- espera, y la revisión de abajo (una sentencia nueva) ya ve el pago.
    perform 1 from public.invoice_items ii where ii.invoice_id = p_invoice order by ii.id for update;
    if v_old.status = 'void' then
      raise exception 'INVOICE_VOID' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.invoice_items ii
               where ii.invoice_id = p_invoice and ii.staff_payment_id is not null) then
      raise exception 'INVOICE_PAID_OUT' using errcode = 'P0001';
    end if;
    perform public.invoice_can_write(
      p_business,
      array(select ii.staff_id from public.invoice_items ii where ii.invoice_id = p_invoice));

    update public.invoices
    set client_id = p_client,
        guest_name = case when p_client is null then nullif(btrim(p_guest_name), '') end,
        booking_id = p_booking,
        payment_method_id = p_method
    where id = p_invoice;
    delete from public.invoice_items where invoice_id = p_invoice;
    v_id := p_invoice;
  else
    -- El consecutivo, con el negocio bloqueado (como link_staff).
    perform 1 from public.businesses b where b.id = p_business for update;
    select coalesce(max(i.number), 0) + 1 into v_number
    from public.invoices i where i.business_id = p_business;
    insert into public.invoices (business_id, number, client_id, guest_name, booking_id,
      payment_method_id, issued_on, total, created_by)
    values (p_business, v_number, p_client,
      case when p_client is null then nullif(btrim(p_guest_name), '') end, p_booking, p_method,
      (now() at time zone 'America/Bogota')::date, 0, auth.uid())
    returning id into v_id;
  end if;

  insert into public.invoice_items (invoice_id, business_id, service_id, staff_id, price,
    commission_pct, position)
  select v_id, p_business, (i.value ->> 'service_id')::uuid, (i.value ->> 'staff_id')::uuid,
         ((i.value ->> 'price')::numeric)::int,
         public.staff_commission((i.value ->> 'staff_id')::uuid, (i.value ->> 'service_id')::uuid),
         i.ordinality
  from jsonb_array_elements(v_items) with ordinality i;

  update public.invoices
  set total = (select sum(ii.price) from public.invoice_items ii where ii.invoice_id = v_id)
  where id = v_id;
  return v_id;
end;
$$;
revoke execute on function public.save_invoice(uuid, uuid, jsonb, uuid, uuid, text, uuid) from public, anon;
grant execute on function public.save_invoice(uuid, uuid, jsonb, uuid, uuid, text, uuid) to authenticated;

-- Anula una factura si nada de ella está pagado al profesional. Puede quien podía crearla.
create function public.void_invoice(p_invoice uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_inv record;
begin
  if auth.uid() is null then
    raise exception 'NO_SESSION' using errcode = '42501';
  end if;
  select i.business_id, i.status into v_inv
  from public.invoices i where i.id = p_invoice and public.is_staff_of(i.business_id)
  for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'invoice';
  end if;
  perform 1 from public.invoice_items ii where ii.invoice_id = p_invoice order by ii.id for update;
  perform public.invoice_can_write(
    v_inv.business_id,
    array(select ii.staff_id from public.invoice_items ii where ii.invoice_id = p_invoice));
  if v_inv.status = 'void' then
    raise exception 'INVOICE_VOID' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.invoice_items ii
             where ii.invoice_id = p_invoice and ii.staff_payment_id is not null) then
    raise exception 'INVOICE_PAID_OUT' using errcode = 'P0001';
  end if;
  update public.invoices
  set status = 'void', voided_at = now(), voided_by = auth.uid()
  where id = p_invoice;
end;
$$;
revoke execute on function public.void_invoice(uuid) from public, anon;
grant execute on function public.void_invoice(uuid) to authenticated;

-- ============================================
-- Liquidador (US-045 y US-046). Solo el dueño.
-- ============================================

-- Por profesional (sin el dueño): lo pendiente (comisiones de facturas pagadas sin pago), de
-- cuántos ítems y facturas sale, y cuántas de sus citas ya empezaron sin la llegada marcada.
-- Salen los activos y los inactivos que todavía tienen algo pendiente. Al profesional le
-- devuelve 0 filas.
create function public.payroll(p_business uuid)
returns table (staff_id uuid, display_name text, is_active boolean, pending bigint, items bigint,
               invoices bigint, unmarked bigint)
language sql stable security definer set search_path = '' as $$
  with due as (
    select ii.staff_id, ii.commission, ii.invoice_id
    from public.invoice_items ii
    join public.invoices i on i.id = ii.invoice_id and i.status = 'paid'
    where ii.business_id = p_business and ii.staff_payment_id is null
  )
  select s.id, s.display_name, s.is_active,
         coalesce((select sum(d.commission) from due d where d.staff_id = s.id), 0)::bigint,
         (select count(*) from due d where d.staff_id = s.id),
         (select count(distinct d.invoice_id) from due d where d.staff_id = s.id),
         (select count(*) from public.bookings b
          where b.staff_id = s.id and b.status = 'pending' and b.starts_at <= now())
  from public.staff s
  where s.business_id = p_business and s.role = 'staff'
    and (s.is_active or exists (select 1 from due d where d.staff_id = s.id))
    and public.is_owner_of(p_business)
  order by s.position;
$$;
revoke execute on function public.payroll(uuid) from public, anon;
grant execute on function public.payroll(uuid) to authenticated;

-- Le paga a un profesional todo lo pendiente. El valor no viene del navegador: es la suma de las
-- comisiones de sus ítems en facturas pagadas sin pago, que quedan con este pago. Errores:
-- NO_SESSION, NO_PERMISSION, NOT_FOUND (staff o method), METHOD_INACTIVE, INVALID_DATE,
-- UNMARKED_BOOKINGS (detail: cuántas) y NOTHING_PENDING. Devuelve el id del pago.
create function public.pay_staff(
  p_business uuid, p_staff uuid, p_method uuid, p_day date, p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_unmarked bigint;
  v_ids uuid[];
  v_amount bigint;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NO_SESSION' using errcode = '42501';
  end if;
  if not public.is_owner_of(p_business) then
    raise exception 'NO_PERMISSION' using errcode = '42501';
  end if;
  -- Un pago a la vez por profesional.
  perform 1 from public.staff s
  where s.id = p_staff and s.business_id = p_business and s.role = 'staff'
  for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'staff';
  end if;
  if not exists (select 1 from public.payment_methods pm
                 where pm.id = p_method and pm.business_id = p_business) then
    raise exception 'NOT_FOUND' using errcode = 'P0002', detail = 'method';
  end if;
  if not exists (select 1 from public.payment_methods pm where pm.id = p_method and pm.is_active) then
    raise exception 'METHOD_INACTIVE' using errcode = 'P0001';
  end if;
  if p_day is null or p_day > v_today then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;

  select count(*) into v_unmarked from public.bookings b
  where b.staff_id = p_staff and b.status = 'pending' and b.starts_at <= now();
  if v_unmarked > 0 then
    raise exception 'UNMARKED_BOOKINGS' using errcode = 'P0001', detail = v_unmarked::text;
  end if;

  -- Primero las facturas, en orden, y después los ítems, como void_invoice y save_invoice: una
  -- factura que se está anulando o editando espera, y lo que se paga es lo que quedó.
  perform 1 from public.invoices i
  where i.status = 'paid'
    and exists (select 1 from public.invoice_items ii
                where ii.invoice_id = i.id and ii.staff_id = p_staff and ii.staff_payment_id is null)
  order by i.id
  for update;
  select array_agg(t.id), sum(t.commission) into v_ids, v_amount
  from (select ii.id, ii.commission
        from public.invoice_items ii
        join public.invoices i on i.id = ii.invoice_id and i.status = 'paid'
        where ii.staff_id = p_staff and ii.staff_payment_id is null
        order by ii.id
        for update of ii, i) t;
  if coalesce(v_amount, 0) = 0 then
    raise exception 'NOTHING_PENDING' using errcode = 'P0001';
  end if;

  insert into public.staff_payments (business_id, staff_id, amount, payment_method_id, paid_on, note,
    created_by)
  values (p_business, p_staff, v_amount, p_method, p_day, nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;
  update public.invoice_items set staff_payment_id = v_id where id = any (v_ids);
  return v_id;
end;
$$;
revoke execute on function public.pay_staff(uuid, uuid, uuid, date, text) from public, anon;
grant execute on function public.pay_staff(uuid, uuid, uuid, date, text) to authenticated;

-- ============================================
-- Clientes (US-047 y US-048). Solo el dueño.
-- ============================================

-- Por ficha: visitas efectivas, última visita (día de Bogotá) y días desde entonces, días para
-- el próximo cumpleaños (el 29 de febrero cae el 28 en los años que no son bisiestos), lo
-- facturado (pagadas), si tiene cuenta y si está bloqueado. El celular, por client_phone.
create function public.client_stats(p_business uuid)
returns table (client_id uuid, full_name text, phone text, birth_date date, visits bigint,
               last_visit date, days_away int, birthday_in int, invoiced bigint,
               has_account boolean, is_blocked boolean)
language sql stable security definer set search_path = '' as $$
  with today as (select (now() at time zone 'America/Bogota')::date as d),
  visits as (
    select b.client_id, count(*) as n, max((b.starts_at at time zone 'America/Bogota')::date) as last_day
    from public.bookings b
    where b.business_id = p_business and b.status = 'successful' and b.client_id is not null
    group by b.client_id
  ),
  billed as (
    select i.client_id, sum(i.total) as total
    from public.invoices i
    where i.business_id = p_business and i.status = 'paid' and i.client_id is not null
    group by i.client_id
  )
  select c.id, c.full_name, public.client_phone(c.id), c.birth_date,
         coalesce(v.n, 0), v.last_day, (today.d - v.last_day),
         case when c.birth_date is not null then
           (select case when x.this_year >= today.d then x.this_year - today.d
                        else (c.birth_date + make_interval(
                                years => (extract(year from today.d) - extract(year from c.birth_date))::int + 1
                              ))::date - today.d end
            from (select (c.birth_date + make_interval(
                           years => (extract(year from today.d) - extract(year from c.birth_date))::int
                         ))::date as this_year) x)
         end,
         coalesce(bl.total, 0)::bigint, c.profile_id is not null, c.is_blocked
  from public.clients c
  cross join today
  left join visits v on v.client_id = c.id
  left join billed bl on bl.client_id = c.id
  where c.business_id = p_business and public.is_owner_of(p_business)
  order by c.full_name;
$$;
revoke execute on function public.client_stats(uuid) from public, anon;
grant execute on function public.client_stats(uuid) to authenticated;

-- Contadores del inicio, v4: Facturas cuenta las pagadas del negocio para el dueño, y para el
-- profesional las que tienen un servicio suyo.
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
         (select count(*) from public.invoices i
          where i.business_id = p_business and i.status = 'paid'
            and (me.is_owner
                 or exists (select 1 from public.invoice_items ii
                            where ii.invoice_id = i.id and ii.staff_id = me.staff_id)))
  from me
  where public.is_staff_of(p_business);
$$;

-- ============================================
-- RLS (todas las tablas nuevas). Sin cuenta no se ve nada (invariante 11).
-- ============================================
alter table public.payment_methods enable row level security;
alter table public.invoices enable row level security;
alter table public.staff_payments enable row level security;
alter table public.invoice_items enable row level security;
alter table public.expenses enable row level security;

revoke all on public.payment_methods, public.invoices, public.staff_payments, public.invoice_items,
  public.expenses from anon;

-- payment_methods: el equipo los lee (el editor de facturas los necesita); el dueño los crea,
-- renombra, activa y borra.
create policy "el equipo ve los métodos de pago" on public.payment_methods
  for select to authenticated using (public.is_staff_of(business_id));
create policy "el dueño escribe los métodos de pago" on public.payment_methods
  for all to authenticated using (public.is_owner_of(business_id))
  with check (public.is_owner_of(business_id));
revoke insert, update, delete on public.payment_methods from authenticated;
grant insert (business_id, name, is_active, position) on public.payment_methods to authenticated;
grant update (name, is_active, position) on public.payment_methods to authenticated;
grant delete on public.payment_methods to authenticated;

-- invoices: el dueño ve todas; el profesional, las que tienen un ítem suyo. Nadie escribe
-- directo: save_invoice y void_invoice (invariante 9).
create policy "el dueño ve las facturas" on public.invoices
  for select to authenticated using (public.is_owner_of(business_id));
create policy "el profesional ve las facturas con servicios suyos" on public.invoices
  for select to authenticated
  using (exists (select 1 from public.invoice_items ii
                 where ii.invoice_id = invoices.id
                   and ii.staff_id = public.my_staff_id(invoices.business_id)));
revoke insert, update, delete on public.invoices from authenticated;

-- invoice_items: el dueño todos; el profesional, los suyos. La política no mira invoices, para
-- que las dos políticas no se llamen entre sí. Nadie escribe directo.
create policy "el dueño ve los ítems" on public.invoice_items
  for select to authenticated using (public.is_owner_of(business_id));
create policy "el profesional ve sus ítems" on public.invoice_items
  for select to authenticated using (staff_id = public.my_staff_id(business_id));
revoke insert, update, delete on public.invoice_items from authenticated;

-- expenses: solo el dueño, con un método de su negocio.
create policy "el dueño ve sus gastos" on public.expenses
  for select to authenticated using (public.is_owner_of(business_id));
create policy "el dueño escribe sus gastos" on public.expenses
  for all to authenticated using (public.is_owner_of(business_id))
  with check (
    public.is_owner_of(business_id)
    and (payment_method_id is null
         or exists (select 1 from public.payment_methods pm
                    where pm.id = payment_method_id and pm.business_id = expenses.business_id))
  );
revoke insert, update, delete on public.expenses from authenticated;
grant insert (business_id, name, category, paid_on, amount, payment_method_id)
  on public.expenses to authenticated;
grant update (name, category, paid_on, amount, payment_method_id) on public.expenses to authenticated;
grant delete on public.expenses to authenticated;

-- staff_payments: solo el dueño lee. Nadie escribe directo: pay_staff (invariantes 9 y 10).
create policy "el dueño ve los pagos a su equipo" on public.staff_payments
  for select to authenticated using (public.is_owner_of(business_id));
revoke insert, update, delete on public.staff_payments from authenticated;

-- ============================================
-- staff_services: el precio y la comisión del profesional son del dueño (US-037)
-- ============================================

-- staff_services_guard (0001) no deja que el profesional los cambie, pero sí podía quitar el
-- servicio y volver a marcarlo: la fila nueva nacía sin precio ni comisión (50 %). Ahora solo el
-- dueño quita un servicio que tiene precio o comisión propios. Sin cuenta (semilla, cascadas de
-- la llave de servicio) no se revisa.
create function public.staff_services_delete_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null
     and (old.price is not null or old.commission_pct is not null)
     and not exists (select 1 from public.staff s
                     where s.id = old.staff_id and public.is_owner_of(s.business_id)) then
    raise exception 'OWNER_PRICING' using errcode = '42501';
  end if;
  return old;
end;
$$;
create trigger staff_services_delete_guard
  before delete on public.staff_services
  for each row execute function public.staff_services_delete_guard();

-- La comisión no se lee por la API (todos leen staff_services para reservar): el dueño la ve con
-- staff_commissions(), y las facturas y el liquidador la copian dentro de la base.
revoke select on public.staff_services from anon, authenticated;
grant select (staff_id, service_id, duration_minutes, price) on public.staff_services
  to anon, authenticated;

create function public.staff_commissions(p_staff uuid)
returns table (service_id uuid, commission_pct numeric)
language sql stable security definer set search_path = '' as $$
  select ss.service_id, ss.commission_pct
  from public.staff_services ss
  join public.staff s on s.id = ss.staff_id
  where ss.staff_id = p_staff and public.is_owner_of(s.business_id);
$$;
revoke execute on function public.staff_commissions(uuid) from public, anon;
grant execute on function public.staff_commissions(uuid) to authenticated;
