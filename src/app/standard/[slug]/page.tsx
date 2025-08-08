"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { voteForRecording } from "@/app/actions/vote";
import { toast } from "sonner";

type Recording = {
  id: string;
  isrc: string | null;
  artist_name: string | null;
  track_title: string | null;
  album_name: string | null;
  release_year: number | null;
  artwork_url: string | null;
  links?: { name: string; url: string }[];
  votes_count?: number;
};

async function fetchRecordings(slug: string): Promise<Recording[]> {
  const res = await fetch(`/api/recordings?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) return [];
  const json = (await res.json()) as { recordings: Recording[] };
  return json.recordings;
}

export default function StandardDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { data, isLoading } = useQuery({
    queryKey: ["recordings", slug],
    queryFn: () => fetchRecordings(slug),
  });

  async function onVote(id: string) {
    const result = await voteForRecording({ recordingId: id });
    if (!result.ok) {
      if (result.reason === "auth") {
        toast.error("Please sign in to vote.");
      } else {
        toast.error("Could not register vote.");
      }
      return;
    }
    toast.success("Voted! Thanks.");
  }

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Recordings</h1>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((rec) => (
            <Card key={rec.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{rec.track_title ?? "Untitled"}</span>
                  <div className="flex items-center gap-2">
                    {typeof rec.votes_count === "number" && (
                      <Badge variant="secondary">{rec.votes_count} votes</Badge>
                    )}
                    {rec.release_year ? (
                      <Badge variant="outline">{rec.release_year}</Badge>
                    ) : null}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {rec.artist_name}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => onVote(rec.id)}>
                    Vote
                  </Button>
                  {rec.links && rec.links.length > 0 ? (
                    <div className="flex items-center gap-3">
                      {rec.links.map((l) => (
                        <a
                          key={l.url}
                          className="underline text-sm self-center"
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {l.name}
                        </a>
                      ))}
                    </div>
                  ) : null}
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


