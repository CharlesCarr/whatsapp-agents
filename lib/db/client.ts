import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

// Service role client — bypasses RLS, used for all server-side operations.
// Never expose this key to the browser.
export const db = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});
