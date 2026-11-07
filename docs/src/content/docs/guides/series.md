---
title: "Series"
description: "Videos grouped as numbered episodes."
---

A series groups videos as numbered episodes, such as the recordings of a course (worker/app.ts, src/pages/SeriesPage.tsx).

- Everyone sees every series, and a video belongs to at most one series.
- New series, at the end of the series in the sidebar, makes a series from its title. The new series comes first in the sidebar.
- The episodes keep the order in which they joined. The creator of the series and admins move them up and down.
- Anyone can add their own videos to any series: from the edit page of a video, or by uploading from the page of the series. Upload on that page, and Upload in the header while it is open, open the upload page with the series chosen. Videos dropped on the page of the series join it at once.
- The page of a series without videos says so, with a button that uploads videos into it.
- The creator of the series, admins, and the uploader of the video can take a video out of a series.
- The creator of the series and admins delete it from its page. Its videos stay in the library, out of any series.
- When an episode ends, the next one starts. The video page lists every episode of the series and marks the one that plays.
