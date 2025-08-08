import { NextResponse } from "next/server";

type MbRecording = {
  id?: string;
  title?: string;
  length?: number | null;
  releases?: Array<{ title?: string; date?: string }>;
};

type MbRelease = {
  id?: string;
  title?: string;
  date?: string;
  country?: string;
};

type MbArtist = {
  id?: string;
  name?: string;
  disambiguation?: string;
  country?: string;
  "life-span"?: {
    begin?: string;
    end?: string;
  };
  recordings?: MbRecording[];
  releases?: MbRelease[];
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const { mbid } = await params;
  if (!mbid) return NextResponse.json({ artist: null });

  const url = new URL("https://musicbrainz.org/ws/2/artist");
  url.searchParams.set("mbid", mbid);
  url.searchParams.set("inc", "recordings+releases+tags");
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

    if (!res.ok) return NextResponse.json({ artist: null });

    const json = (await res.json()) as { artists?: MbArtist[] };
    const artists = Array.isArray(json?.artists) ? json.artists : [];
    const artist = artists[0];

    if (!artist?.id || !artist?.name) {
      return NextResponse.json({ artist: null });
    }

    const recordings: Array<{
      id: string;
      title: string;
      release_title?: string | null;
      release_date?: string | null;
      length_ms?: number | null;
    }> = [];

    const artistRecordings = Array.isArray(artist.recordings) ? artist.recordings : [];
    for (const recording of artistRecordings.slice(0, 10)) {
      if (!recording.id || !recording.title) continue;

      const firstRelease = Array.isArray(recording.releases) && recording.releases.length > 0
        ? recording.releases[0]
        : null;

      recordings.push({
        id: recording.id,
        title: recording.title,
        release_title: firstRelease?.title || null,
        release_date: firstRelease?.date || null,
        length_ms: typeof recording.length === "number" ? recording.length : null,
      });
    }

    const releases: Array<{
      id: string;
      title: string;
      date?: string | null;
      country?: string | null;
    }> = [];

    const artistReleases = Array.isArray(artist.releases) ? artist.releases : [];
    for (const release of artistReleases.slice(0, 10)) {
      if (!release.id || !release.title) continue;

      releases.push({
        id: release.id,
        title: release.title,
        date: release.date || null,
        country: release.country || null,
      });
    }

    return NextResponse.json({
      artist: {
        id: artist.id,
        name: artist.name,
        disambiguation: artist.disambiguation || null,
        country: artist.country || null,
        begin_date: artist["life-span"]?.begin || null,
        end_date: artist["life-span"]?.end || null,
        top_recordings: recordings,
        top_releases: releases,
      },
    });
  } catch {
    return NextResponse.json({ artist: null });
  }
}
