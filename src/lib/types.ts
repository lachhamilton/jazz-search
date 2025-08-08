export type Standard = {
  id: string;
  title: string;
  slug: string;
};

export type Recording = {
  id: string;
  isrc: string | null;
  standard_id: string | null;
  artist_name: string | null;
  track_title: string | null;
  album_name: string | null;
  release_year: number | null;
  artwork_url: string | null;
};


