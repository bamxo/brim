import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

declare global {
  // eslint-disable-next-line no-var
  var supabaseGlobal: ReturnType<typeof createClient>;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.supabaseGlobal) {
    global.supabaseGlobal = createClient(supabaseUrl, supabaseServiceRoleKey);
  }
}

const supabase =
  global.supabaseGlobal ?? createClient(supabaseUrl, supabaseServiceRoleKey);

export default supabase;
