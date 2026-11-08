import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { VideoSummary } from "../../shared/api.ts";
import { api } from "../api.ts";
import { LoadMore } from "../components/LoadMore.tsx";
import { PageHeader, Section } from "../components/Page.tsx";
import { SeriesGrid } from "../components/SeriesGrid.tsx";
import { Shell } from "../components/Shell.tsx";
import { Button } from "../components/ui/button.tsx";
import { VideoGrid, VideoGridSkeleton } from "../components/VideoGrid.tsx";
import { useT } from "../i18n.ts";
import { useLibrary } from "../library.tsx";
import { containsEvery, searchWords } from "../lib/search.ts";
import { usePageTitle } from "../lib/title.ts";
import { useLocationSearch } from "../router.tsx";

/** The results show this many series until Show all: one row of the grid at its widest. */
const SERIES_SHOWN = 3;

/**
 * The series and the videos that the query in the address, ?q=, finds. The series are those
 * whose title contains every word of the query. The browser finds them in the series that it
 * loaded for the sidebar, so they cost D1 no reads. The videos are those whose title or
 * description contains every word, which the API finds page by page.
 */
export function SearchPage() {
  const query = (new URLSearchParams(useLocationSearch()).get("q") ?? "").trim();
  const { series: library } = useLibrary();
  const [videos, setVideos] = useState<VideoSummary[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  // The query whose series are all shown. Another query starts with its first series again.
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);
  const seriesListId = useId();
  const t = useT();
  usePageTitle(query === "" ? t.search.title : query);

  const foundSeries = useMemo(() => {
    const words = searchWords(query);
    return library === null || words.length === 0 ? [] : library.filter((item) => containsEvery(item.title, words));
  }, [library, query]);
  const everySeries = expandedQuery === query;

  const load = useCallback(
    async (cursor: string | null) => {
      try {
        const page = await api.search(query, cursor);
        setVideos((current) => (cursor === null ? page.videos : [...(current ?? []), ...page.videos]));
        setNextCursor(page.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [query],
  );

  // A new query starts over from its first page.
  useEffect(() => {
    setVideos(null);
    setNextCursor(null);
    setError("");
    if (query !== "") void load(null);
  }, [load, query]);

  async function loadMore() {
    setLoadingMore(true);
    await load(nextCursor);
    setLoadingMore(false);
  }

  const videoList =
    videos === null ? (
      query !== "" && error === "" && <VideoGridSkeleton />
    ) : (
      <div className="grid gap-4">
        <VideoGrid videos={videos} />
        {nextCursor !== null && <LoadMore loading={loadingMore} onLoad={loadMore} />}
      </div>
    );

  return (
    <Shell>
      {query !== "" && <PageHeader title={t.search.resultsFor(query)} />}
      {error && <p className="error-box">{error}</p>}
      {foundSeries.length === 0 ? (
        videoList
      ) : (
        <>
          <Section
            title={t.common.series}
            actions={
              foundSeries.length > SERIES_SHOWN ? (
                <Button
                  variant="ghost"
                  aria-expanded={everySeries}
                  aria-controls={seriesListId}
                  onClick={() => setExpandedQuery(everySeries ? null : query)}
                >
                  {everySeries ? t.search.showFewer : t.search.showAll}
                </Button>
              ) : undefined
            }
          >
            <div id={seriesListId}>
              <SeriesGrid series={everySeries ? foundSeries : foundSeries.slice(0, SERIES_SHOWN)} />
            </div>
          </Section>
          {/* Under the series, the videos have a heading too, unless the search finds none. */}
          {(videos === null ? error === "" : videos.length > 0) && <Section title={t.common.videos}>{videoList}</Section>}
        </>
      )}
    </Shell>
  );
}
