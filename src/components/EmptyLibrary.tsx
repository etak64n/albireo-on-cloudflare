import { Clapperboard } from "lucide-react";
import { useT } from "../i18n.ts";
import { UploadButton } from "./VideoUpload.tsx";

/** The library before its first video: that it has none yet, and the button that uploads one. */
export function EmptyLibrary() {
  const t = useT();
  return (
    <div className="grid justify-items-center gap-4 rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface-subdued text-label">
        <Clapperboard className="size-6" aria-hidden="true" />
      </span>
      <p className="text-figure font-bold text-heading">{t.common.noVideosYet}</p>
      <UploadButton prominent />
    </div>
  );
}
