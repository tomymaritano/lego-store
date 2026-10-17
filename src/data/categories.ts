import type { Category } from "@/types";

/**
 * Mock category metadata (display name, blurb, cover image), keyed by the
 * slug used in Product.category. Product counts are computed by lib/api.
 * Order is the navigation order. (Buildings, ships and robots have no working
 * product photo in the mock data yet, so they use the store logo.)
 */
export const categories: Omit<Category, "productCount">[] = [
  {
    id: "helmet",
    name: "Helmets",
    description: "Colección de cascos icónicos",
    image: "https://www.lego.com/cdn/cs/set/assets/bltde62e4576a817dd4/75349.png",
  },
  {
    id: "brickheadz",
    name: "Brickheadz",
    description: "Figuras coleccionables",
    image: "https://www.lego.com/cdn/cs/set/assets/bltc971a95594361e17/40624.png",
  },
  {
    id: "cars",
    name: "Vehículos",
    description: "Autos y naves épicas",
    image: "https://www.lego.com/cdn/cs/set/assets/blt38e8915698af2d5f/75308.jpg",
  },
  {
    id: "buildings",
    name: "Edificios",
    description: "Arquitectura y lugares legendarios",
    image: "/images/lego.png",
  },
  {
    id: "ships",
    name: "Naves",
    description: "Naves y caminantes de colección",
    image: "/images/lego.png",
  },
  {
    id: "robots",
    name: "Robots",
    description: "Droides y robots para construir",
    image: "/images/lego.png",
  },
];
