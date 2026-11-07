import { useEffect, useState } from "react";
import type { VideoDetail } from "../../shared/api.ts";
import { ApiError, api } from "../api.ts";
import { Breadcrumb, PageHeader } from "../components/Page.tsx";
import { Shell } from "../components/Shell.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { VideoEditForm } from "../components/VideoEditForm.tsx";
import { useT } from "../i18n.ts";
import { usePageTitle } from "../lib/title.ts";
import { navigate } from "../router.tsx";
import { NotFoundPage } from "./NotFoundPage.tsx";

/**
 * The edit page of a video: its title, its description, and its series. Only the uploader
 * of the video and admins can change the video, so only they find the page; the API checks
 * the same. Saving or canceling goes back to the video.
 */
export function VideoEditPage({ id }: { id: string }) {
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const t = useT();
  usePageTitle(video === null ? null : t.video.editVideo);

  useEffect(() => {
    let active = true;
    api.getVideo(id).then(
      ({ video: loaded }) => {
        if (active) setVideo(loaded);
      },
      (err: unknown) => {
        if (active) setError(err);
      },
    );
    return () => {
      active = false;
    };
  }, [id]);

  if ((error instanceof ApiError && error.status === 404) || (video !== null && !video.canEdit)) return <NotFoundPage />;
  const back = () => navigate(`/videos/${id}`);

  return (
    <Shell>
      {error !== null ? (
        <p className="error-box">{error instanceof Error ? error.message : String(error)}</p>
      ) : video === null ? (
        <div className="grid gap-6" role="status" aria-label={t.common.loading}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-1/2" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <div className="grid gap-6">
          <Breadcrumb to={`/videos/${video.id}`}>{video.title}</Breadcrumb>
          <PageHeader title={t.video.editVideo} />
          <VideoEditForm video={video} onSaved={back} onCancel={back} />
        </div>
      )}
    </Shell>
  );
}
