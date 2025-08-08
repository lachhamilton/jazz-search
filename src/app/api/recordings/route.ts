import { NextRequest, NextResponse } from "next/server";
import { getAnonSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ recordings: [] }, { status: 200 });
  }

  const supabase = getAnonSupabase();

  const { data: standards } = await supabase
    .from("standards")
    .select("id,slug")
    .eq("slug", slug)
    .limit(1);

  if (!standards || standards.length === 0) {
    return NextResponse.json({ recordings: [] }, { status: 200 });
  }

  const standardId = standards[0].id as string;

  type ServiceLinkRow = { track_id?: string | null; services?: { name?: string | null; base_url?: string | null } | null };
  type VoteAgg = { count?: number | null };
  type RecordingRow = {
    id: string;
    isrc: string | null;
    artist_name: string | null;
    track_title: string | null;
    album_name: string | null;
    release_year: number | null;
    artwork_url: string | null;
    service_track_ids?: ServiceLinkRow[] | null;
    votes?: VoteAgg[] | null;
  };

  const { data: raw, error } = await supabase
    .from("recordings")
    .select(
      [
        "id",
        "isrc",
        "artist_name",
        "track_title",
        "album_name",
        "release_year",
        "artwork_url",
        "service_track_ids( track_id, services(name, base_url) )",
        "votes(count)",
      ].join(",")
    )
    .eq("standard_id", standardId)
    .limit(50);

  if (error) {
    console.error("recordings fetch error", error.message);
    return NextResponse.json({ recordings: [] }, { status: 200 });
  }

  function isRecordingRow(value: unknown): value is RecordingRow {
    if (typeof value !== "object" || value === null) return false;
    const obj = value as Record<string, unknown>;
    return typeof obj.id === "string";
  }

  const rowsUnknown = Array.isArray(raw) ? (raw as unknown[]) : [];
  const rows: RecordingRow[] = rowsUnknown.filter(isRecordingRow);

  const recordings = rows.map((r) => {
    const links = Array.isArray(r.service_track_ids)
      ? r.service_track_ids
          .map((sti) => {
            const svc = sti?.services;
            const baseUrl = svc?.base_url ?? undefined;
            const trackId = sti?.track_id ?? undefined;
            if (!baseUrl || !trackId) return null;
            return {
              name: String(svc?.name ?? ""),
              url: String(baseUrl) + String(trackId),
            };
          })
          .filter((v): v is { name: string; url: string } => Boolean(v))
      : [];
    const votesCount = Array.isArray(r.votes) && r.votes[0]?.count ? Number(r.votes[0].count) : 0;
    return {
      id: r.id,
      isrc: r.isrc,
      artist_name: r.artist_name,
      track_title: r.track_title,
      album_name: r.album_name,
      release_year: r.release_year,
      artwork_url: r.artwork_url,
      links,
      votes_count: votesCount,
    };
  });

  // sort by votes desc, then oldest first by year
  recordings.sort((a, b) => {
    if ((b.votes_count ?? 0) !== (a.votes_count ?? 0)) {
      return (b.votes_count ?? 0) - (a.votes_count ?? 0);
    }
    const ay = a.release_year ?? 9999;
    const by = b.release_year ?? 9999;
    return ay - by;
  });

  return NextResponse.json({ recordings });
}


