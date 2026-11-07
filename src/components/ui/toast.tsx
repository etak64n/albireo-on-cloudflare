// Short messages that confirm what someone just did, such as an upload that finished. They
// stack in the lower right corner, or along the bottom of a narrow screen, and go after 5
// seconds, but stay while the pointer is over one or the focus is in one. Screen readers read
// each one out from a status region. A message can carry a link, such as Open on the video
// that an upload made. The messages take no part in the keyboard of dialogs: Escape closes
// the dialog that is open, not a message.

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "../../i18n.ts";
import { Link } from "../../router.tsx";

export interface ToastLink {
  label: string;
  to: string;
}

export type ShowToast = (message: string, link?: ToastLink) => void;

interface ToastItem {
  id: number;
  message: string;
  link: ToastLink | undefined;
}

// A message beyond this many pushes the oldest one out.
const MAX_TOASTS = 3;
const DURATION_MS = 5000;

const ToastContext = createContext<ShowToast | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback<ShowToast>((message, link) => {
    nextId.current += 1;
    const item = { id: nextId.current, message, link };
    setItems((current) => [...current.slice(-(MAX_TOASTS - 1)), item]);
  }, []);
  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* The region stays on the page, so a screen reader hears each message that joins it. Above the dialogs, so a message that a dialog causes is not under its backdrop. */}
      <div
        role="status"
        aria-label={t.toast.notifications}
        className="pointer-events-none fixed right-4 bottom-4 z-[60] grid w-96 max-w-[calc(100vw-2rem)] gap-2 max-sm:left-4 max-sm:w-auto"
      >
        {items.map((item) => (
          <Toast key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const t = useT();
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held) return;
    const timer = window.setTimeout(() => onDismiss(item.id), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [held, item.id, onDismiss]);

  return (
    <div
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className="pointer-events-auto flex animate-in items-center gap-3 rounded-lg border border-border bg-surface py-2 pr-2 pl-4 text-sm text-strong shadow-popover fade-in-0 slide-in-from-bottom-2"
    >
      <p className="min-w-0 flex-1 break-words">{item.message}</p>
      {item.link !== undefined && (
        // The message goes when its link opens the page, as the click comes up from the link.
        <span className="shrink-0" onClick={() => onDismiss(item.id)}>
          <Link to={item.link.to} className="rounded-xs font-semibold text-accent hover:underline">
            {item.link.label}
          </Link>
        </span>
      )}
      <button
        type="button"
        aria-label={t.toast.close}
        onClick={() => onDismiss(item.id)}
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm text-subdued transition-colors duration-150 hover:bg-surface-hover hover:text-strong pointer-coarse:size-11 [&_svg]:size-4"
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

/** Shows a short message that confirms what someone just did. */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (show === null) throw new Error("useToast needs a ToastProvider around the page.");
  return show;
}
