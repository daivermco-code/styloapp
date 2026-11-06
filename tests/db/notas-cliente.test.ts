// Arreglo 5 de la revisión de las Fases 8 a 14: las notas de la ficha (clients.notes) solo las
// lee el dueño, por client_notes(), como el celular. Crearlas y cambiarlas sigue igual.
// Necesitan `npm run db:start` y `.env.local`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, resetDemo, signIn, sql } from "./helpers";

const OWNER = "+573005550101"; // Valentina Ríos, Barbería La Clásica
const OTHER_OWNER = "+573005550102"; // Andrés Castillo, Uñas y Arte Spa
const STAFF = "+573005550111"; // Camilo Rojas, de La Clásica
const CLIENT = "+573005550121"; // Mateo Gómez, con cuenta y ficha en La Clásica
const NOTE = "Prefiere tijera y poco volumen arriba.";

interface Ids {
  business: string;
  mateo: string;
}

let ids: Ids;

async function one<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const [row] = await sql<T>(text, values);
  return row;
}

beforeAll(async () => {
  await resetDemo();
  const business = await one<{ id: string }>(
    "select id from public.businesses where slug = 'barberia-la-clasica'",
  );
  const mateo = await one<{ id: string }>(
    `select c.id from public.clients c join public.profiles p on p.id = c.profile_id
     where c.business_id = $1 and p.phone = $2`,
    [business.id, CLIENT],
  );
  ids = { business: business.id, mateo: mateo.id };
});

afterAll(resetDemo);

describe("notas de la ficha", () => {
  it("los permisos de la columna y de la función quedan como el celular", async () => {
    const row = await one<{
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      anon_exec: boolean;
      auth_exec: boolean;
    }>(
      `select has_column_privilege('authenticated', 'public.clients', 'notes', 'select') as can_select,
              has_column_privilege('authenticated', 'public.clients', 'notes', 'insert') as can_insert,
              has_column_privilege('authenticated', 'public.clients', 'notes', 'update') as can_update,
              has_function_privilege('anon', 'public.client_notes(uuid)', 'execute') as anon_exec,
              has_function_privilege('authenticated', 'public.client_notes(uuid)', 'execute') as auth_exec`,
    );
    expect(row).toEqual({
      can_select: false,
      can_insert: true,
      can_update: true,
      anon_exec: false,
      auth_exec: true,
    });
  });

  it("el dueño las cambia y las lee; nadie más las ve", async () => {
    const owner = await signIn(OWNER);
    const { data: saved, error: saveError } = await owner.client
      .from("clients")
      .update({ notes: NOTE })
      .eq("business_id", ids.business)
      .eq("id", ids.mateo)
      .select("id")
      .maybeSingle();
    expect(saveError).toBeNull();
    expect(saved?.id).toBe(ids.mateo);

    const { data: own } = await owner.client.rpc("client_notes", {
      p_client: ids.mateo,
    });
    expect(own).toBe(NOTE);

    for (const phone of [STAFF, CLIENT, OTHER_OWNER]) {
      const { client } = await signIn(phone);
      const { data, error } = await client.rpc("client_notes", {
        p_client: ids.mateo,
      });
      expect(error).toBeNull();
      expect(data).toBeNull();
    }

    const { error: anonError } = await anonClient().rpc("client_notes", {
      p_client: ids.mateo,
    });
    expect(anonError?.code).toBe("42501");
  });

  it("la columna no se lee directo, ni siquiera el dueño o el cliente de su ficha", async () => {
    for (const phone of [OWNER, STAFF, CLIENT]) {
      const { client } = await signIn(phone);
      const { error } = await client
        .from("clients")
        .select("id, notes")
        .eq("id", ids.mateo);
      expect(error?.code).toBe("42501");
    }
    // El resto de la ficha sí: el cliente sigue viendo la suya.
    const { client } = await signIn(CLIENT);
    const { data } = await client
      .from("clients")
      .select("id, full_name")
      .eq("id", ids.mateo);
    expect(data).toHaveLength(1);
  });

  it("el dueño crea una ficha con notas", async () => {
    const owner = await signIn(OWNER);
    const { data, error } = await owner.client
      .from("clients")
      .insert({
        business_id: ids.business,
        full_name: "Laura Benítez",
        notes: "Prefiere la máquina en 2.",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    const { data: notes } = await owner.client.rpc("client_notes", {
      p_client: data?.id ?? "",
    });
    expect(notes).toBe("Prefiere la máquina en 2.");
  });
});
