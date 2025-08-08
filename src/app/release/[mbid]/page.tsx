import { Suspense } from "react";
import { ReleaseClient } from "./release-client";

type Props = {
  params: Promise<{ mbid: string }>;
};

export default async function ReleasePage({ params }: Props) {
  const { mbid } = await params;
  
  return (
    <Suspense fallback={<ReleaseSkeleton />}>
      <ReleaseClient mbid={mbid} />
    </Suspense>
  );
}

function ReleaseSkeleton() {
  return (
    <div className="container py-8 space-y-6">
      <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
      <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 animate-pulse rounded" />
        ))}
      </div>
    </div>
  );
}
