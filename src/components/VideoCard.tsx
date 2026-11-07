import { Layers, MessageSquare, Paperclip, Star } from "lucide-react";
import type { ReactNode } from "react";
import type { VideoSummary } from "../../shared/api.ts";
import { useT } from "../i18n.ts";
import { formatDate } from "../lib/format.ts";
import { cn } from "../lib/utils.ts";
import { Link } from "../router.tsx";
import { Avatar } from "./Avatar.tsx";
import { Thumbnail } from "./Thumbnail.tsx";

/**
 * A video in a grid: its picture, and under it the uploader, the title, the date, its series,
 * its average rating in stars, and how many comments and attachments it has. The gray of hover
 * shows that it opens.
 */
export function VideoCard({ video }: { video: VideoSummary }) {
  const t = useT();
  const byline = [video.uploader?.displayName, formatDate(video.createdAt)].filter((part) => part !== undefined && part !== "");
  return (
    <Link to={`/videos/${video.id}`} className="-m-2 grid content-start gap-3 rounded-lg p-2 transition-colors duration-150 hover:bg-surface-hover">
      <Thumbnail url={video.thumbnailUrl} durationSec={video.durationSec} />
      <div className="flex gap-3">
        {video.uploader !== null && <Avatar url={video.uploader.avatarUrl} />}
        <div className="grid min-w-0 flex-1 content-start gap-0.5">
          <h3 className="line-clamp-2 text-sm font-semibold text-heading">{video.title}</h3>
          <p className="numeric truncate text-xs text-subdued">{byline.join(" · ")}</p>
          {video.series !== null && (
            <p className="flex min-w-0 items-center gap-1 text-xs text-subdued">
              <Layers aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{video.series.title}</span>
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-4">
            <AverageStars average={video.ratingAverage} count={video.ratingCount} />
            <CountIcon icon={<MessageSquare />} count={video.commentCount} label={t.comments.count(video.commentCount)} />
            <CountIcon icon={<Paperclip />} count={video.attachmentCount} label={t.attachments.count(video.attachmentCount)} />
          </div>
        </div>
      </div>
    </Link>
  );
}

const STARS = [1, 2, 3, 4, 5];

/** Five stars, colored from the left as far as the average, such as four and a third for 4.3. */
function AverageStars({ average, count }: { average: number; count: number }) {
  const t = useT();
  const filled = `${(Math.min(Math.max(average, 0), 5) / 5) * 100}%`;
  return (
    <span role="img" aria-label={t.rating.averageOf(average, count)} className="relative flex shrink-0 [&_svg]:size-3 [&_svg]:shrink-0">
      <span className="flex text-placeholder">
        {STARS.map((star) => (
          <Star key={star} aria-hidden="true" className="fill-current" />
        ))}
      </span>
      <span className="absolute inset-y-0 left-0 flex overflow-hidden text-accent" style={{ width: filled }}>
        {STARS.map((star) => (
          <Star key={star} aria-hidden="true" className="fill-current" />
        ))}
      </span>
    </span>
  );
}

/**
 * An icon with its number in a badge on its lower right corner, as the toolbar of a browser
 * shows the count of an extension. Without any, the icon shows alone and fainter.
 */
function CountIcon({ icon, count, label }: { icon: ReactNode; count: number; label: string }) {
  return (
    <span role="img" aria-label={label} className={cn("relative flex shrink-0 [&_svg]:size-4", count === 0 ? "text-placeholder" : "text-label")}>
      {icon}
      {count > 0 && (
        <span
          aria-hidden="true"
          className="numeric absolute -right-2 -bottom-1.5 min-w-3.5 rounded-xs bg-accent px-0.5 text-center text-[9px] leading-3.5 font-bold text-on-accent"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </span>
  );
}
