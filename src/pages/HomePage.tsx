import { useCallback, useEffect, useState } from "react";
import type { VideoSummary } from "../../shared/api.ts";
import { api } from "../api.ts";
import { EmptyLibrary } from "../components/EmptyLibrary.tsx";
import { Section } from "../components/Page.tsx";
import { Shell } from "../components/Shell.tsx";
import { VideoGrid, VideoGridSkeleton } from "../components/VideoGrid.tsx";
import { useT } from "../i18n.ts";
import { usePageTitle } from "../lib/title.ts";
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
 * The videos of Home, all alike in a grid: the recommendations for the signed-in person on
 * the first visit in a while, and videos at random on the visits between.
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

  return (
    <Shell>
      <h1 className="sr-only">{t.shell.home}</h1>
      {error && <p className="error-box">{error}</p>}
      {videos === null && error === "" && <VideoGridSkeleton />}
      {videos !== null && videos.length === 0 && <EmptyLibrary />}
      {videos !== null && videos.length > 0 && (
        <Section title={mode === "recommended" ? t.home.recommended : t.home.random}>
          <VideoGrid videos={videos} />
        </Section>
      )}
    </Shell>
  );
}
