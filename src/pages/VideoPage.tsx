import { Play } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Episode, VideoDetail, VideoSeries } from "../../shared/api.ts";
import { ApiError, api } from "../api.ts";
import { Attachments } from "../components/Attachments.tsx";
import { Avatar } from "../components/Avatar.tsx";
import { Comments } from "../components/Comments.tsx";
import { Breadcrumb, DetailList, Section } from "../components/Page.tsx";
import { Shell } from "../components/Shell.tsx";
import { StarRating } from "../components/StarRating.tsx";
import { Thumbnail } from "../components/Thumbnail.tsx";
import { VideoTitle } from "../components/VideoEditForm.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { useT } from "../i18n.ts";
import { formatDate, formatDuration } from "../lib/format.ts";
import { usePageTitle } from "../lib/title.ts";
import { cn } from "../lib/utils.ts";
import { Link, navigate } from "../router.tsx";
import { NotFoundPage } from "./NotFoundPage.tsx";

// Video.js loads with the first video page, so the other pages open without it.
const VideoPlayer = lazy(async () => ({ default: (await import("../components/VideoPlayer.tsx")).VideoPlayer }));

/** History state of a page that the end of the previous episode opened. */
interface ContinueState {
  autoplay: true;
}

function isContinueState(state: unknown): state is ContinueState {
  return typeof state === "object" && state !== null && "autoplay" in state && state.autoplay === true;
}

/** The episodes of the series of a video, once they load, or why they did not. */
interface SeriesEpisodes {
  episodes: Episode[] | null;
  error: string | null;
}

/**
 * Loads the episodes of a series for the list beside the player. The page loads them once,
 * though it shows the list twice, beside the player on wide pages and under the title on
 * narrow ones. The episodes of another series never show while a new series loads.
 */
