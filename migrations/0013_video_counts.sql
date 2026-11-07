-- The number of comments and of attachments of each video, which the lists of videos show on
-- each one, kept on the row of the video so that a list reads no comments or attachments.
-- Triggers count a comment when it is posted or deleted, and an attachment when its upload is
-- committed or it is removed; an attachment that still uploads does not count.
ALTER TABLE videos ADD COLUMN comment_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN attachment_count INTEGER NOT NULL DEFAULT 0;

UPDATE videos SET
  comment_count = (SELECT COUNT(*) FROM comments WHERE comments.video_id = videos.id),
  attachment_count = (SELECT COUNT(*) FROM attachments WHERE attachments.video_id = videos.id AND attachments.status = 'ready');

CREATE TRIGGER video_comment_count_insert AFTER INSERT ON comments BEGIN
  UPDATE videos SET comment_count = comment_count + 1 WHERE id = new.video_id;
END;

CREATE TRIGGER video_comment_count_delete AFTER DELETE ON comments BEGIN
  UPDATE videos SET comment_count = comment_count - 1 WHERE id = old.video_id;
END;

CREATE TRIGGER video_attachment_count_ready AFTER UPDATE OF status ON attachments
  WHEN new.status = 'ready' AND old.status <> 'ready' BEGIN
  UPDATE videos SET attachment_count = attachment_count + 1 WHERE id = new.video_id;
END;

CREATE TRIGGER video_attachment_count_delete AFTER DELETE ON attachments WHEN old.status = 'ready' BEGIN
  UPDATE videos SET attachment_count = attachment_count - 1 WHERE id = old.video_id;
END;
