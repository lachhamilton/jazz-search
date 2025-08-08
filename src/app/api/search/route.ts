import { NextRequest, NextResponse } from "next/server";
import { getAnonSupabase } from "@/lib/supabase";

function slugify(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, "_");
}

type UnifiedResult =
  | { type: "work"; id: string; title: string; subtitle?: string | null; artwork_url?: string | null }
  | { type: "recording"; id: string; title: string; subtitle?: string | null; year?: number | null; artwork_url?: string | null }
  | { type: "artist"; id: string; title: string; subtitle?: string | null; artwork_url?: string | null }
  | { type: "release"; id: string; title: string; subtitle?: string | null; year?: number | null; artwork_url?: string | null }
  | { type: "local-standard"; id: string; title: string; slug: string; artwork_url?: string | null };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const artist = (searchParams.get("artist") ?? "").trim();
  const instrument = (searchParams.get("instrument") ?? "").trim();
  const yearFrom = Number(searchParams.get("year_from") ?? "");
  const yearTo = Number(searchParams.get("year_to") ?? "");
  if (!q) return NextResponse.json({ results: [] });

  // Build MB Lucene queries
  const recParts: string[] = [];
  recParts.push(`recording:"${q}"`);
  if (artist) recParts.push(`artist:"${artist}"`);
  if (!Number.isNaN(yearFrom) || !Number.isNaN(yearTo)) {
    const from = Number.isNaN(yearFrom) ? "0000" : String(yearFrom);
    const to = Number.isNaN(yearTo) ? "9999" : String(yearTo);
    recParts.push(`date:[${from} TO ${to}]`);
  }
  if (instrument) recParts.push(`tag:${instrument}`);
  const recQuery = recParts.join(" AND ");

  const relParts: string[] = [];
  relParts.push(`release:"${q}"`);
  if (artist) relParts.push(`artist:"${artist}"`);
  if (!Number.isNaN(yearFrom) || !Number.isNaN(yearTo)) {
    const from = Number.isNaN(yearFrom) ? "0000" : String(yearFrom);
    const to = Number.isNaN(yearTo) ? "9999" : String(yearTo);
    relParts.push(`date:[${from} TO ${to}]`);
  }
  const relQuery = relParts.join(" AND ");

  const workQuery = q;
  const artistQuery = `artist:"${q}"`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const headers = { "User-Agent": `JazzSearch/0.1 (${appUrl})`, Accept: "application/json" } as const;

  const urls = {
    work: `https://musicbrainz.org/ws/2/work?query=${encodeURIComponent(workQuery)}&fmt=json&limit=6`,
    recording: `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(recQuery)}&fmt=json&limit=6`,
    artist: `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(artistQuery)}&fmt=json&limit=6`,
    release: `https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(relQuery)}&fmt=json&limit=6`,
  } as const;

  const [workRes, recRes, artRes, relRes, localRes] = await Promise.all([
    fetch(urls.work, { headers, next: { revalidate: 60 } }).catch((e) => {
      console.error("Work fetch failed:", e);
      return null;
    }),
    fetch(urls.recording, { headers, next: { revalidate: 60 } }).catch((e) => {
      console.error("Recording fetch failed:", e);
      return null;
    }),
    fetch(urls.artist, { headers, next: { revalidate: 60 } }).catch((e) => {
      console.error("Artist fetch failed:", e);
      return null;
    }),
    fetch(urls.release, { headers, next: { revalidate: 60 } }).catch((e) => {
      console.error("Release fetch failed:", e);
      return null;
    }),
    (async () => {
      try {
        const supabase = getAnonSupabase();
        const { data } = await supabase
          .from("standards")
          .select("id,title,slug")
          .ilike("title", `%${q}%`)
          .limit(5);
        return data ?? [];
      } catch {
        return [] as Array<{ id: string; title: string; slug: string }>;
      }
    })(),
  ]);

  const results: UnifiedResult[] = [];

  try {
    if (workRes && workRes.ok) {
      const json = (await workRes.json()) as { works?: Array<{ id?: string; title?: string; iswcs?: string[] }> };
      const works = Array.isArray(json?.works) ? json.works : [];
      for (const w of works) {
        const id = typeof w.id === "string" ? w.id : undefined;
        const title = typeof w.title === "string" ? w.title : undefined;
        if (id && title) results.push({ type: "work", id, title });
      }
    }
  } catch {}

  try {
    if (recRes && recRes.ok) {
      type AC = { name?: string };
      type Rel = { date?: string };
      type Rec = { id?: string; title?: string; releases?: Rel[]; } & Record<string, unknown>;
      const json = (await recRes.json()) as { recordings?: unknown };
      const recs: Rec[] = Array.isArray(json?.recordings) ? (json.recordings as Rec[]) : [];
      for (const r of recs) {
        const id = typeof r.id === "string" ? r.id : undefined;
        const title = typeof r.title === "string" ? r.title : undefined;
        const acRaw = (r as Record<string, unknown>)["artist-credit"] as unknown;
        const ac: AC[] = Array.isArray(acRaw) ? (acRaw as AC[]) : [];
        const subtitle = ac.map((x) => x?.name).filter(Boolean).join(", ");
        const firstRel = Array.isArray(r.releases) && r.releases[0] ? r.releases[0] : null;
        const year = firstRel && typeof firstRel.date === "string" ? Number((firstRel.date as string).slice(0, 4)) : null;
        const cover = firstRel && (firstRel as { id?: string }).id ? `https://coverartarchive.org/release/${(firstRel as { id?: string }).id}/front-250` : null;
        if (id && title) results.push({ type: "recording", id, title, subtitle: subtitle || null, year, artwork_url: cover });
      }
    }
  } catch {}

  try {
    if (artRes && artRes.ok) {
      const json = (await artRes.json()) as { artists?: Array<{ id?: string; name?: string; disambiguation?: string }> };
      const arts = Array.isArray(json?.artists) ? json.artists : [];
      for (const a of arts) {
        const id = typeof a.id === "string" ? a.id : undefined;
        const title = typeof a.name === "string" ? a.name : undefined;
        const subtitle = a.disambiguation ?? null;
        if (id && title) results.push({ type: "artist", id, title, subtitle });
      }
    }
  } catch {}

  try {
    if (relRes && relRes.ok) {
      const json = (await relRes.json()) as { releases?: Array<{ id?: string; title?: string; date?: string }> };
      const rels = Array.isArray(json?.releases) ? json.releases : [];
      for (const r of rels) {
        const id = typeof r.id === "string" ? r.id : undefined;
        const title = typeof r.title === "string" ? r.title : undefined;
        const year = typeof r.date === "string" ? Number(r.date.slice(0, 4)) : null;
        const cover = id ? `https://coverartarchive.org/release/${id}/front-250` : null;
        if (id && title) results.push({ type: "release", id, title, subtitle: "Album", year, artwork_url: cover });
      }
    }
  } catch {}

  try {
    const locals = Array.isArray(localRes) ? localRes : [];
    for (const s of locals) {
      if (s?.id && s?.title && s?.slug) {
        results.push({ type: "local-standard", id: String(s.id), title: String(s.title), slug: String(s.slug) });
      }
    }
  } catch {}

  return NextResponse.json({ results });
}


