import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type PublicTable<Row, Insert = Row, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
};

export type Database = {
  public: {
    Tables: {
      votes: PublicTable<
        { user_id: string; recording_id: string; created_at: string | null },
        { user_id: string; recording_id: string },
        Partial<{ user_id: string; recording_id: string; created_at: string | null }>
      >;
      standards: PublicTable<
        { id: string; title: string; slug: string },
        { title: string },
        Partial<{ id: string; title: string; slug: string }>
      >;
      recordings: PublicTable<
        {
          id: string;
          isrc: string | null;
          standard_id: string | null;
          musicbrainz_recording_id: string | null;
          artist_name: string | null;
          track_title: string | null;
          album_name: string | null;
          release_year: number | null;
          artwork_url: string | null;
        },
        {
          isrc?: string | null;
          standard_id?: string | null;
          musicbrainz_recording_id?: string | null;
          artist_name?: string | null;
          track_title?: string | null;
          album_name?: string | null;
          release_year?: number | null;
          artwork_url?: string | null;
        }
      >;
      services: PublicTable<
        { id: number; name: string | null; base_url: string | null },
        { name?: string | null; base_url?: string | null }
      >;
      service_track_ids: PublicTable<
        {
          id: string;
          recording_id: string | null;
          service_id: number | null;
          track_id: string | null;
        },
        {
          recording_id?: string | null;
          service_id?: number | null;
          track_id?: string | null;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export async function getServerSupabase() {
  // Next.js 15: cookies() is async; await and pass a getter
  const cookieStore = await cookies();
  return createServerComponentClient<Database>({
    cookies: () => cookieStore,
  });
}

export function getAnonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Supabase env vars missing");
  }
  return createSupabaseClient<Database>(url, anon);
}


