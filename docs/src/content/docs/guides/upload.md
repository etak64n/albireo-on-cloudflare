---
title: "Upload"
description: "How videos go up, straight from the browser to the bucket."
---

You drop video files anywhere on the page, or press Upload in the header to select them (src/uploads.tsx, src/components/VideoUpload.tsx).
A file must have a `video/*` content type (worker/app.ts, `VIDEO_CONTENT_TYPE`).
Files of other types stay out, and the upload panel names them.

## The queue

The videos join a queue and go up one at a time (src/uploads.tsx).

- The files that you choose or drop together join the end of the queue in the order of their names. A number in a name counts by its value, so "Day 2" comes before "Day 10" (src/lib/upload-queue.ts).
- Files that you add while videos upload join the end of the queue.
- The upload panel shows each video with its state: waiting, its progress, uploaded, or failed with the reason. You can cancel one video, or every video at once.
- A video that fails stays in the panel with the reason, and the next video starts. To try it again, choose the file again.
- When the queue runs out, the uploaded videos leave the panel. The failed ones stay until you dismiss them.
- On the page of a series, the videos that you add become the last episodes of that series, in the order of the queue. Each video joins the series whose page was open when you added it.
- The queue keeps running while you move to other pages. The browser asks before you close the tab while videos wait or upload, because closing it stops the queue.

## One video

- The file name without its extension becomes the title (src/lib/format.ts, `titleFromFileName`).
- Before the upload, the browser reads the duration and the resolution of the video (src/lib/media.ts).
- The browser also takes a thumbnail. The thumbnail is a JPEG frame from 10% into the video, at most 300 seconds in, at most 640 pixels wide (src/lib/media.ts).
- The browser sends 4 parts at a time and tries each part up to 3 times. When you cancel a video, the Worker aborts its multipart upload (src/lib/upload.ts).
- After the last part, the Worker completes the upload. It then checks that the stored object has the size that the browser announced (worker/app.ts).
