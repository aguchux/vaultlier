"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export function UserMenu({
  name,
  email,
  image,
  signOutAction,
}: {
  name: string | null;
  email: string;
  image: string | null;
  signOutAction: () => Promise<void>;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-ink-50"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- OAuth avatar URL is user-provided.
          <img
            src={image}
            alt=""
            className="h-8 w-8 rounded-full border border-black/10 object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
            {(name ?? email).slice(0, 2).toUpperCase()}
          </span>
        )}
        <ChevronDown
          className={`hidden h-4 w-4 text-ink-400 transition-transform sm:block ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 w-60 rounded-2xl border border-black/10 bg-white p-2 shadow-xl"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">
              {name ?? "Vaultlier user"}
            </p>
            <p className="truncate text-xs text-ink-500">{email}</p>
          </div>
          <div className="my-1 border-t border-black/5" />
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
