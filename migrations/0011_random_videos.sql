-- Home picks videos at random: from a random place among the IDs, which are random, the next
-- ready videos in the order of their IDs (VideoRepository.sampleReady). This index holds the
-- ready videos in that order, so a pick reads about one row for each video that it returns.
CREATE INDEX videos_status_id ON videos (status, id);
