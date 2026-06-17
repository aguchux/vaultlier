# docs.vaultlier.com

The Vaultlier documentation site. Next.js (App Router) + Tailwind v4, sharing
the `@vaultlier/ui` design tokens with the marketing site and portal.

## Develop

```bash
npm run dev --workspace=docs   # http://localhost:3001
```

## Structure

- `app/lib/nav.ts` — the single source of truth for the sidebar order and the
  prev/next page links. Add a page here to make it appear in navigation.
- `app/components/` — the shell (top nav, sidebar, mobile drawer), the
  `CodeBlock` terminal/code window, the theme toggle, and the page primitives
  in `doc.tsx` (`DocPage`, headings, callouts, tables, etc.).
- `app/<route>/page.tsx` — one file per documentation page. Each renders a
  `DocPage` with an explicit `toc` whose ids match the `<H2 id=…>` headings.

## Adding a page

1. Create `app/<route>/page.tsx` rendering `<DocPage href="/<route>" …>`.
2. Add `{ title, href: "/<route>" }` to the appropriate section in
   `app/lib/nav.ts`.

Content should track the published `vaultlier` package — keep examples in sync
with `packages/vaultlier/README.md` and the CLI's `--help`.
