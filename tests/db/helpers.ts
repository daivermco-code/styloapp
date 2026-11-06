// Ayudas para las pruebas contra el Supabase local (npm run db:start).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import type { Database } from "@/shared/types/database";

const API_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
// La conexión directa de Postgres del Supabase local (valor por defecto del CLI, no es secreto).
const DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const noSession = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en .env.local`);
  return value;
}

export type Db = SupabaseClient<Database>;

export function adminClient(): Db {
  return createClient<Database>(
    API_URL,
    required("SUPABASE_SERVICE_ROLE_KEY"),
    noSession,
  );
}

export function anonClient(): Db {
  return createClient<Database>(
    API_URL,
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    noSession,
  );
}

/** Consulta SQL directa (catálogo de Postgres), con la conexión del dueño de la base. */
export async function sql<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const result = await client.query<T>(text, values);
    return result.rows;
  } finally {
    await client.end();
  }
}

/** Último código de entrada que llegó a la bandeja de un celular (+57…). */
export async function lastLoginCode(phone: string): Promise<string> {
  const { data, error } = await adminClient()
    .from("demo_messages")
    .select("body")
    .eq("recipient_phone", phone)
    .eq("kind", "login_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw new Error(`Sin código para ${phone}: ${error.message}`);
  const code = data.body.match(/\d{6}/)?.[0];
  if (!code) throw new Error(`El mensaje no trae código: ${data.body}`);
  return code;
}

/** Pide un código. Supabase deja pedir uno por celular cada segundo (config.toml): reintenta. */
export async function requestCode(
  client: Db,
  phone: string,
  createUser = false,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const { error } = await client.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: createUser },
    });
    if (!error) return;
    if (error.status !== 429 || attempt === 5) {
      throw new Error(`signInWithOtp: ${error.code} ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
}

/** Entra como una persona (celular +57…) con el código leído de la bandeja. */
export async function signIn(phone: string, createUser = false) {
  const client = anonClient();
  await requestCode(client, phone, createUser);
  const token = await lastLoginCode(phone);
  const { data, error } = await client.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });
  if (error || !data.user) throw new Error(`verifyOtp: ${error?.message}`);
  return { client, user: data.user };
}

export async function resetDemo(): Promise<void> {
  const { error } = await adminClient().rpc("reset_demo");
  if (error) throw new Error(`reset_demo: ${error.message}`);
}
