-- The number of ratings of each video and their average, kept on the video, so that the
-- list of all videos sorts by rating from an index, reading one page of videos and no
-- ratings. RatingRepository counts them again whenever someone rates a video.
ALTER TABLE videos ADD COLUMN rating_count INTEGER NOT NULL DEFAULT 0;

-- The average stars times 1000, rounded down, and 0 for a video that nobody rated.
ALTER TABLE videos ADD COLUMN rating_score INTEGER NOT NULL DEFAULT 0;

UPDATE videos SET
  rating_count = (SELECT COUNT(*) FROM ratings WHERE ratings.video_id = videos.id),
  rating_score = COALESCE((SELECT SUM(stars) * 1000 / COUNT(*) FROM ratings WHERE ratings.video_id = videos.id), 0);

CREATE INDEX videos_status_rating ON videos (status, rating_score DESC, rating_count DESC, created_at DESC, id DESC);
