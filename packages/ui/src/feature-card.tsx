import type { LucideIcon } from "lucide-react";
import { cn } from "./lib/cn";

/** Icon + title + description block used in the feature row. */
export function FeatureCard({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-ink-900 dark:text-white">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
          {description}
        </p>
      </div>
    </div>
  );
}
