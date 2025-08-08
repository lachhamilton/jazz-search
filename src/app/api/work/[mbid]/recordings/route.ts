import { NextResponse } from "next/server";
import { getAnonSupabase } from "@/lib/supabase";

function yearFromDate(date?: string | null): number | null {
  if (!date) return null;
  const m = /^(\d{4})/.exec(date);
  return m ? Number(m[1]) : null;
}

// Minimal MusicBrainz types we use
type MBArtistCredit = { name?: string };
type MBRelease = { id?: string; title?: string; date?: string };
interface MBRecording {
  id?: string;
  title?: string;
  isrcs?: string[];
  releases?: MBRelease[];
  [key: string]: unknown;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const { mbid } = await params;
  if (!mbid) return NextResponse.json({ recordings: [] });
  
  // Then search for recordings by work ID
  const url = new URL("https://musicbrainz.org/ws/2/recording");
  url.searchParams.set("query", `work:${mbid}`);
  url.searchParams.set("inc", "artists+releases+isrcs+artist-rels+work-rels+tags");
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "50");

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": `HeadHunter/0.1 (${appUrl})`,
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      console.error(`Work recordings API failed: ${res.status} ${res.statusText}`);
      return NextResponse.json({ recordings: [] });
    }
    const json: { recordings?: unknown } = (await res.json()) as { recordings?: unknown };
    const recs: MBRecording[] = Array.isArray(json?.recordings)
      ? (json.recordings as MBRecording[])
      : [];
    console.log(`Found ${recs.length} recordings for work ${mbid}`);

    const mapped = recs.map((r) => {
      const firstRelease: MBRelease | null = Array.isArray(r.releases) && r.releases.length > 0 ? r.releases[0] : null;
      const artistCredits = (r["artist-credit"] as MBArtistCredit[] | undefined) ?? [];
      const artistName = Array.isArray(artistCredits) && artistCredits.length > 0
        ? artistCredits.map((ac) => ac.name).filter(Boolean).join(", ")
        : null;
      const title = typeof r.title === "string" ? r.title : null;
      const recMbid = typeof r.id === "string" ? r.id : "";
      const releaseYear = yearFromDate(firstRelease?.date || null);
      const releaseTitle = firstRelease?.title || null;
      const isrc = Array.isArray(r.isrcs) && r.isrcs.length > 0 ? r.isrcs[0] : null;
      const releaseId = firstRelease?.id || null;
      const country = (firstRelease as { country?: string } | null)?.country ?? null;
      // Instruments from relations if present
      const relations: unknown = (r as { relations?: unknown } | undefined)?.relations;
      const instruments: string[] = Array.isArray(relations)
        ? (
            (relations as Array<{ attributes?: unknown }>)
              .flatMap((rel) => (Array.isArray(rel.attributes) ? rel.attributes : []))
              .filter((attr: unknown): attr is string => typeof attr === "string") as string[]
          )
        : [];
      const lengthMs = typeof (r as { length?: unknown })?.length === "number" ? ((r as { length?: number }).length as number) : null;
      const coverArt = releaseId
        ? `https://coverartarchive.org/release/${releaseId}/front-250`
        : null;
      return {
        mb_recording_id: recMbid,
        artist_name: artistName,
        track_title: title,
        album_name: releaseTitle,
        release_year: releaseYear,
        isrc,
        artwork_url: coverArt,
        country: country ? String(country) : null,
        instruments,
        length_ms: lengthMs,
      };
    });

    // Apply server-side filters from query params
    const { searchParams } = new URL(req.url);
    const fArtist = searchParams.get("artist")?.toLowerCase() ?? "";
    const fInstrument = searchParams.get("instrument")?.toLowerCase() ?? "";
    const fCountry = searchParams.get("country")?.toLowerCase() ?? "";
    const fYearFrom = Number(searchParams.get("year_from") ?? "");
    const fYearTo = Number(searchParams.get("year_to") ?? "");
    const fLenFromSec = Number(searchParams.get("length_from") ?? "");
    const fLenToSec = Number(searchParams.get("length_to") ?? "");
    const sort = (searchParams.get("sort") || "votes_desc").toLowerCase();

    let filtered = mapped;
    if (fArtist) {
      filtered = filtered.filter((r) => (r.artist_name ?? "").toLowerCase().includes(fArtist));
    }
    if (!Number.isNaN(fYearFrom)) {
      filtered = filtered.filter((r) => (r.release_year ?? 0) >= fYearFrom);
    }
    if (!Number.isNaN(fYearTo)) {
      filtered = filtered.filter((r) => (r.release_year ?? 9999) <= fYearTo);
    }
    if (fInstrument) {
      filtered = filtered.filter((r) => (r.instruments ?? []).some((i) => i.toLowerCase().includes(fInstrument)));
    }
    if (fCountry) {
      filtered = filtered.filter((r) => (r.country ?? "").toLowerCase().includes(fCountry));
    }
    if (!Number.isNaN(fLenFromSec)) {
      const fromMs = Math.round(fLenFromSec * 1000);
      filtered = filtered.filter((r) => (r.length_ms ?? 0) >= fromMs);
    }
    if (!Number.isNaN(fLenToSec)) {
      const toMs = Math.round(fLenToSec * 1000);
      filtered = filtered.filter((r) => (r.length_ms ?? 0) <= toMs);
    }

    // Overlay votes from Supabase by mb_recording_id if the column exists
    const votesByMbId: Record<string, number> = {};
    try {
      const supabase = getAnonSupabase();
      const mbids = mapped.map((m) => m.mb_recording_id);
      const { data } = await supabase
        .from("recordings")
        .select("musicbrainz_recording_id, votes(count)")
        .in("musicbrainz_recording_id", mbids as string[]);
      if (Array.isArray(data)) {
        for (const row of data as Array<{ musicbrainz_recording_id?: string | null; votes?: Array<{ count?: number | null }> }>) {
          const count = Array.isArray(row.votes) && row.votes[0]?.count ? Number(row.votes[0].count) : 0;
          if (row.musicbrainz_recording_id) votesByMbId[row.musicbrainz_recording_id] = count;
        }
      }
    } catch {
      // overlay not available yet
    }

    const withVotes = filtered.map((m) => ({ ...m, votes_count: votesByMbId[m.mb_recording_id] ?? 0 }));

    const sorters: Record<string, (a: typeof withVotes[number], b: typeof withVotes[number]) => number> = {
      votes_desc: (a, b) => (b.votes_count ?? 0) - (a.votes_count ?? 0),
      year_asc: (a, b) => (a.release_year ?? 9999) - (b.release_year ?? 9999),
      year_desc: (a, b) => (b.release_year ?? -1) - (a.release_year ?? -1),
      length_asc: (a, b) => (a.length_ms ?? Number.MAX_SAFE_INTEGER) - (b.length_ms ?? Number.MAX_SAFE_INTEGER),
      length_desc: (a, b) => (b.length_ms ?? -1) - (a.length_ms ?? -1),
      artist_asc: (a, b) => (a.artist_name ?? "").localeCompare(b.artist_name ?? ""),
      track_asc: (a, b) => (a.track_title ?? "").localeCompare(b.track_title ?? ""),
    };
    const sorter = sorters[sort] ?? sorters.votes_desc;
    withVotes.sort(sorter);

    return NextResponse.json({ recordings: withVotes });
  } catch {
    return NextResponse.json({ recordings: [] });
  }
}


