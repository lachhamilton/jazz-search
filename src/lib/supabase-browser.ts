"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "./supabase";

export function getBrowserSupabase() {
  return createClientComponentClient<Database>();
}


