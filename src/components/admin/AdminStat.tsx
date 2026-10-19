import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";

interface AdminStatProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  /** Links the card's label to the list behind the number. */
  href?: string;
  tone?: "default" | "warning";
}

/** One number of the admin dashboard, with its icon and an optional line under it. */
export function AdminStat({ icon, label, value, detail, href, tone = "default" }: AdminStatProps) {
  return (
    <Card interactive={Boolean(href)} className="relative">
      <CardContent className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl text-fg [&_svg]:size-5",
            tone === "warning" ? "bg-warning/25" : "bg-primary/20"
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-label text-fg-secondary">
            {href ? (
              // The link covers the card (after:inset-0), so the whole card is clickable.
              <Link
                href={href}
                prefetch={false}
                className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {label}
              </Link>
            ) : (
              label
            )}
          </p>
          <p className="text-heading break-words tabular-nums">{value}</p>
          {detail ? <p className="text-caption text-fg-muted">{detail}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