function useSeriesEpisodes(seriesId: string | null): SeriesEpisodes {
  const [loaded, setLoaded] = useState<{ seriesId: string; episodes: Episode[] | null; error: string | null } | null>(null);
  useEffect(() => {
    if (seriesId === null) return;
    let active = true;
    api
      .getSeries(seriesId)
      .then(({ series }) => {
        if (active) setLoaded({ seriesId, episodes: series.episodes, error: null });
      })
      .catch((err: unknown) => {
        if (active) setLoaded({ seriesId, episodes: null, error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      active = false;
    };
  }, [seriesId]);
  if (loaded === null || loaded.seriesId !== seriesId) return { episodes: null, error: null };
  return { episodes: loaded.episodes, error: loaded.error };
}

/**
 * The page of one video: the player, the title and the description, the attachments,
 * and the comments, and beside them on wide pages the details and the series. On
 * narrow pages the details come after the description.
 */
export function VideoPage({ id }: { id: string }) {
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  // The page plays at once when the previous episode of the series just ended.
  const [autoPlay] = useState(() => isContinueState(window.history.state));
  const player = useRef<HTMLVideoElement>(null);
  const t = useT();
  usePageTitle(video?.title ?? null);
  const episodes = useSeriesEpisodes(video?.series?.id ?? null);

  useEffect(() => {
    let active = true;
    api
      .getVideo(id)
      .then(({ video: loaded }) => {
        if (active) setVideo(loaded);
      })
      .catch((err: unknown) => {
        if (active) setError(err);
      });
    return () => {
      active = false;
    };
  }, [id]);

  // A time in a comment plays the video from there, and the page scrolls up to the player.
  function seek(seconds: number) {
    const element = player.current;
    if (element === null) return;
    element.currentTime = seconds;
    void element.play().catch(() => undefined);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
  }

  function playNext() {
    const next = video?.series?.next;
    if (next !== undefined && next !== null) navigate(`/videos/${next.id}`, { autoplay: true } satisfies ContinueState);
  }

  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;

  return (
    <Shell>
      {error !== null ? (
        <p className="error-box">{error instanceof Error ? error.message : String(error)}</p>
      ) : video === null ? (
        <VideoSkeleton />
      ) : (
        <div className="grid gap-10 @4xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid min-w-0 content-start gap-10">
            <div className="grid gap-6">
              {video.series !== null ? (
                <Breadcrumb to={`/series/${video.series.id}`}>{video.series.title}</Breadcrumb>
              ) : (
                <Breadcrumb to="/videos">{t.common.allVideos}</Breadcrumb>
              )}
              {/* On phones the player spans the screen from edge to edge. */}
              <div className="-mx-4 sm:mx-0">
                <Suspense fallback={<PlayerPlaceholder />}>
                  <VideoPlayer video={video} videoRef={player} autoPlay={autoPlay} onEnded={playNext} />
                </Suspense>
              </div>
              <VideoTitle video={video} />
            </div>
            <div className="@4xl:hidden">
              <VideoAside video={video} episodes={episodes} onChange={setVideo} layout="row" />
            </div>
            <Attachments video={video} onChange={(attachments) => setVideo((current) => current && { ...current, attachments })} />
            <Comments videoId={video.id} durationSec={video.durationSec} onSeek={seek} />
          </div>
          <aside className="hidden @4xl:block">
            <VideoAside video={video} episodes={episodes} onChange={setVideo} layout="column" />
          </aside>
        </div>
      )}
    </Shell>
  );
}

function VideoSkeleton() {
  const t = useT();
  return (
    <div className="grid gap-10 @4xl:grid-cols-[minmax(0,1fr)_280px]" role="status" aria-label={t.common.loading}>
      <div className="grid content-start gap-6">
        <Skeleton className="h-5 w-24" />
        <PlayerPlaceholder />
        <Skeleton className="h-9 w-2/3" />
      </div>
      <div className="hidden content-start gap-4 @4xl:grid">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

/** The box of the player while the video or the player loads. */
function PlayerPlaceholder() {
  return <Skeleton className="-mx-4 aspect-video rounded-md sm:mx-0" />;
}

/**
 * The details of the video, and the episodes of its series: in the narrow column beside
 * the video on wide pages, and in rows under the title on narrow pages.
 */
function VideoAside({
  video,
  episodes,
  onChange,
  layout,
}: {
  video: VideoDetail;
  episodes: SeriesEpisodes;
  onChange: (video: VideoDetail) => void;
  layout: "column" | "row";
}) {
  const t = useT();
  const details = [
    {
      label: t.common.uploadedBy,
      value:
        video.uploader === null ? (
          "—"
        ) : (
          <Link to={`/users/${video.uploader.id}`} className="flex w-fit items-center gap-2 font-semibold text-accent hover:underline">
            <Avatar url={video.uploader.avatarUrl} size="tiny" />
            {video.uploader.displayName}
          </Link>
        ),
    },
    { label: t.common.date, value: <span className="numeric">{formatDate(video.createdAt)}</span> },
    ...(video.durationSec === null ? [] : [{ label: t.common.length, value: <span className="numeric">{formatDuration(video.durationSec)}</span> }]),
    ...(video.width === null || video.height === null
      ? []
      : [{ label: t.video.resolution, value: <span className="numeric">{`${video.width}×${video.height}`}</span> }]),
    { label: t.video.rating, value: <StarRating videoId={video.id} rating={video.rating} onRated={(rating) => onChange({ ...video, rating })} /> },
  ];
  return (
    <div className={layout === "column" ? "grid content-start gap-10" : "grid content-start gap-8"}>
      <Section title={t.video.details}>
        <DetailList items={details} layout={layout} />
      </Section>
      {video.series !== null && <SeriesNav series={video.series} videoId={video.id} episodes={episodes} />}
    </div>
  );
}

/**
 * The series of the video: its name, where the video sits in it, and every episode in a
 * list from the first, which marks the episode that plays.
 */
function SeriesNav({ series, videoId, episodes }: { series: VideoSeries; videoId: string; episodes: SeriesEpisodes }) {
  const t = useT();
  const list = useRef<HTMLOListElement>(null);
  const loaded = episodes.episodes;

  // A long list scrolls by itself, not with the page, to show the episode that plays.
  useEffect(() => {
    const element = list.current;
    const current = element?.querySelector<HTMLElement>('[aria-current="page"]');
    if (element === null || element === undefined || current === null || current === undefined) return;
    element.scrollTop = current.offsetTop - (element.clientHeight - current.offsetHeight) / 2;
  }, [loaded, videoId]);

  return (
    <Section title={t.common.series}>
      <nav className="grid gap-3" aria-label={t.common.series}>
        <div className="grid gap-1">
          <Link to={`/series/${series.id}`} className="w-fit text-sm font-bold break-words text-accent hover:underline">
            {series.title}
          </Link>
          <span className="text-sm text-label">
            {loaded === null ? t.video.episode(series.episode) : t.video.episodeOf(series.episode, loaded.length)}
          </span>
        </div>
        {episodes.error !== null ? (
          <p className="error-box">{episodes.error}</p>
        ) : loaded === null ? (
          <div className="grid gap-2" role="status" aria-label={t.common.loading}>
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : (
          <ol ref={list} className="relative -mx-2 grid max-h-[26rem] content-start gap-0.5 overflow-y-auto">
            {loaded.map((episode) => (
              <EpisodeItem key={episode.id} episode={episode} current={episode.id === videoId} />
            ))}
          </ol>
        )}
      </nav>
    </Section>
  );
}

/**
 * An episode in the list of the series: its number, picture, title, and length. The
 * episode that plays takes the accent and a play mark in place of its number, as the page
 * that is open does in the sidebar.
 */
function EpisodeItem({ episode, current }: { episode: Episode; current: boolean }) {
  return (
    <li>
      <Link
        to={`/videos/${episode.id}`}
        current={current}
        className="flex items-center gap-2 rounded-md p-2 transition-colors duration-150 hover:bg-surface-hover"
      >
        <span className="numeric grid w-5 shrink-0 place-items-center text-xs text-label">
          {current ? <Play className="size-3 fill-current text-accent" aria-hidden="true" /> : episode.episode}
        </span>
        <Thumbnail url={episode.thumbnailUrl} className="w-24 shrink-0" />
        <span className="grid min-w-0 gap-0.5">
          <span className={cn("line-clamp-2 text-sm break-words", current ? "font-semibold text-accent" : "text-strong")}>{episode.title}</span>
          {episode.durationSec !== null && <span className="numeric text-xs text-label">{formatDuration(episode.durationSec)}</span>}
        </span>
      </Link>
    </li>
  );
}
