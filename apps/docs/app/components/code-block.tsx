"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Code/terminal window matching the marketing surface. Renders plain text
 * (no syntax highlighter shipped) with a copy button. `label` is the chip in
 * the title bar (e.g. "Terminal", "TypeScript"); `copyText` defaults to the
 * raw children when they are a string.
 */
export function CodeBlock({
  label = "Terminal",
  children,
}: {
  label?: string;
  children: string;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  };

  return (
    <div className="my-5 overflow-hidden rounded-xl bg-surface-code shadow-lg shadow-brand-900/10 ring-1 ring-white/5">
      <div className="flex items-center justify-between border-b border-white/5 bg-surface-codeHeader px-4 py-2.5">
        <span className="font-mono text-xs text-[#7f968a]">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-[#7f968a] transition-colors hover:bg-white/5 hover:text-[#cfe8d8]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-sm leading-7 text-[#e6f4ec]">
        <code>{children}</code>
      </pre>
    </div>
  );
}
