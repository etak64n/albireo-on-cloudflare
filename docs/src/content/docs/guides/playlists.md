---
title: "Playlists"
description: "Lists of videos that each person makes, with any video in any number of them."
---

A playlist is a list of videos that a person makes, such as the talks to watch again (worker/app.ts, worker/playlists.ts, src/pages/PlaylistPage.tsx).
Unlike a series, a playlist holds anyone's videos, and a video can be in any number of playlists.

- Everyone sees every playlist. Playlists (`/playlists`) lists them all from the one changed last, and the channel of a person lists their playlists.
- The sidebar lists the playlists of the signed-in person: the 5 changed last, and Show all under them for the rest. New playlist, at the end of them, makes a playlist from its title.
- Add to playlist, beside the title of a video, lists your playlists, each with a box that shows whether it holds the video. Checking a box puts the video at the end of that playlist, and clearing it takes the video out. New playlist in the same list makes a playlist with the video in it.
- The owner of a playlist and admins rename it, move its videos up and down, take videos out, and delete it, all from its page. Deleting a playlist keeps its videos in the library.
- Play all, on the page of a playlist, plays its videos from the first. While a video plays in a playlist, its address ends with `?playlist=<ID>`, the video page lists the videos of the playlist and marks the one that plays, and the next video of the playlist starts when one ends.
- Deleting a video takes it out of every playlist.
