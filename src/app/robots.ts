import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { buildRobots } from "@/lib/sitemap";

/** /robots.txt: everything but the private and transactional paths (src/lib/sitemap.ts), and where the sitemap is. */
export default function robots(): MetadataRoute.Robots {
  return buildRobots(siteConfig.url);
}
