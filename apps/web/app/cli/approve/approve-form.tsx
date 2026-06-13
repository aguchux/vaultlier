"use client";

import { useActionState } from "react";
import { Check, Terminal, X } from "lucide-react";
import { Button } from "@repo/ui/button";
import type { ApprovalState } from "./actions";

type Action = (
  prev: ApprovalState | null,
  formData: FormData,
) => Promise<ApprovalState>;

/**
 * Approve/deny controls for a CLI device-login request. The code is
 * pre-filled from the verification link but stays editable so a user who
 * typed the URL by hand can confirm the code shown in their terminal.
 */
export function ApproveForm({
  initialCode,
  approveAction,
  denyAction,
}: {
  initialCode: string;
  approveAction: Action;
  denyAction: Action;
}): React.JSX.Element {
  const [approveState, approve, approving] = useActionState(approveAction, null);
  const [denyState, deny, denying] = useActionState(denyAction, null);
  const state = approveState ?? denyState;

  if (state?.status === "approved") {
    return (
      <Result
        tone="ok"
        icon={<Check className="h-5 w-5" />}
        title="Device approved"
        body="You can close this tab and return to your terminal."
      />
    );
  }
  if (state?.status === "denied") {
    return (
      <Result
        tone="muted"
        icon={<X className="h-5 w-5" />}
        title="Request denied"
        body="No access was granted. You can close this tab."
      />
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-ink-700" htmlFor="code">
        Confirm the code shown in your terminal
      </label>
      <input
        id="code"
        name="userCode"
        defaultValue={initialCode}
        autoComplete="off"
        spellCheck={false}
        className="mt-2 w-full rounded-xl border border-black/10 bg-ink-50 px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-ink-900 uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        form="approve-form"
      />
      {state?.status === "error" ? (
        <p className="mt-3 text-sm text-red-600">{state.message}</p>
      ) : null}

      <div className="mt-6 flex gap-3">
        <form action={approve} id="approve-form" className="flex-1">
          <input type="hidden" name="userCode" value={initialCode} />
          <Button type="submit" className="w-full" disabled={approving || denying}>
            {approving ? "Approving…" : "Approve"}
          </Button>
        </form>
        <form action={deny} className="flex-1">
          <input type="hidden" name="userCode" value={initialCode} />
          <Button
            type="submit"
            variant="secondary"
            className="w-full"
            disabled={approving || denying}
          >
            {denying ? "Denying…" : "Deny"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Result({
  tone,
  icon,
  title,
  body,
}: {
  tone: "ok" | "muted";
  icon: React.ReactNode;
  title: string;
  body: string;
}): React.JSX.Element {
  const color =
    tone === "ok" ? "text-emerald-600 bg-emerald-50" : "text-ink-500 bg-ink-50";
  return (
    <div className="text-center">
      <div
        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${color}`}
      >
        {icon}
      </div>
      <h2 className="mt-4 flex items-center justify-center gap-2 font-semibold text-ink-900">
        <Terminal className="h-4 w-4" /> {title}
      </h2>
      <p className="mt-1 text-sm text-ink-500">{body}</p>
    </div>
  );
}
