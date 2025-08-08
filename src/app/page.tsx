"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Link from "next/link";
import { Search, Music, User, Disc, Info } from "lucide-react";

type UnifiedResult = {
  type: "work" | "recording" | "artist" | "release";
  id: string;
  title: string;
  subtitle?: string | null;
  year?: number | null;
  artist?: string | null;
  artwork?: string | null;
};

async function searchMusicBrainz(query: string): Promise<UnifiedResult[]> {
  if (!query.trim()) return [];

  const headers = {
    Accept: "application/json",
    "User-Agent": "JazzSearch/0.1 (http://localhost:3000)"
  } as const;

  // Add jazz-specific filtering
  const jazzFilter = " AND (tag:jazz OR genre:jazz OR tag:jazz-standard OR tag:jazz-composition)";
  const queryWithJazz = query + jazzFilter;

  const urls = {
    work: `https://musicbrainz.org/ws/2/work?query=${encodeURIComponent(queryWithJazz)}&fmt=json&limit=6&inc=artist-credits`,
    recording: `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(queryWithJazz)}&fmt=json&limit=6`,
    artist: `https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(query)} AND (tag:jazz OR genre:jazz)&fmt=json&limit=6`,
    release: `https://musicbrainz.org/ws/2/release?query=${encodeURIComponent(queryWithJazz)}&fmt=json&limit=6`,
  };

  try {
    const [workRes, recRes, artRes, relRes] = await Promise.all([
      fetch(urls.work, { headers }).catch(() => null),
      fetch(urls.recording, { headers }).catch(() => null),
      fetch(urls.artist, { headers }).catch(() => null),
      fetch(urls.release, { headers }).catch(() => null),
    ]);

    const results: UnifiedResult[] = [];

    // Process works
    if (workRes && workRes.ok) {
      const jw = (await workRes.json()) as { works?: Array<{ 
        id?: string; 
        title?: string; 
        "artist-credit"?: Array<{ name?: string }>;
        "first-release-date"?: string;
        disambiguation?: string;
      }> };
      const works = Array.isArray(jw?.works) ? jw.works : [];
      for (const w of works) {
        if (typeof w.id === "string" && typeof w.title === "string") {
          const artistCredit = Array.isArray(w["artist-credit"]) ? w["artist-credit"].map((ac) => ac.name).filter(Boolean).join(", ") : null;
          const yearWritten = w["first-release-date"] ? Number(w["first-release-date"].slice(0, 4)) : null;
          
          // Create better subtitle based on available data
          let subtitle = "Jazz Composition";
          if (artistCredit) {
            subtitle = `Composed by ${artistCredit}`;
            if (yearWritten) {
              subtitle += ` (${yearWritten})`;
            }
          } else if (yearWritten) {
            subtitle = `Composed ${yearWritten}`;
          } else {
            subtitle = "Jazz Standard";
          }
          
          results.push({ 
            type: "work", 
            id: w.id, 
            title: w.title,
            subtitle,
            artist: artistCredit,
            year: yearWritten
          });
        }
      }
    }

    // Process recordings
    if (recRes && recRes.ok) {
      const jr = (await recRes.json()) as { recordings?: Array<{ id?: string; title?: string; "artist-credit"?: Array<{ name?: string }>; releases?: Array<{ title?: string; date?: string; id?: string }> }> };
      const recs = Array.isArray(jr?.recordings) ? jr.recordings : [];
      for (const r of recs) {
        const id = typeof r.id === "string" ? r.id : undefined;
        const title = typeof r.title === "string" ? r.title : undefined;
        const acRaw = (r as Record<string, unknown>)["artist-credit"] as unknown;
        const ac: Array<{ name?: string }> = Array.isArray(acRaw) ? (acRaw as Array<{ name?: string }>) : [];
        const subtitle = ac.map((x) => x?.name).filter(Boolean).join(", ");
        const firstRelease = Array.isArray(r.releases) && r.releases.length > 0 ? r.releases[0] : null;
        const year = firstRelease?.date ? Number(firstRelease.date.slice(0, 4)) : null;
        const artwork = firstRelease?.id ? `https://coverartarchive.org/release/${firstRelease.id}/front-250` : null;
        
        if (id && title) results.push({ 
          type: "recording", 
          id, 
          title, 
          subtitle: subtitle || null,
          year,
          artist: subtitle || null,
          artwork
        });
      }
    }

    // Process artists
    if (artRes && artRes.ok) {
      const ja = (await artRes.json()) as { artists?: Array<{ id?: string; name?: string; disambiguation?: string; country?: string }> };
      const artists = Array.isArray(ja?.artists) ? ja.artists : [];
      for (const a of artists) {
        if (typeof a.id === "string" && typeof a.name === "string") {
          // Try to get artist image from MusicBrainz (limited availability)
          const artistImage = `https://musicbrainz.org/ws/2/artist/${a.id}?fmt=json&inc=url-rels`;
          
          results.push({
            type: "artist",
            id: a.id,
            title: a.name,
            subtitle: a.disambiguation || a.country || "Artist",
            artist: a.name,
            artwork: null // We'll enhance this later with external image APIs
          });
        }
      }
    }

    // Process releases
    if (relRes && relRes.ok) {
      const jr = (await relRes.json()) as { releases?: Array<{ id?: string; title?: string; date?: string; "artist-credit"?: Array<{ name?: string }> }> };
      const releases = Array.isArray(jr?.releases) ? jr.releases : [];
      for (const r of releases) {
        if (typeof r.id === "string" && typeof r.title === "string") {
          const year = typeof r.date === "string" ? Number(r.date.slice(0, 4)) : null;
          const artistCredit = Array.isArray(r["artist-credit"]) ? r["artist-credit"].map((ac) => ac.name).filter(Boolean).join(", ") : null;
          const artwork = `https://coverartarchive.org/release/${r.id}/front-250`;
          
          results.push({
            type: "release",
            id: r.id,
            title: r.title,
            subtitle: artistCredit || "Album",
            year,
            artist: artistCredit || null,
            artwork
          });
        }
      }
    }

    return results;
  } catch (e) {
    console.error("Search error:", e);
    return [];
  }
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState<"relevance" | "title" | "year" | "artist">("relevance");

  const { data, isLoading } = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => searchMusicBrainz(submitted),
    enabled: !!submitted,
    retry: 1,
  });

  // Auto-complete suggestions
  const { data: suggestions } = useQuery({
    queryKey: ["suggestions", query],
    queryFn: () => searchMusicBrainz(query),
    enabled: query.length >= 2 && !submitted,
    retry: 1,
  });

  // Sort results based on selected criteria
  const sortedData = useMemo(() => {
    if (!data) return [];
    
    const sorted = [...data];
    switch (sortBy) {
      case "title":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case "year":
        return sorted.sort((a, b) => (b.year || 0) - (a.year || 0));
      case "artist":
        return sorted.sort((a, b) => (a.artist || "").localeCompare(b.artist || ""));
      default:
        return sorted; // Keep original order for relevance
    }
  }, [data, sortBy]);

  const handleSearch = (searchQuery: string) => {
    setSubmitted(searchQuery);
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: UnifiedResult) => {
    setQuery(suggestion.title);
    handleSearch(suggestion.title);
  };

  const handleClearResults = () => {
    setSubmitted("");
    setQuery("");
    setShowSuggestions(false);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.search-container')) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "artist": return <User className="w-4 h-4" />;
      case "work": return <Music className="w-4 h-4" />;
      case "release": return <Disc className="w-4 h-4" />;
      default: return <Music className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "artist": return "Artist";
      case "work": return "Composition (Work)";
      case "release": return "Album (Release)";
      case "recording": return "Recording";
      default: return "Music";
    }
  };

  const getDetailUrl = (result: UnifiedResult) => {
    switch (result.type) {
      case "artist": return `/artist/${result.id}`;
      case "work": return `/work/${result.id}`;
      case "release": return `/release/${result.id}`;
      case "recording": return `/work/${result.id}`; // For now, redirect to work
      default: return `/artist/${result.id}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Head Hunter
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Discover the best recordings of jazz standards
          </p>
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <p><strong>Composition (Work)</strong> <Music className="w-4 h-4 inline" /> = The song itself (like "Take Five")</p>
                <p><strong>Recording</strong> <Disc className="w-4 h-4 inline" /> = A specific performance (like Dave Brubeck's version)</p>
                <p><strong>Album (Release)</strong> <Disc className="w-4 h-4 inline" /> = The full album containing recordings</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="max-w-2xl mx-auto mb-12 search-container">
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                type="text"
                placeholder="Search for artists, compositions, albums, or recordings..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch(query);
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                className="pl-10 pr-4 py-6 text-lg border-2 focus:border-blue-500 transition-colors"
              />
              <Button
                onClick={() => handleSearch(query)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                size="sm"
              >
                Search
              </Button>
            </div>

            {/* Auto-complete suggestions */}
            {showSuggestions && suggestions && suggestions.length > 0 && query.length >= 2 && (
              <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.type}-${suggestion.id}-${index}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                  >
                    {suggestion.artwork && (
                      <img 
                        src={suggestion.artwork} 
                        alt="" 
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{suggestion.title}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {getTypeIcon(suggestion.type)}
                        {suggestion.subtitle}
                        {suggestion.year && suggestion.type !== "work" && <span>• {suggestion.year}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {getTypeLabel(suggestion.type)}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {submitted && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-4 mb-4">
                <h2 className="text-2xl font-semibold">
                  {isLoading ? "Searching..." : `Results for "${submitted}"`}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearResults}
                  className="text-sm"
                >
                  Clear Results
                </Button>
              </div>
              {!isLoading && data && (
                <p className="text-muted-foreground">
                  Found {data.length} results
                </p>
              )}
            </div>

            {isLoading && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            )}

            {!isLoading && data && data.length > 0 && (
              <>
                {/* Sort controls */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as "relevance" | "title" | "year" | "artist")}
                      className="text-sm border rounded px-2 py-1 bg-background"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="title">Title</option>
                      <option value="year">Year</option>
                      <option value="artist">Artist</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {sortedData.map((result, index) => (
                  <Link key={`${result.type}-${result.id}-${index}`} href={getDetailUrl(result)}>
                    <Card className="h-full hover:shadow-lg transition-all duration-200 hover:scale-105 cursor-pointer group">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(result.type)}
                            <Badge variant="outline" className="text-xs">
                              {getTypeLabel(result.type)}
                            </Badge>
                          </div>
                        </div>
                        <CardTitle className="text-lg line-clamp-2 group-hover:text-blue-600 transition-colors">
                          {result.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {result.artwork ? (
                          <div className="mb-4">
                            <img 
                              src={result.artwork} 
                              alt="" 
                              className="w-full h-32 object-cover rounded-lg"
                            />
                          </div>
                        ) : result.type === "artist" ? (
                          <div className="mb-4 flex items-center justify-center h-32 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <User className="w-16 h-16 text-gray-400" />
                          </div>
                        ) : null}
                        <div className="space-y-2">
                          {result.subtitle && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {result.subtitle}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {result.year && <span>{result.year}</span>}
                            {result.year && result.artist && result.type !== "work" && <span>•</span>}
                            {result.artist && result.type !== "work" && <span className="line-clamp-1">{result.artist}</span>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
              </>
            )}

            {!isLoading && data && data.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No results found for "{submitted}"</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try searching for a different artist, composition, or album
                </p>
              </div>
            )}
          </div>
        )}

        {/* Suggested Searches */}
        {!submitted && (
          <div className="mt-16 text-center">
            <h3 className="text-lg font-semibold mb-4">Suggested Searches</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Artists</h4>
                <div className="flex flex-wrap justify-center gap-2">
                  {["Miles Davis", "John Coltrane", "Charlie Parker"].map((search) => (
                    <Button
                      key={search}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSearch(search)}
                      className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      {search}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Compositions</h4>
                <div className="flex flex-wrap justify-center gap-2">
                  {["Take Five", "So What", "Giant Steps"].map((search) => (
                    <Button
                      key={search}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSearch(search)}
                      className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      {search}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Recordings</h4>
                <div className="flex flex-wrap justify-center gap-2">
                  {["Kind of Blue", "A Love Supreme", "Time Out"].map((search) => (
                    <Button
                      key={search}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSearch(search)}
                      className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      {search}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
