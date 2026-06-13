/**
 * Documentation navigation — the single source of truth for the sidebar order
 * and for prev/next links. Page order in `flatNav` follows the reading flow.
 */

export interface NavItem {
  title: string;
  href: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const nav: NavSection[] = [
  {
    items: [
      { title: "Getting Started", href: "/" },
      { title: "Installation", href: "/installation" },
      { title: "Quickstart", href: "/quickstart" },
    ],
  },
  {
    title: "Reference",
    items: [
      { title: "CLI", href: "/cli" },
      { title: "SDK", href: "/sdk" },
    ],
  },
  {
    title: "Concepts",
    items: [
      { title: "Projects", href: "/projects" },
      { title: "Environments", href: "/environments" },
      { title: "API Keys", href: "/api-keys" },
    ],
  },
  {
    title: "More",
    items: [
      { title: "Security", href: "/security" },
      { title: "FAQ", href: "/faq" },
    ],
  },
];

/** Flattened reading order, used to compute prev/next footer links. */
export const flatNav: NavItem[] = nav.flatMap((section) => section.items);

export function adjacent(href: string): {
  prev?: NavItem;
  next?: NavItem;
} {
  const index = flatNav.findIndex((item) => item.href === href);
  if (index === -1) return {};
  return {
    prev: index > 0 ? flatNav[index - 1] : undefined,
    next: index < flatNav.length - 1 ? flatNav[index + 1] : undefined,
  };
}
