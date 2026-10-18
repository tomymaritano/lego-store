import Link from "next/link";
import { Megaphone } from "lucide-react";
import type { Announcement, AnnouncementTone, StoreSettings } from "@/lib/settings/defaults";
import { fillPlaceholders } from "@/lib/settings/placeholders";
import { cn } from "@/lib/utils";

/**
 * Each tone is a background token and the text token made for it (the
 * contrast is the design system's): the admin picks a tone, never a colour.
 */
export const ANNOUNCEMENT_TONE_CLASSES: Record<AnnouncementTone, { bar: string; link: string }> = {
  BRAND: { bar: "bg-brand-red text-on-brand-red", link: "focus-visible:outline-on-brand-red" },
  PRIMARY: { bar: "bg-primary text-on-primary", link: "focus-visible:outline-on-primary" },
  INFO: { bar: "bg-info text-on-info", link: "focus-visible:outline-on-info" },
  SUCCESS: { bar: "bg-success text-on-success", link: "focus-visible:outline-on-success" },
  NEUTRAL: { bar: "bg-bg-muted text-fg", link: "focus-visible:outline-fg" },
};

const isExternal = (url: string) => /^https:\/\//.test(url);

/**
 * The strip above the site header (/admin/configuracion, "Barra de
 * anuncio"): the admin's text with its placeholders filled, and an optional
 * link. Server Component; nothing renders while it is off or empty.
 */
export function AnnouncementBar({ announcement, settings }: { announcement: Announcement; settings: StoreSettings }) {
  const text = fillPlaceholders(announcement.text, settings).trim();
  if (!announcement.active || !text) return null;
  const tone = ANNOUNCEMENT_TONE_CLASSES[announcement.tone] ?? ANNOUNCEMENT_TONE_CLASSES.BRAND;
  const linkClass = cn("rounded-sm font-semibold underline underline-offset-2 hover:no-underline", tone.link);
  const label = announcement.linkLabel.trim() || "Ver más";

  return (
    <aside aria-label="Anuncio" className={tone.bar} data-testid="announcement-bar">
      <p className="container-custom flex flex-wrap items-center justify-center gap-x-2 py-2 text-center text-label font-medium">
        <Megaphone aria-hidden="true" className="size-4 shrink-0" />
        <span>{text}</span>
        {announcement.linkUrl ? (
          isExternal(announcement.linkUrl) ? (
            <a href={announcement.linkUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {label}
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
          ) : (
            <Link href={announcement.linkUrl} className={linkClass}>
              {label}
            </Link>
          )
        ) : null}
      </p>
    </aside>
  );
}
