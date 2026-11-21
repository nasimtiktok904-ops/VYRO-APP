import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://ppdcepnkaikwigundfvm.supabase.co";

export const SUPABASE_ANON_KEY = "তোমার দেওয়া Publishable key";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
