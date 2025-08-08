"use server";

import { getServerSupabase } from "@/lib/supabase";

type VoteArgs =
  | { recordingId: string }
  | {
      mbRecordingId: string;
      artistName?: string | null;
      trackTitle?: string | null;
      albumName?: string | null;
      releaseYear?: number | null;
      isrc?: string | null;
    };

export async function voteForRecording(args: VoteArgs) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, reason: "auth" as const };
  }

  let recordingId: string | null = null;

  if ("recordingId" in args) {
    recordingId = args.recordingId;
  } else if ("mbRecordingId" in args) {
    try {
      const { data: existing } = await supabase
        .from("recordings")
        .select("id")
        // @ts-expect-error generated DB types not present; eq typing is too strict here
        .eq("musicbrainz_recording_id", args.mbRecordingId)
        .limit(1)
        .maybeSingle();

      if (existing && typeof (existing as any).id === "string") {
        recordingId = (existing as any).id as string;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("recordings")
          .insert({
            musicbrainz_recording_id: args.mbRecordingId,
            artist_name: args.artistName ?? null,
            track_title: args.trackTitle ?? null,
            album_name: args.albumName ?? null,
            release_year: args.releaseYear ?? null,
            isrc: args.isrc ?? null,
          } as never)
          .select("id")
          .single();
        if (insertError || !inserted || typeof (inserted as any).id !== "string") throw insertError ?? new Error("insert failed");
        recordingId = (inserted as any).id as string;
      }
    } catch (_e) {
      // Column may not exist if migration hasn't run; fail gracefully
      return { ok: false as const, reason: "db" as const };
    }
  }

  if (!recordingId) {
    return { ok: false as const, reason: "db" as const };
  }

  const { error } = await supabase
    .from("votes")
    .insert({ user_id: user.id, recording_id: recordingId } as never);

  if (error) {
    return { ok: false as const, reason: "db" as const };
  }

  return { ok: true as const };
}


