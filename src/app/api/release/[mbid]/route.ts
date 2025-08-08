import { NextResponse } from "next/server";

type MbTrack = {
  id?: string;
  title?: string;
  length?: number | null;
  "artist-credit"?: Array<{ name?: string }>;
  isrcs?: string[];
};

type MbRelease = {
  id?: string;
  title?: string;
  date?: string;
  country?: string;
  status?: string;
  packaging?: string;
  barcode?: string;
  "artist-credit"?: Array<{ name?: string }>;
  "track-list"?: MbTrack[];
  "release-group"?: {
    "primary-type"?: string;
    "secondary-types"?: string[];
  };
  "label-info"?: Array<{
    label?: {
      name?: string;
    };
  }>;
  media?: Array<{
    format?: string;
    "track-count"?: number;
  }>;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const { mbid } = await params;
  if (!mbid) return NextResponse.json({ release: null });

  const url = new URL("https://musicbrainz.org/ws/2/release");
  url.searchParams.set("mbid", mbid);
  url.searchParams.set("inc", "recordings+artists+isrcs+labels+release-groups");
  url.searchParams.set("fmt", "json");

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": `JazzSearch/0.1 (${appUrl})`,
        Accept: "application/json",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) return NextResponse.json({ release: null });

    const json = (await res.json()) as { releases?: MbRelease[] };
    const releases = Array.isArray(json?.releases) ? json.releases : [];
    const release = releases[0];

    if (!release?.id || !release?.title) {
      return NextResponse.json({ release: null });
    }

    const artistCredit = Array.isArray(release["artist-credit"])
      ? release["artist-credit"].map((ac) => ac.name).filter(Boolean).join(", ")
      : null;

    const tracks: Array<{
      id: string;
      title: string;
      length_ms?: number | null;
      artist_credit?: string | null;
      isrc?: string | null;
    }> = [];

    const trackList = Array.isArray(release["track-list"]) ? release["track-list"] : [];
    for (const track of trackList) {
      if (!track.id || !track.title) continue;

      const trackArtistCredit = Array.isArray(track["artist-credit"])
        ? track["artist-credit"].map((ac) => ac.name).filter(Boolean).join(", ")
        : null;

      const isrc = Array.isArray(track.isrcs) && track.isrcs.length > 0 ? track.isrcs[0] : null;

      tracks.push({
        id: track.id,
        title: track.title,
        length_ms: typeof track.length === "number" ? track.length : null,
        artist_credit: trackArtistCredit,
        isrc,
      });
    }

    const coverArt = `https://coverartarchive.org/release/${release.id}/front-250`;
    
    // Extract additional information
    const genre = release["release-group"]?.["primary-type"] || null;
    const label = release["label-info"]?.[0]?.label?.name || null;
    const barcode = release.barcode || null;
    const status = release.status || null;
    const packaging = release.packaging || null;
    const media = release.media?.map(m => ({
      format: m.format || undefined,
      tracks: m["track-count"] || undefined,
    })) || [];

    return NextResponse.json({
      release: {
        id: release.id,
        title: release.title,
        date: release.date || null,
        country: release.country || null,
        artist_credit: artistCredit,
        tracks,
        cover_art: coverArt,
        genre,
        label,
        barcode,
        status,
        packaging,
        media,
      },
    });
  } catch {
    return NextResponse.json({ release: null });
  }
}
