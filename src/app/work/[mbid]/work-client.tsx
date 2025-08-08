"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { voteForRecording } from "@/app/actions/vote";
import { Chip } from "@/components/ui/chip";
import { Info, Filter, Music, Disc } from "lucide-react";

type MbRecording = {
  mb_recording_id: string;
  artist_name: string | null;
  track_title: string | null;
  album_name: string | null;
  release_year: number | null;
  isrc: string | null;
  artwork_url: string | null;
  votes_count?: number;
  country?: string | null;
  instruments?: string[];
  length_ms?: number | null;
};

async function fetchWorkRecordings(mbid: string, qs: URLSearchParams): Promise<MbRecording[]> {
  try {
    const res = await fetch(`/api/work/${encodeURIComponent(mbid)}/recordings?${qs.toString()}`);
    if (!res.ok) {
      console.error(`Work recordings API failed: ${res.status} ${res.statusText}`);
      return [];
    }
    const json = (await res.json()) as { recordings: MbRecording[] };
    console.log(`Server returned ${json.recordings?.length || 0} recordings`);
    return json.recordings || [];
  } catch (error) {
    console.error("Error fetching work recordings:", error);
    return [];
  }
}

type Props = {
  mbid: string;
};

export function WorkClient({ mbid }: Props) {
  const [artistFilter, setArtistFilter] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [instrumentFilter, setInstrumentFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [lenFrom, setLenFrom] = useState("");
  const [lenTo, setLenTo] = useState("");
  const [sort, setSort] = useState("votes_desc");
  const [showFilters, setShowFilters] = useState(false);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (artistFilter) p.set("artist", artistFilter);
    if (instrumentFilter) p.set("instrument", instrumentFilter);
    if (countryFilter) p.set("country", countryFilter);
    if (yearFrom) p.set("year_from", yearFrom);
    if (yearTo) p.set("year_to", yearTo);
    if (lenFrom) p.set("length_from", lenFrom);
    if (lenTo) p.set("length_to", lenTo);
    if (sort) p.set("sort", sort);
    return p;
  }, [artistFilter, instrumentFilter, countryFilter, yearFrom, yearTo, lenFrom, lenTo, sort]);

  const { data, isLoading } = useQuery({
    queryKey: ["work-recordings", mbid, qs.toString()],
    queryFn: () => fetchWorkRecordings(mbid, qs),
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Client-side fallback for recordings
  const [clientRecordings, setClientRecordings] = useState<MbRecording[] | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  useEffect(() => {
    console.log("Work client useEffect triggered - mbid:", mbid, "isLoading:", isLoading, "data length:", data?.length);
    
    async function clientFallback() {
      if (!mbid) return;
      console.log("Starting client fallback for work:", mbid);
      setClientLoading(true);
      try {
        // Search for recordings by work ID directly
        const recUrl = `https://musicbrainz.org/ws/2/recording?query=work:${mbid}&fmt=json&limit=20&inc=artists+releases+isrcs`;
        const recRes = await fetch(recUrl, {
          headers: { 
            Accept: "application/json",
            "User-Agent": "HeadHunter/0.1 (http://localhost:3000)"
          }
        });
        
        if (!recRes.ok) {
          setClientRecordings([]);
          return;
        }
        
        const recJson = (await recRes.json()) as { recordings?: Array<{
          id?: string;
          title?: string;
          "artist-credit"?: Array<{ name?: string }>;
          releases?: Array<{ title?: string; date?: string; id?: string }>;
          length?: number;
        }> };
        
        const recordings = Array.isArray(recJson?.recordings) ? recJson.recordings : [];
        const mapped: MbRecording[] = recordings.map((r) => {
          const firstRelease = Array.isArray(r.releases) && r.releases.length > 0 ? r.releases[0] : null;
          const artistCredits = Array.isArray(r["artist-credit"]) ? r["artist-credit"] : [];
          const artistName = artistCredits.map((ac) => ac.name).filter(Boolean).join(", ");
          const releaseYear = firstRelease?.date ? Number(firstRelease.date.slice(0, 4)) : null;
          const coverArt = firstRelease?.id ? `https://coverartarchive.org/release/${firstRelease.id}/front-250` : null;
          
          return {
            mb_recording_id: r.id || "",
            artist_name: artistName || null,
            track_title: r.title || null,
            album_name: firstRelease?.title || null,
            release_year: releaseYear,
            isrc: null,
            artwork_url: coverArt,
            country: null,
            instruments: [],
            length_ms: typeof r.length === "number" ? r.length : null,
            votes_count: 0,
          };
        });
        
        setClientRecordings(mapped);
      } catch (e) {
        console.error("Client fallback error:", e);
        setClientRecordings([]);
      } finally {
        setClientLoading(false);
      }
    }

    // Only run client fallback if server data is empty or loading is done
    if (!isLoading && (!data || data.length === 0)) {
      console.log("Triggering client fallback for work - no server data");
      clientFallback();
    } else if (isLoading) {
      setClientRecordings(null);
    } else if (data && data.length > 0) {
      console.log("Server data available, clearing client recordings");
      setClientRecordings(null);
    }
  }, [mbid, isLoading, data]);

  const filtered = useMemo(() => {
    // Use client recordings if server data is empty
    const recordings = data ?? clientRecordings ?? [];
    return recordings;
  }, [data, clientRecordings]);

  async function onVote(rec: MbRecording) {
    const result = await voteForRecording({
      mbRecordingId: rec.mb_recording_id,
      artistName: rec.artist_name,
      trackTitle: rec.track_title,
      albumName: rec.album_name,
      releaseYear: rec.release_year,
      isrc: rec.isrc,
    });
    if (!result.ok) {
      toast.error(result.reason === "auth" ? "Please sign in to vote." : "Could not register vote.");
      return;
    }
    toast.success("Voted! Thanks.");
  }

  return (
    <div className="container py-8 space-y-6">
      {/* MusicBrainz Concept Explanation */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">Understanding MusicBrainz</h3>
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <p><strong>Work</strong> <Music className="w-4 h-4 inline" /> = The composition itself (like "Take Five" the song)</p>
              <p><strong>Recording</strong> <Disc className="w-4 h-4 inline" /> = A specific performance of that work (like Dave Brubeck's 1959 recording)</p>
              <p>You're viewing recordings of this composition. Each card shows a different artist's interpretation.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Filter Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Recordings</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          {showFilters ? "Hide" : "Show"} Filters
        </Button>
      </div>

      {/* Collapsible Filters */}
      {showFilters && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Artist</label>
              <Input 
                value={artistFilter} 
                onChange={(e) => setArtistFilter(e.target.value)} 
                placeholder="Coltrane" 
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Year Range</label>
              <div className="flex gap-1">
                <Input 
                  value={yearFrom} 
                  onChange={(e) => setYearFrom(e.target.value)} 
                  placeholder="1950" 
                  className="h-8 text-sm"
                />
                <Input 
                  value={yearTo} 
                  onChange={(e) => setYearTo(e.target.value)} 
                  placeholder="1965" 
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Country</label>
              <Input 
                value={countryFilter} 
                onChange={(e) => setCountryFilter(e.target.value)} 
                placeholder="US" 
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Sort By</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-8 rounded-md border bg-background px-3 text-sm w-full"
              >
                <option value="votes_desc">Top votes</option>
                <option value="year_desc">Newest</option>
                <option value="year_asc">Oldest</option>
                <option value="artist_asc">Artist A→Z</option>
                <option value="track_asc">Track A→Z</option>
              </select>
            </div>
          </div>

          {/* Instrument Chips */}
          <div>
            <label className="text-xs font-medium block mb-2">Instruments</label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Saxophone", value: "saxophone" },
                { label: "Piano", value: "piano" },
                { label: "Trumpet", value: "trumpet" },
                { label: "Guitar", value: "guitar" },
                { label: "Bass", value: "bass" },
                { label: "Drums", value: "drums" },
              ].map((opt) => (
                <Chip
                  key={opt.value}
                  selected={instrumentFilter.toLowerCase() === opt.value}
                  onClick={() => setInstrumentFilter(opt.value)}
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {(isLoading || clientLoading) ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rec) => (
            <Card key={rec.mb_recording_id} className="overflow-hidden hover:shadow-lg transition-all duration-200 hover:scale-105 cursor-pointer group">
              {rec.artwork_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={rec.artwork_url} alt="artwork" className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-200" />
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="group-hover:text-blue-600 transition-colors">{rec.track_title ?? "Untitled"}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{rec.votes_count ?? 0} votes</Badge>
                    {rec.release_year ? <Badge variant="outline">{rec.release_year}</Badge> : null}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">{rec.artist_name}</div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onVote(rec);
                    }}
                    className="hover:bg-blue-100 dark:hover:bg-blue-900"
                  >
                    Vote
                  </Button>
                  <div className="flex gap-2 ml-auto">
                    <a
                      className="text-xs text-muted-foreground hover:text-blue-600 transition-colors"
                      href={`https://open.spotify.com/search/${encodeURIComponent(rec.artist_name ?? "")} ${encodeURIComponent(rec.track_title ?? "")}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Spotify
                    </a>
                    <a
                      className="text-xs text-muted-foreground hover:text-blue-600 transition-colors"
                      href={`https://music.apple.com/us/search?term=${encodeURIComponent(rec.artist_name ?? "")} ${encodeURIComponent(rec.track_title ?? "")}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Apple
                    </a>
                    <a
                      className="text-xs text-muted-foreground hover:text-blue-600 transition-colors"
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(rec.artist_name ?? "")} ${encodeURIComponent(rec.track_title ?? "")}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      YouTube
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No recordings found.</p>
      )}
    </div>
  );
}
