import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://ppdcepnkaikwigundfvm.supabase.co";

export const SUPABASE_ANON_KEY = "sb_publishable_pNyYCguPPNqX-x94cpWfRw_K72Mf_kR";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
