-- Playlists are the lists of videos that a person makes, such as the talks to watch again.
-- Unlike a series, a playlist holds anyone's videos, and a video can be in any number of
-- playlists. Each row of playlist_videos puts one video in one playlist; position orders
-- the videos of a playlist, from 1 for the first one added.
CREATE TABLE playlists (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX playlists_updated_at ON playlists (updated_at DESC, id DESC);
CREATE INDEX playlists_owner ON playlists (owner_id, updated_at DESC, id DESC);

CREATE TABLE playlist_videos (
  playlist_id TEXT NOT NULL REFERENCES playlists (id),
  video_id TEXT NOT NULL REFERENCES videos (id),
  position INTEGER NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (playlist_id, video_id)
);

CREATE INDEX playlist_videos_order ON playlist_videos (playlist_id, position);
CREATE INDEX playlist_videos_by_video ON playlist_videos (video_id);
