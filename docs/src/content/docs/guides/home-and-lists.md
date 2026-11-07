---
title: "Home and lists"
description: "The home page, all videos, and the history."
---

albireo has three lists of videos.

1. Home
2. All videos
3. History

Home (`/`) shows up to 48 videos in a grid, without a title (src/pages/HomePage.tsx).
When the page loads for the first time in 15 minutes, as when you open albireo or reload it, Home shows the recommendations for the person who signed in. When the page loads again before then, Home shows videos at random from the whole library.
The browser keeps the time of the last recommendations, so each browser counts its own 15 minutes, and D1 keeps nothing for it.
Coming back to Home from another page shows the same videos again, and asks the Worker nothing. The list loads again only when the page loads, and when an upload finishes.

The recommendations come from the newest 100 videos and the last 100 videos that the person watched, in this order, up to 48 videos (worker/app.ts, `recommend`).

1. In each series that the person is watching, the next episode that they have not watched, from the series watched last, for up to 8 series
2. The videos that they have not watched: first those of the series and the uploaders that they watched before, then the rest from the newest
3. The videos that they watched, from the one watched longest ago

The random videos start at a random place among the IDs of the videos, which are random, and take the next ready videos in the order of their IDs, then shuffle them. A load of the list reads about 48 rows of D1 (worker/videos.ts, `sampleReady`).

All videos (`/videos`) lists every video, 48 per page, in the order that you choose: from the newest, from the oldest, or from the highest rated (worker/videos.ts, shared/api.ts).
The highest rated come by their average stars, with more ratings first among equal averages, and the videos that nobody rated come last.
The order stays in the address, such as `/videos?sort=rating`. The series are in the sidebar.

The lists load their next page by themselves as you scroll near the end, as do the search results, the videos of a person, and the comments (src/components/LoadMore.tsx).

Before the library has its first video, Home and All videos say that it has none yet, with a button that uploads one (src/components/EmptyLibrary.tsx).

History (`/history`) lists the videos that the person watched, from the last watched.
The player records a video when its playback starts, and each person sees only their own history (worker/app.ts).

The sidebar on the left links to the three lists and to the series.
It lists the 5 series changed last, by their episodes or their title and description, and Show all under them lists every series, from the one changed last. The list stays open from page to page until the page loads again (src/components/Shell.tsx).
On screens narrower than 1024px, the sidebar hides, and the menu button in the upper left corner opens it over the page.
Dates show as YYYY/MM/DD (src/lib/format.ts, `formatDate`).
