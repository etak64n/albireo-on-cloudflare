// Uploading: the Upload button in the top bar, the panel that shows the queue, and the
// cover while videos are dragged over the page. The queue itself runs in src/uploads.tsx,
// above the pages.

import { Upload, X } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import { useT } from "../i18n.ts";
import { formatBytes } from "../lib/format.ts";
import type { UploadProgress } from "../lib/upload.ts";
import { cn } from "../lib/utils.ts";
import { useUploads, type QueuedUpload } from "../uploads.tsx";
import { Button } from "./ui/button.tsx";

/**
 * Opens the file picker, where several videos can be chosen, and puts them in the queue.
 * In the top bar, it narrows to its icon on small screens. Prominent, it is the primary
 * button with its label at every size. With a series, the videos join that series.
 */
export function UploadButton({ prominent = false, seriesId }: { prominent?: boolean; seriesId?: string }) {
  const uploader = useUploads();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    // Clearing the input empties its list of files, so the files are taken first.
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    uploader.add(files, seriesId);
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="video/*" multiple onChange={handleChange} className="hidden" />
      <Button
        variant={prominent ? "primary" : "secondary"}
        size={prominent ? "lg" : "md"}
        onClick={() => inputRef.current?.click()}
        aria-label={t.upload.upload}
        className={prominent ? undefined : "max-md:w-7 max-md:px-0"}
      >
        <Upload aria-hidden="true" />
        <span className={prominent ? undefined : "max-md:hidden"}>{t.upload.upload}</span>
      </Button>
    </>
  );
}

function percentOf(progress: UploadProgress | null): number {
  if (progress === null || progress.totalBytes === 0) return 0;
  return Math.floor((progress.uploadedBytes / progress.totalBytes) * 100);
}

/**
 * The queue: the progress of the video that uploads, and, with more than one video, a row
 * for each. When the queue runs out, the panel keeps the failed videos and the files that
 * were not videos until they are dismissed. Nothing when the queue is empty.
 */
export function UploadPanel() {
  const uploader = useUploads();
  const t = useT();
  const { queue, notice } = uploader;
  const running = queue.find((item) => item.state === "uploading") ?? null;
  const active = queue.filter((item) => item.state === "waiting" || item.state === "uploading");
  const failed = queue.filter((item) => item.state === "failed");

  if (active.length === 0) {
    if (failed.length === 0 && notice === "") return null;
    return (
      <div className="error-box flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          {failed.map((item) => (
            <p key={item.id} className="break-words">{t.upload.failedFile(item.file.name, item.error)}</p>
          ))}
          {notice !== "" && <p className="break-words">{notice}</p>}
        </div>
        <Button variant="ghost" size="icon" className="-my-1 shrink-0 text-critical hover:bg-transparent" aria-label={t.upload.dismiss} onClick={uploader.dismiss}>
          <X />
        </Button>
      </div>
    );
  }

  const progress = running?.progress ?? null;
  const percent = percentOf(progress);
  const label = running === null || progress === null || progress.phase === "reading"
    ? t.upload.reading
    : progress.phase === "finishing"
      ? t.upload.finishing
      : t.upload.progress(percent, formatBytes(progress.uploadedBytes), formatBytes(progress.totalBytes));
  const finishing = progress?.phase === "finishing";

  return (
    <section className="grid gap-3 rounded-md p-3 shadow-[0_0_0_1px_var(--theme-border)]" aria-label={t.upload.upload}>
      <div className="flex min-h-7 items-center justify-between gap-3">
        <p role="status" className="numeric min-w-0 truncate font-semibold text-strong">{label}</p>
        {active.length > 1 ? (
          <Button onClick={uploader.cancelAll}>{t.upload.cancelAll}</Button>
        ) : (
          running !== null && !finishing && <Button onClick={() => uploader.cancel(running.id)}>{t.common.cancel}</Button>
        )}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-subdued">
        <div className="h-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      {queue.length > 1 && (
        <ul className="grid divide-y divide-hairline border-y border-hairline">
          {queue.map((item) => (
            <QueueRow key={item.id} item={item} onCancel={uploader.cancel} />
          ))}
        </ul>
      )}
      {notice !== "" && <p className="text-xs text-critical">{notice}</p>}
    </section>
  );
}

/** A video of the queue: its name and its state, and a button that takes it out while it waits or uploads. */
function QueueRow({ item, onCancel }: { item: QueuedUpload; onCancel: (id: number) => void }) {
  const t = useT();
  const state = item.state === "waiting"
    ? t.upload.waiting
    : item.state === "done"
      ? t.upload.uploaded
      : item.state === "failed"
        ? t.upload.failedLabel
        : `${percentOf(item.progress)}%`;
  const cancellable = item.state === "waiting" || (item.state === "uploading" && item.progress?.phase !== "finishing");
  return (
    <li className="grid gap-0.5 py-1.5">
      <div className="flex min-h-6 items-center gap-2">
        <span className={cn("min-w-0 flex-1 truncate text-sm", item.state === "uploading" ? "font-semibold text-strong" : "text-subdued")}>
          {item.file.name}
        </span>
        <span className={cn("numeric shrink-0 text-xs", item.state === "failed" ? "text-critical" : "text-subdued")}>{state}</span>
        {cancellable && (
          <Button
            variant="ghost"
            size="icon"
            className="-my-1 shrink-0 text-subdued"
            aria-label={t.upload.cancelFile(item.file.name)}
            onClick={() => onCancel(item.id)}
          >
            <X />
          </Button>
        )}
      </div>
      {item.state === "failed" && <p className="text-xs break-words text-critical">{item.error}</p>}
    </li>
  );
}

/** Covers the page while videos can be dropped on it. */
export function DropOverlay() {
  const uploader = useUploads();
  const t = useT();
  if (!uploader.dragging) return null;
  return (
    <div className="pointer-events-none fixed inset-3 z-50 grid place-items-center rounded-lg border-2 border-dashed border-accent bg-surface">
      <p className="flex items-center gap-2 text-figure font-bold text-strong">
        <Upload aria-hidden="true" />
        {t.upload.dropToUpload}
      </p>
    </div>
  );
}
