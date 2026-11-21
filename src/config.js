import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  "https://ppdcepnkaikwigundfvm.supabase.co";

export const SUPABASE_ANON_KEY =
  "sb_publishable_pNyYCguPPNqX-x94cpWfRw_K72Mf_kR";

async function safeFetch(input, init = {}) {
  const headers = {};

  if (init.headers instanceof Headers) {
    init.headers.forEach((value, key) => {
      headers[key] = value.replace(/[^\x00-\xFF]/g, "");
    });
  } else if (Array.isArray(init.headers)) {
    init.headers.forEach(([key, value]) => {
      headers[key] = String(value).replace(/[^\x00-\xFF]/g, "");
    });
  } else {
    Object.entries(init.headers || {}).forEach(([key, value]) => {
      headers[key] = String(value).replace(/[^\x00-\xFF]/g, "");
    });
  }

  return fetch(input, {
    ...init,
    headers
  });
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    global: {
      fetch: safeFetch
    }
  }
);
