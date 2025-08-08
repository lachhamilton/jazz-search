create table if not exists standards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text generated always as (lower(replace(title, ' ', '_'))) stored
);

create table if not exists recordings (
  id uuid primary key default gen_random_uuid(),
  isrc text unique,
  standard_id uuid references standards(id) on delete cascade,
  musicbrainz_recording_id text unique,
  artist_name text,
  track_title text,
  album_name text,
  release_year int,
  artwork_url text
);

create table if not exists services (
  id serial primary key,
  name text unique,
  base_url text
);

insert into services (name, base_url) values
  ('Apple Music','https://music.apple.com/'),
  ('Spotify','https://open.spotify.com/track/'),
  ('YouTube','https://music.youtube.com/watch?v=')
on conflict do nothing;

create table if not exists service_track_ids (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid references recordings(id) on delete cascade,
  service_id int references services(id),
  track_id text
);

create table if not exists votes (
  user_id uuid references auth.users(id) on delete cascade,
  recording_id uuid references recordings(id) on delete cascade,
  created_at timestamp default now(),
  primary key (user_id, recording_id)
);

alter table votes enable row level security;
drop policy if exists "Users can vote on recordings" on votes;
create policy "Users can vote on recordings"
  on votes for insert
  with check (auth.uid() = user_id);
