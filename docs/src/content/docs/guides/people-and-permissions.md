---
title: "People and permissions"
description: "Who signs in, and who can do what."
---

Everyone who signs in through Access gets a profile in D1, under the lowercase email that Access reports (worker/app.ts, worker/users.ts).
The first request creates the profile, with the part of the email before `@` as the display name.

People can do these things (worker/app.ts, header comment).

- Everyone who signs in watches every video, uploads videos, rates them, and comments on them.
- A person edits and deletes the videos that they uploaded, and edits the series that they created.
  The pencil beside the title of a video opens its edit page (`/videos/<ID>/edit`), which only the uploader and admins find.
  The Delete button of the edit page deletes the video for good: its file, its thumbnail, and its attachments in the bucket, and its comments and ratings.
- Admins edit and delete every video and every series. The `admins` setting lists them by email.
- A comment can be deleted by its author, the uploader of the video, and admins.
- The uploader of a video and admins attach files to it and remove them. Everyone previews and downloads them.
- Everyone makes playlists of any videos, and sees the playlists of everyone. The owner of a playlist and admins change and delete it.

An Access token without an email, such as a service token, gets a 401 answer, because albireo needs a person behind every request.
