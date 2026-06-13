import Link from "next/link";
import { Info, ShieldCheck, TriangleAlert } from "lucide-react";
import { adjacent } from "../lib/nav";

export interface TocEntry {
  id: string;
  title: string;
}

/**
 * Page scaffold: title, lede, the body, a prev/next footer derived from the
 * nav order, and a sticky "On this page" table of contents on the right.
 *
 * The TOC is passed explicitly so headings and their anchors stay in sync
 * without parsing the DOM. Each id must match a `<H2 id=...>` in the body.
 */
export function DocPage({
  href,
  title,
  lede,
  toc,
  children,
}: {
  href: string;
  title: string;
  lede?: string;
  toc?: TocEntry[];
  children: React.ReactNode;
}): React.JSX.Element {
  const { prev, next } = adjacent(href);

  return (
    <div className="flex">
      <article className="min-w-0 flex-1 py-10 lg:px-10">
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-ink-900 dark:text-white">
            {title}
          </h1>
          {lede ? (
            <p className="mt-3 text-lg text-ink-500 dark:text-ink-400">{lede}</p>
          ) : null}
        </header>

        <div className="prose-docs">{children}</div>

        <nav className="mt-14 grid gap-3 border-t border-ink-100 pt-8 sm:grid-cols-2 dark:border-white/10">
          {prev ? (
            <PageLink direction="prev" title={prev.title} href={prev.href} />
          ) : (
            <span />
          )}
          {next ? (
            <PageLink direction="next" title={next.title} href={next.href} />
          ) : (
            <span />
          )}
        </nav>
      </article>

      {toc && toc.length > 0 ? (
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 overflow-y-auto py-10 xl:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
            On this page
          </p>
          <ul className="space-y-2 border-l border-ink-100 dark:border-white/10">
            {toc.map((entry) => (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  className="-ml-px block border-l border-transparent pl-4 text-sm text-ink-500 transition-colors hover:border-brand-500 hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"
                >
                  {entry.title}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}

function PageLink({
  direction,
  title,
  href,
}: {
  direction: "prev" | "next";
  title: string;
  href: string;
}): React.JSX.Element {
  const isNext = direction === "next";
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-1 rounded-xl border border-ink-100 p-4 transition-colors hover:border-brand-300 dark:border-white/10 dark:hover:border-brand-600/50 ${
        isNext ? "sm:text-right" : ""
      }`}
    >
      <span className="text-xs text-ink-400">{isNext ? "Next" : "Previous"}</span>
      <span className="font-medium text-ink-900 dark:text-white">{title}</span>
    </Link>
  );
}

/* ---- Content primitives used inside page bodies ---- */

export function H2({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <h2
      id={id}
      className="group mt-12 mb-4 scroll-mt-24 text-2xl font-semibold tracking-tight text-ink-900 first:mt-0 dark:text-white"
    >
      <a href={`#${id}`} className="no-underline">
        {children}
      </a>
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h3 className="mt-8 mb-3 text-lg font-semibold text-ink-900 dark:text-white">
      {children}
    </h3>
  );
}

export function P({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="my-4 leading-7 text-ink-700 dark:text-ink-300">{children}</p>
  );
}

export function Lead({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="my-4 text-lg leading-8 text-ink-700 dark:text-ink-200">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ul className="my-4 ml-5 list-disc space-y-2 text-ink-700 marker:text-ink-300 dark:text-ink-300">
      {children}
    </ul>
  );
}

export function OL({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ol className="my-4 ml-5 list-decimal space-y-2 text-ink-700 marker:text-ink-400 dark:text-ink-300">
      {children}
    </ol>
  );
}

export function InlineCode({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <code className="rounded-md bg-ink-100 px-1.5 py-0.5 font-mono text-[0.85em] text-ink-800 dark:bg-white/10 dark:text-ink-100">
      {children}
    </code>
  );
}

export function A({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const external = href.startsWith("http");
  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700 dark:text-brand-400"
    >
      {children}
    </Link>
  );
}

type CalloutTone = "info" | "warn" | "security";

const calloutStyles: Record<
  CalloutTone,
  { wrap: string; icon: React.ReactNode }
> = {
  info: {
    wrap: "border-brand-100 bg-brand-50/50 text-ink-700 dark:border-brand-600/30 dark:bg-brand-600/10 dark:text-ink-200",
    icon: <Info className="h-5 w-5 text-brand-600 dark:text-brand-400" />,
  },
  warn: {
    wrap: "border-amber-200 bg-amber-50/70 text-ink-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-ink-200",
    icon: <TriangleAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
  },
  security: {
    wrap: "border-brand-100 bg-brand-50/50 text-ink-700 dark:border-brand-600/30 dark:bg-brand-600/10 dark:text-ink-200",
    icon: <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400" />,
  },
};

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: CalloutTone;
  title?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const style = calloutStyles[tone];
  return (
    <div className={`my-6 flex gap-3 rounded-xl border p-4 ${style.wrap}`}>
      <div className="mt-0.5 shrink-0">{style.icon}</div>
      <div className="min-w-0 text-sm leading-6">
        {title ? <p className="mb-1 font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function Table({
  head,
  rows,
}: {
  head: string[];
  rows: React.ReactNode[][];
}): React.JSX.Element {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-ink-100 dark:border-white/10">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-ink-50/70 dark:bg-white/5">
            {head.map((cell) => (
              <th
                key={cell}
                className="px-4 py-2.5 text-left font-semibold text-ink-700 dark:text-ink-200"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-t border-ink-100 dark:border-white/10"
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-4 py-2.5 align-top text-ink-600 dark:text-ink-300"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
