import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./supabase/public";

let client = null;
export function db() {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL || SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}
