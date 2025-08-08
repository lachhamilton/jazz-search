"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type MbTrack = {
  id: string;
  title: string;
  length_ms?: number | null;
  artist_credit?: string | null;
  isrc?: string | null;
};

type MbRelease = {
  id: string;
  title: string;
  date?: string | null;
  country?: string | null;
  artist_credit?: string | null;
  tracks: MbTrack[];
  cover_art?: string | null;
  genre?: string | null;
  label?: string | null;
  barcode?: string | null;
  status?: string | null;
  packaging?: string | null;
  media?: Array<{
    format?: string;
    tracks?: number;
  }>;
};

async function fetchRelease(mbid: string): Promise<MbRelease | null> {
  const res = await fetch(`/api/release/${encodeURIComponent(mbid)}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { release: MbRelease };
  return json.release;
}

type Props = {
  mbid: string;
};

export function ReleaseClient({ mbid }: Props) {
  const { data: release, isLoading } = useQuery({
    queryKey: ["release", mbid],
    queryFn: () => fetchRelease(mbid),
    retry: 1,
  });

  // Client-side fallback for release data
  const [clientRelease, setClientRelease] = useState<MbRelease | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  useEffect(() => {
    console.log("Release client useEffect triggered - mbid:", mbid, "isLoading:", isLoading, "release:", release);
    
    async function clientFallback() {
      if (!mbid) return;
      console.log("Starting client fallback for release:", mbid);
      setClientLoading(true);
      try {
        const releaseUrl = `https://musicbrainz.org/ws/2/release/${mbid}?inc=recordings+artists+isrcs+labels+release-groups&fmt=json`;
        const releaseRes = await fetch(releaseUrl, {
          headers: { 
            Accept: "application/json",
            "User-Agent": "JazzSearch/0.1 (http://localhost:3000)"
          }
        });
        
        if (!releaseRes.ok) {
          setClientRelease(null);
          return;
        }
        
        const releaseJson = (await releaseRes.json()) as {
          id?: string;
          title?: string;
          date?: string;
          country?: string;
          status?: string;
          packaging?: string;
          barcode?: string;
          "artist-credit"?: Array<{ name?: string }>;
          "track-list"?: Array<{
            id?: string;
            title?: string;
            length?: number;
            "artist-credit"?: Array<{ name?: string }>;
            isrcs?: string[];
          }>;
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

        const release = releaseJson;
        
        if (!release?.id || !release?.title) {
          setClientRelease(null);
          return;
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
        
        setClientRelease({
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
        });
      } catch (e) {
        console.error("Client fallback error:", e);
        setClientRelease(null);
      } finally {
        setClientLoading(false);
      }
    }

    // Only run client fallback if server data is empty or loading is done
    if (!isLoading && (!release || release === null)) {
      console.log("Triggering client fallback for release - no server data");
      clientFallback();
    } else if (isLoading) {
      setClientRelease(null);
    }
  }, [mbid, isLoading, release]);

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

  const displayRelease = release || clientRelease;
  if (!displayRelease) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">Release not found.</p>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex gap-6">
        {displayRelease.cover_art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayRelease.cover_art} alt="cover" className="w-48 h-48 object-cover rounded-lg shadow-lg" />
        )}
        <div className="space-y-4 flex-1">
          <div>
            <h1 className="text-3xl font-bold mb-2">{displayRelease.title}</h1>
            {displayRelease.artist_credit && (
              <p className="text-lg text-muted-foreground mb-4">{displayRelease.artist_credit}</p>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {displayRelease.date && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Released:</span>
                  <Badge variant="outline">{displayRelease.date}</Badge>
                </div>
              )}
              {displayRelease.country && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Country:</span>
                  <Badge variant="secondary">{displayRelease.country}</Badge>
                </div>
              )}
              {displayRelease.genre && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Genre:</span>
                  <Badge variant="outline">{displayRelease.genre}</Badge>
                </div>
              )}
              {displayRelease.label && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Label:</span>
                  <span className="text-sm">{displayRelease.label}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              {displayRelease.status && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant="secondary">{displayRelease.status}</Badge>
                </div>
              )}
              {displayRelease.packaging && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Packaging:</span>
                  <span className="text-sm">{displayRelease.packaging}</span>
                </div>
              )}
              {displayRelease.barcode && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Barcode:</span>
                  <span className="text-sm font-mono">{displayRelease.barcode}</span>
                </div>
              )}
              {displayRelease.media && displayRelease.media.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Format:</span>
                  <span className="text-sm">{displayRelease.media[0].format}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Tracks</h2>
          <div className="text-sm text-muted-foreground">
            {displayRelease.tracks.length} track{displayRelease.tracks.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="grid gap-3">
          {displayRelease.tracks.map((track, index) => (
            <Card key={`${track.id}-${index}`} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4 flex-1">
                  <span className="text-sm text-muted-foreground w-8 font-medium">{index + 1}</span>
                  <div className="flex-1">
                    <div className="font-medium text-base">{track.title}</div>
                    {track.artist_credit && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {track.artist_credit}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {track.length_ms && (
                    <Badge variant="outline" className="text-xs">
                      {Math.floor(track.length_ms / 60000)}:{(Math.floor(track.length_ms / 1000) % 60).toString().padStart(2, '0')}
                    </Badge>
                  )}
                  {track.isrc && (
                    <Badge variant="secondary" className="text-xs font-mono">
                      {track.isrc}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
