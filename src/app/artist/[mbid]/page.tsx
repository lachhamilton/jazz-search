"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

type MbRecording = {
  id: string;
  title: string;
  release_title?: string | null;
  release_date?: string | null;
  length_ms?: number | null;
};

type MbRelease = {
  id: string;
  title: string;
  date?: string | null;
  country?: string | null;
};

type MbArtist = {
  id: string;
  name: string;
  disambiguation?: string | null;
  country?: string | null;
  begin_date?: string | null;
  end_date?: string | null;
  top_recordings: MbRecording[];
  top_releases: MbRelease[];
};

async function fetchArtist(mbid: string): Promise<MbArtist | null> {
  const res = await fetch(`/api/artist/${encodeURIComponent(mbid)}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { artist: MbArtist };
  return json.artist;
}

export default function ArtistPage() {
  const { mbid } = useParams<{ mbid: string }>();

  const { data: artist, isLoading } = useQuery({
    queryKey: ["artist", mbid],
    queryFn: () => fetchArtist(mbid),
    retry: 1,
  });

  // Client-side fallback for artist data
  const [clientArtist, setClientArtist] = useState<MbArtist | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  useEffect(() => {
    console.log("Artist page useEffect triggered - mbid:", mbid, "isLoading:", isLoading, "artist:", artist);
    
    async function clientFallback() {
      if (!mbid) return;
      console.log("Starting client fallback for artist:", mbid);
      setClientLoading(true);
      try {
        const artistUrl = `https://musicbrainz.org/ws/2/artist/${mbid}?inc=recordings+releases&fmt=json`;
        console.log("Fetching from:", artistUrl);
        const artistRes = await fetch(artistUrl, {
          headers: { 
            Accept: "application/json",
            "User-Agent": "JazzSearch/0.1 (http://localhost:3000)"
          }
        });
        
        console.log("Response status:", artistRes.status);
        if (!artistRes.ok) {
          console.log("Response not ok, status:", artistRes.status);
          setClientArtist(null);
          return;
        }
        
                        const artistJson = (await artistRes.json()) as {
                  id?: string;
                  name?: string;
                  disambiguation?: string;
                  country?: string;
                  "life-span"?: { begin?: string; end?: string };
                  recordings?: Array<{ id?: string; title?: string; length?: number; releases?: Array<{ title?: string; date?: string }> }>;
                  releases?: Array<{ id?: string; title?: string; date?: string; country?: string }>;
                };

                console.log("Artist JSON:", artistJson);
                const artist = artistJson;
        
        console.log("Found artist:", artist);
        if (!artist?.id || !artist?.name) {
          console.log("No valid artist found");
          setClientArtist(null);
          return;
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
        
        const result = {
          id: artist.id,
          name: artist.name,
          disambiguation: artist.disambiguation || null,
          country: artist.country || null,
          begin_date: artist["life-span"]?.begin || null,
          end_date: artist["life-span"]?.end || null,
          top_recordings: recordings,
          top_releases: releases,
        };
        console.log("Setting client artist:", result);
        setClientArtist(result);
      } catch (e) {
        console.error("Client fallback error:", e);
        setClientArtist(null);
      } finally {
        setClientLoading(false);
      }
    }

    // Always try client fallback if server data is empty or loading is done
    if (!isLoading && (!artist || artist === null)) {
      console.log("Triggering client fallback - no server data");
      clientFallback();
    } else if (isLoading) {
      setClientArtist(null);
    }
  }, [mbid, isLoading, artist]);

  if (isLoading || clientLoading) {
    return (
      <div className="container py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const displayArtist = artist || clientArtist;
  if (!displayArtist) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">Artist not found.</p>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">{displayArtist.name}</h1>
        {displayArtist.disambiguation && (
          <p className="text-lg text-muted-foreground">{displayArtist.disambiguation}</p>
        )}
        <div className="flex gap-2">
          {displayArtist.country && <Badge variant="outline">{displayArtist.country}</Badge>}
          {displayArtist.begin_date && <Badge variant="secondary">{displayArtist.begin_date}</Badge>}
          {displayArtist.end_date && <Badge variant="secondary">{displayArtist.end_date}</Badge>}
        </div>
      </div>

      {displayArtist.top_recordings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Top Recordings</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {displayArtist.top_recordings.map((recording) => (
              <Link key={recording.id} href={`/work/${recording.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 hover:scale-105 cursor-pointer group">
                  <CardHeader>
                    <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">{recording.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {recording.release_title && (
                      <div className="text-sm text-muted-foreground">{recording.release_title}</div>
                    )}
                    <div className="flex items-center gap-2">
                      {recording.release_date && (
                        <Badge variant="outline">{recording.release_date}</Badge>
                      )}
                      {recording.length_ms && (
                        <Badge variant="secondary">
                          {Math.round(recording.length_ms / 1000)}s
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {displayArtist.top_releases.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Top Releases</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {displayArtist.top_releases.map((release) => (
              <Link key={release.id} href={`/release/${release.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 hover:scale-105 cursor-pointer group">
                  <CardHeader>
                    <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">{release.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      {release.date && <Badge variant="outline">{release.date}</Badge>}
                      {release.country && <Badge variant="secondary">{release.country}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
