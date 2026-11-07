// Short messages that confirm what someone just did, such as an upload that finished, in the
// way of shadcn/ui, on Radix UI. They stack in the lower right corner, or along the bottom of a
// narrow screen, go after 5 seconds unless the pointer is over them, and screen readers read
// them out. A message can carry a link, such as Open on the video that an upload made.

import { X } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
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

  return (
    <ToastContext.Provider value={show}>
      <ToastPrimitive.Provider duration={DURATION_MS} label={t.toast.notifications}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) setItems((current) => current.filter((other) => other.id !== item.id));
            }}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface py-2 pr-2 pl-4 text-sm text-strong shadow-popover data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[swipe=cancel]:translate-x-0 data-[swipe=end]:animate-out data-[swipe=end]:fade-out-0 data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)"
          >
            <ToastPrimitive.Description className="min-w-0 flex-1 break-words">{item.message}</ToastPrimitive.Description>
            {item.link !== undefined && (
              <ToastPrimitive.Action asChild altText={item.link.label}>
                <Link to={item.link.to} className="shrink-0 rounded-xs font-semibold text-accent hover:underline">
                  {item.link.label}
                </Link>
              </ToastPrimitive.Action>
            )}
            <ToastPrimitive.Close
              aria-label={t.toast.close}
              className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm text-subdued transition-colors duration-150 hover:bg-surface-hover hover:text-strong pointer-coarse:size-11 [&_svg]:size-4"
            >
              <X aria-hidden="true" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        {/* Above the dialogs, so a message that a dialog causes is not under its backdrop. */}
        <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-[60] m-0 grid w-96 max-w-[calc(100vw-2rem)] list-none gap-2 p-0 outline-none max-sm:left-4 max-sm:w-auto" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

/** Shows a short message that confirms what someone just did. */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (show === null) throw new Error("useToast needs a ToastProvider around the page.");
  return show;
}
