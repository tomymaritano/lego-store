import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { brand } from "@/lib/og/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${siteConfig.name} - Tienda Oficial`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: brand.white,
    theme_color: brand.yellow,
    categories: ["shopping", "entertainment"],
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Buscar productos", short_name: "Buscar", url: "/search" },
      { name: "Mi carrito", short_name: "Carrito", url: "/cart" },
      { name: "Favoritos", short_name: "Favoritos", url: "/wishlist" },
    ],
  };
}
