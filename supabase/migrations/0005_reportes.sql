-- ============================================================================
-- StyloApp · 0005_reportes (Fase 12, oleada 5)
-- Los informes del negocio (indicadores, ventas por servicio, comisiones y métodos de pago) y
-- las Estadísticas (seguidores, reservas de usuarios y visitas al perfil).
-- Fuente: TECH-SPEC-styloapp.md, anexo "Oleada 5" (O5.2) y el Blueprint (T-12.1.1).
-- Lista Roja: invariantes 12 y 13. No se edita después de su commit (invariante 6): los
-- arreglos van en una migración nueva.
-- ============================================================================

-- ============================================
-- Tabla
-- ============================================

-- Una visita a la página del negocio (/app/negocio/[id] o /n/[slug]). No guarda quién la abrió:
-- ni id, ni IP, ni navegador (invariante 13).
create table public.profile_visits (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  visited_at timestamptz not null default now()
);
create index idx_profile_visits_business on public.profile_visits (business_id);

-- Sin políticas: nadie la lee ni la escribe por la API, solo las funciones de abajo.
alter table public.profile_visits enable row level security;
revoke all on public.profile_visits from anon, authenticated;

-- ============================================
-- Informes (US-052 a US-057). security invoker: leen con los permisos de quien llama, así que
-- la RLS de la oleada 4 decide qué ve cada uno (invariante 12). Solo cuentan las facturas
-- pagadas por su issued_on y los gastos por su paid_on, los dos días incluidos.
-- Errores (en message): NO_SESSION, NO_PERMISSION, INVALID_RANGE y FORBIDDEN.
-- ============================================

-- Quien llama es del equipo de ese negocio y el rango va de p_from a p_to, de hasta 366 días.
create function public.report_guard(p_business uuid, p_from date, p_to date) returns void
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'NO_SESSION' using errcode = '42501';
  end if;
  if not public.is_staff_of(p_business) then
    raise exception 'NO_PERMISSION' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 365 then
    raise exception 'INVALID_RANGE' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.report_guard(uuid, date, date) from public, anon;
grant execute on function public.report_guard(uuid, date, date) to authenticated;

-- Indicadores generales. p_staff es del dueño (un profesional elegido); si llama un profesional
-- se ignora: la RLS ya le deja solo sus ítems. Gastos sale null con un profesional elegido o si
-- llama un profesional, porque son del negocio. Las comisiones son las ganadas: todas las de los
-- ítems que se miran, como el "Total comisiones" de Facturas. Productos, 0 hasta la oleada 6.
create function public.report_summary(p_business uuid, p_from date, p_to date, p_staff uuid default null)
returns table (services bigint, products bigint, expenses bigint, commissions bigint, invoices bigint)
language plpgsql stable set search_path = '' as $$
declare
  v_owner boolean;
  v_staff uuid;
begin
  perform public.report_guard(p_business, p_from, p_to);
  v_owner := public.is_owner_of(p_business);
  v_staff := case when v_owner then p_staff end;

  return query
  with items as (
    select ii.invoice_id, ii.price, ii.commission
    from public.invoice_items ii
    join public.invoices i on i.id = ii.invoice_id
    where i.business_id = p_business and i.status = 'paid'
      and i.issued_on between p_from and p_to
      and (v_staff is null or ii.staff_id = v_staff)
  )
  select coalesce((select sum(it.price) from items it), 0)::bigint,
         0::bigint,
         case when v_owner and v_staff is null then
           (select coalesce(sum(e.amount), 0) from public.expenses e
            where e.business_id = p_business and e.paid_on between p_from and p_to)::bigint
         end,
         coalesce((select sum(it.commission) from items it), 0)::bigint,
         (select count(distinct it.invoice_id) from items it)::bigint;
end;
$$;
revoke execute on function public.report_summary(uuid, date, date, uuid) from public, anon;
grant execute on function public.report_summary(uuid, date, date, uuid) to authenticated;

-- Ventas: por servicio, cuántas veces y por cuánto, de mayor a menor.
create function public.report_services(p_business uuid, p_from date, p_to date, p_staff uuid default null)
returns table (service_id uuid, name text, times bigint, total bigint)
language plpgsql stable set search_path = '' as $$
declare
  v_staff uuid;
begin
  perform public.report_guard(p_business, p_from, p_to);
  v_staff := case when public.is_owner_of(p_business) then p_staff end;

  return query
  select s.id, s.name, count(*)::bigint, sum(ii.price)::bigint
  from public.invoice_items ii
  join public.invoices i on i.id = ii.invoice_id
  join public.services s on s.id = ii.service_id
  where i.business_id = p_business and i.status = 'paid'
    and i.issued_on between p_from and p_to
    and (v_staff is null or ii.staff_id = v_staff)
  group by s.id, s.name
  order by sum(ii.price) desc, count(*) desc, s.name;
end;
$$;
revoke execute on function public.report_services(uuid, date, date, uuid) from public, anon;
grant execute on function public.report_services(uuid, date, date, uuid) to authenticated;

