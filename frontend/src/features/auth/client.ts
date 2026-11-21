import { createClient } from "@supabase/supabase-js";

export const accountMode = process.env.NEXT_PUBLIC_STORAGE_MODE === "supabase";
let client: ReturnType<typeof createClient> | undefined;
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("กรุณาตั้งค่า Supabase URL และ publishable key");
  client ??= createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
export async function authHeaders(): Promise<Record<string, string>> {
  if (!accountMode) return {};
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
  return { Authorization: `Bearer ${data.session.access_token}` };
}
