import type { Category } from "@/types";

/**
 * Seed category metadata (display name, blurb, cover image), keyed by the
 * slug used in Product.category; prisma/seed writes it to the Category table.
 * Order is the navigation order (Category.position). Cars, buildings and ships
 * have no working product photo yet, so they use the neutral placeholder.
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
    image: "/images/placeholder-product.svg",
  },
  {
    id: "buildings",
    name: "Edificios",
    description: "Arquitectura y lugares legendarios",
    image: "/images/placeholder-product.svg",
  },
  {
    id: "ships",
    name: "Naves",
    description: "Naves y caminantes de colección",
    image: "/images/placeholder-product.svg",
  },
  {
    id: "robots",
    name: "Robots",
    description: "Droides y robots para construir",
    image: "https://www.lego.com/cdn/cs/set/assets/blt38e8915698af2d5f/75308.jpg",
  },
];