-- Comisiones (el reporte de pagos): por profesional, lo vendido, la comisión ganada en el rango,
-- lo ya pagado (ítems con staff_payment_id, del liquidador) y lo que falta. El dueño no sale,
-- como en el liquidador.
create function public.report_commissions(p_business uuid, p_from date, p_to date,
                                          p_staff uuid default null)
returns table (staff_id uuid, name text, sold bigint, earned bigint, paid bigint, pending bigint)
language plpgsql stable set search_path = '' as $$
declare
  v_staff uuid;
begin
  perform public.report_guard(p_business, p_from, p_to);
  v_staff := case when public.is_owner_of(p_business) then p_staff end;

  return query
  select st.id, st.display_name,
         sum(ii.price)::bigint,
         sum(ii.commission)::bigint,
         coalesce(sum(ii.commission) filter (where ii.staff_payment_id is not null), 0)::bigint,
         coalesce(sum(ii.commission) filter (where ii.staff_payment_id is null), 0)::bigint
  from public.invoice_items ii
  join public.invoices i on i.id = ii.invoice_id
  join public.staff st on st.id = ii.staff_id
  where i.business_id = p_business and i.status = 'paid'
    and i.issued_on between p_from and p_to
    and st.role = 'staff'
    and (v_staff is null or ii.staff_id = v_staff)
  group by st.id, st.display_name
  order by sum(ii.commission) desc, st.display_name;
end;
$$;
revoke execute on function public.report_commissions(uuid, date, date, uuid) from public, anon;
grant execute on function public.report_commissions(uuid, date, date, uuid) to authenticated;

-- Métodos de pago: solo el dueño. Todos los activos (aunque estén en 0) y los desactivados que
-- tuvieron ventas en el rango, con el total y cuántas facturas. El porcentaje lo saca la pantalla.
create function public.report_methods(p_business uuid, p_from date, p_to date)
returns table (method_id uuid, name text, is_active boolean, total bigint, invoices bigint)
language plpgsql stable set search_path = '' as $$
begin
  perform public.report_guard(p_business, p_from, p_to);
  if not public.is_owner_of(p_business) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select pm.id, pm.name, pm.is_active,
         coalesce(sum(i.total), 0)::bigint, count(i.id)::bigint
  from public.payment_methods pm
  left join public.invoices i
    on i.payment_method_id = pm.id and i.status = 'paid'
   and i.issued_on between p_from and p_to
  where pm.business_id = p_business
  group by pm.id, pm.name, pm.is_active, pm.position
  having pm.is_active or count(i.id) > 0
  order by coalesce(sum(i.total), 0) desc, pm.position, pm.name;
end;
$$;
revoke execute on function public.report_methods(uuid, date, date) from public, anon;
grant execute on function public.report_methods(uuid, date, date) to authenticated;

-- ============================================
-- Estadísticas (US-058). security definer: profile_visits no tiene políticas y follows solo deja
-- ver a quién sigue cada uno, así que leen por su cuenta y antes revisan que quien llama sea del
-- equipo del negocio (invariante 13).
-- ============================================

-- Seguidores, reservas de usuarios (las que hicieron los clientes, sin las canceladas) y visitas.
-- No se llama business_stats: ese nombre ya es el de Explorar (0003).
create function public.business_insights(p_business uuid)
returns table (followers bigint, client_bookings bigint, visits bigint)
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.follows f where f.business_id = p_business),
         (select count(*) from public.bookings b
          where b.business_id = p_business and b.booked_by = 'client' and b.status <> 'cancelled'),
         (select count(*) from public.profile_visits v where v.business_id = p_business)
  where public.is_staff_of(p_business);
$$;
revoke execute on function public.business_insights(uuid) from public, anon;
grant execute on function public.business_insights(uuid) to authenticated;

-- La lista de seguidores: nombre y desde cuándo, del más reciente al más antiguo. Ni el celular
-- ni nada más de la persona.
create function public.business_followers(p_business uuid)
returns table (full_name text, followed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select coalesce(p.full_name, 'Cliente de la app'), f.created_at
  from public.follows f
  join public.profiles p on p.id = f.profile_id
  where f.business_id = p_business and public.is_staff_of(p_business)
  order by f.created_at desc, p.full_name;
$$;
revoke execute on function public.business_followers(uuid) from public, anon;
grant execute on function public.business_followers(uuid) to authenticated;

-- Suma una visita si el negocio existe. Las del equipo del negocio no cuentan. Es la única
-- función de la oleada que se le concede a anon: la página del negocio se abre sin cuenta.
-- Demo local: sin límite de llamadas (en la nube se puede sumar uno).
create function public.record_profile_visit(p_business uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and public.is_staff_of(p_business) then
    return;
  end if;
  insert into public.profile_visits (business_id)
  select b.id from public.businesses b where b.id = p_business;
end;
$$;
revoke execute on function public.record_profile_visit(uuid) from public;
grant execute on function public.record_profile_visit(uuid) to anon, authenticated;
