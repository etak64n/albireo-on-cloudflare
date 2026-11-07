import { Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { VideoSummary } from "../../shared/api.ts";
import { api } from "../api.ts";
import { EmptyLibrary } from "../components/EmptyLibrary.tsx";
import { Section } from "../components/Page.tsx";
import { Shell } from "../components/Shell.tsx";
import { Thumbnail } from "../components/Thumbnail.tsx";
import { buttonVariants } from "../components/ui/button.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { VideoGrid, VideoGridSkeleton } from "../components/VideoGrid.tsx";
import { useT } from "../i18n.ts";
import { formatDate } from "../lib/format.ts";
import { usePageTitle } from "../lib/title.ts";
import { Link } from "../router.tsx";
import { useUploads } from "../uploads.tsx";

// Home shows the recommendations on the first visit in this long, as this browser recorded
// it, and videos at random from the whole library on the visits between.
const RECOMMENDATIONS_EVERY_MS = 15 * 60 * 1000;
const RECOMMENDED_AT = "albireo.home.recommendedAt";

type HomeMode = "recommended" | "random";

/** The recommendations, unless this browser showed them within RECOMMENDATIONS_EVERY_MS. */
function modeOfVisit(now: number): HomeMode {
  try {
    const last = Number(window.localStorage.getItem(RECOMMENDED_AT));
    return last > 0 && now - last < RECOMMENDATIONS_EVERY_MS ? "random" : "recommended";
  } catch {
    // A browser that keeps no storage gets the recommendations on every visit.
    return "recommended";
  }
}

function rememberRecommendations(now: number): void {
  try {
    window.localStorage.setItem(RECOMMENDED_AT, String(now));
  } catch {
    // Without storage, every visit is a first one.
  }
}

/**
 * The videos of Home, the first one large, then the rest: the recommendations for the
 * signed-in person on the first visit in a while, and videos at random on the visits between.
 */
export function HomePage() {
  const [videos, setVideos] = useState<VideoSummary[] | null>(null);
  const [error, setError] = useState("");
  const { completed } = useUploads();
  // Decided once for the visit, so a list that loads again after an upload keeps its kind.
  const [mode] = useState(() => modeOfVisit(Date.now()));
  const t = useT();
  usePageTitle(null);

  const load = useCallback(async () => {
    try {
      if (mode === "recommended") {
        setVideos((await api.getRecommendations()).videos);
        rememberRecommendations(Date.now());
      } else {
        setVideos((await api.getRandomVideos()).videos);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [mode]);

  // The list loads again when an upload finishes, so the new video shows up.
  useEffect(() => {
    void load();
  }, [load, completed]);

  const [first, ...rest] = videos ?? [];

  return (
    <Shell>
      <h1 className="sr-only">{t.shell.home}</h1>
      {error && <p className="error-box">{error}</p>}
      {videos === null && error === "" && (
        <>
          <FeatureSkeleton />
          <VideoGridSkeleton />
        </>
      )}
      {videos !== null && first === undefined && <EmptyLibrary />}
      {videos !== null &&
        first !== undefined && (
          <>
            <Feature video={first} />
            {rest.length > 0 && (
              <Section title={mode === "recommended" ? t.home.recommended : t.home.random}>
                <VideoGrid videos={rest} />
              </Section>
            )}
          </>
        )}
    </Shell>
  );
}

function FeatureSkeleton() {
  return (
    <div className={FEATURE_CLASS} aria-hidden="true">
      <Skeleton className="aspect-video rounded-lg" />
      <div className="grid content-center gap-3">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-2 h-9 w-24" />
      </div>
    </div>
  );
}

/** The picture of the first video takes two thirds of a wide page, and the title the rest. */
const FEATURE_CLASS = "-m-3 grid gap-x-8 gap-y-4 rounded-lg p-3 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]";

/** The first video of Home, large: its picture, and beside it the title and the way to play it. */
function Feature({ video }: { video: VideoSummary }) {
  const t = useT();
  const byline = [video.uploader?.displayName, formatDate(video.createdAt)].filter((part) => part !== undefined && part !== "").join(" · ");
  return (
    <Link to={`/videos/${video.id}`} className={`${FEATURE_CLASS} transition-colors duration-150 hover:bg-surface-hover`}>
      <Thumbnail url={video.thumbnailUrl} durationSec={video.durationSec} />
      <div className="grid content-center justify-items-start gap-2">
        <h2 className="line-clamp-3 text-display font-bold break-words text-heading">{video.title}</h2>
        <p className="numeric text-base text-label">{byline}</p>
        <span className={buttonVariants({ variant: "primary", size: "lg", className: "mt-3" })}>
          <Play className="fill-current" aria-hidden="true" />
          {t.home.play}
        </span>
      </div>
    </Link>
  );
}
