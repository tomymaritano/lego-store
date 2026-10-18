/**
 * Seed themes (prisma/seed writes them to the Theme table), in the "Temas"
 * menu's order: the four the menu always had first, then the rest. Every
 * seed product's `theme` must be one of these names.
 */
export const themes: { name: string; slug: string }[] = [
  { name: "Star Wars", slug: "star-wars" },
  { name: "Marvel", slug: "marvel" },
  { name: "Disney", slug: "disney" },
  { name: "Harry Potter", slug: "harry-potter" },
  { name: "Architecture", slug: "architecture" },
  { name: "Technic", slug: "technic" },
];
