import type { SocialKey } from "@/lib/settings/defaults";

/** Limits and field names of /admin/configuracion, apart from the zod schemas (./settings.ts) so its forms render without zod. */

export const MAX_ANNOUNCEMENT = 160;

/** The home page's "Destacados": at most this many products. */
export const MAX_FEATURED = 8;

/** The form field (and StoreSettings column) of each social profile. */
export const SOCIAL_FIELDS = {
  facebook: "socialFacebook",
  instagram: "socialInstagram",
  youtube: "socialYoutube",
  x: "socialX",
} as const satisfies Record<SocialKey, string>;
