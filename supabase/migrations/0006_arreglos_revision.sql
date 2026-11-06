-- ============================================================================
-- StyloApp · 0006_arreglos_revision (Fase 15)
-- Los arreglos 1 a 5 de la revisión de las Fases 8 a 14, aprobados el 2026-11-06.
-- Fuente: BLUEPRINT-styloapp.md, anexo "Fase 15" (T-15.1.1 a T-15.1.5).
-- Lista Roja: no se editan 0001 a 0005 (invariante 6). Lo que debe seguir siendo cierto va en
-- cada sección; save_invoice y payroll cambian solo en la línea marcada.
-- ============================================================================

-- ============================================
-- 1. Facturas: editar con la llegada corregida
-- save_invoice pedía la llegada marcada (3 o 5) cada vez que llegaba p_booking, también al
-- editar: si la cita se corrigió a "No llegó" después de facturarla, la factura ya no se podía
-- editar (sí anular). Ahora se pide solo al crear o al cambiar de cita (p_booking distinto del
-- booking_id que ya tenía la factura). Lo demás, igual que en 0004.
-- ============================================
-- Crea (p_invoice null) o edita una factura con sus ítems, en una sola transacción. p_items es
-- un arreglo de {service_id, staff_id, price}. Lo opcional va al final, con null por defecto.
-- Revisa, en este orden: quién llama; la cita; el cliente, el método, los servicios y los profesionales; y, si edita, que se pueda editar.
-- Devuelve el id de la factura.
create or replace function public.save_invoice(
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

  -- 2. La cita: del negocio (y del profesional que factura), con la llegada marcada al crear o al
  --    cambiar de cita, y sin otra factura pagada.
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
    -- La llegada se pide al crear o al cambiar de cita. Al editar con la misma cita ya se revisó
    -- al facturarla: si después se corrigió a "No llegó", la factura se sigue pudiendo editar.
    if (v_booking.punctuality is null or v_booking.punctuality not in (3, 5))
       and not exists (select 1 from public.invoices i
                       where i.id = p_invoice and i.business_id = p_business
                         and i.booking_id = p_booking) then
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

-- ============================================
-- 2. Cita ya facturada que el profesional no ve
-- Si el dueño factura la cita de un profesional solo con servicios de otro, la RLS le esconde la
-- factura a ese profesional (la ve solo quien tiene un servicio suyo) y la app le mostraba
-- "Generar factura" y "Factura rápida"; save_invoice lo frenaba al guardar con ALREADY_INVOICED.
-- Esta función dice solo sí o no, y solo a quien ve la cita en el equipo (el dueño o el
-- profesional de la cita, como las políticas de bookings). A cualquier otro, false. Nunca dice
-- cuál factura.
-- ============================================
create or replace function public.booking_is_invoiced(p_booking uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.bookings b
    join public.invoices i on i.booking_id = b.id and i.status = 'paid'
    where b.id = p_booking
      and (public.is_owner_of(b.business_id)
           or b.staff_id = public.my_staff_id(b.business_id)));
$$;
revoke execute on function public.booking_is_invoiced(uuid) from public, anon;
grant execute on function public.booking_is_invoiced(uuid) to authenticated;

-- ============================================
-- 3. "Editar" por una línea ajena de $ 0
-- Al profesional la RLS le esconde los servicios de otros, y uno ajeno de $ 0 no cambia la suma:
-- el detalle y el editor comparaban la suma visible con el total y le mostraban Editar y Anular.
-- Esta función dice solo sí o no: true si quien llama tiene al menos un servicio en la factura y
-- todos son suyos; false sin sesión, si la factura no existe, es de otro negocio o quien llama no
-- tiene servicios en ella. Solo responde sobre facturas donde quien llama ya tiene un servicio, y
-- el total ya dejaba ver casi lo mismo. save_invoice y void_invoice lo siguen revisando con
-- invoice_can_write.
-- ============================================
create or replace function public.invoice_all_mine(p_invoice uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.invoice_items ii
                 where ii.invoice_id = p_invoice
                   and ii.staff_id = public.my_staff_id(ii.business_id))
     and not exists (select 1 from public.invoice_items ii
                     where ii.invoice_id = p_invoice
                       and ii.staff_id is distinct from public.my_staff_id(ii.business_id));
$$;
revoke execute on function public.invoice_all_mine(uuid) from public, anon;
grant execute on function public.invoice_all_mine(uuid) to authenticated;

-- ============================================
-- 4. Liquidador: comisiones de $ 0
-- payroll() dejaba en la lista a un profesional inactivo cuyas únicas líneas sin pagar eran de
-- comisión $ 0: quedaba para siempre en $ 0 y pay_staff le daba NOTHING_PENDING. Ahora el
-- inactivo sale solo si tiene alguna comisión mayor que 0. El CTE due no cambia: items e
-- invoices siguen contando también las líneas de $ 0, porque son las que lista el detalle
-- (pendingItems) y las que pay_staff enlaza con el pago.
-- ============================================
create or replace function public.payroll(p_business uuid)
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
    and (s.is_active or exists (select 1 from due d where d.staff_id = s.id and d.commission > 0))
    and public.is_owner_of(p_business)
  order by s.position;
$$;
revoke execute on function public.payroll(uuid) from public, anon;
grant execute on function public.payroll(uuid) to authenticated;

-- ============================================
-- 5. Clientes: las notas del dueño
-- Las notas de la ficha se podían leer con una consulta directa desde la cuenta del cliente y del
-- profesional: 0002 daba select (notes) a authenticated y la política de lectura deja pasar a
-- is_staff_of y al profile_id. Ahora salen como el celular: por una función que solo le responde
-- al dueño. Crear y cambiar notas sigue igual (grants de insert y update de 0002).
-- ============================================
revoke select (notes) on public.clients from authenticated;

-- Las notas de una ficha, solo para el dueño de su negocio (US-048). A cualquier otro le da null.
create or replace function public.client_notes(p_client uuid) returns text
language sql stable security definer set search_path = '' as $$
  select c.notes
  from public.clients c
  where c.id = p_client
    and public.is_owner_of(c.business_id);
$$;
revoke execute on function public.client_notes(uuid) from public, anon;
grant execute on function public.client_notes(uuid) to authenticated;
