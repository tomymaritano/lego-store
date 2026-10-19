import { describe, expect, it } from "vitest";
import { galleryAlt, galleryPictures, gallerySources } from "@/lib/gallery";

describe("gallery", () => {
  const product = {
    name: "Batcueva",
    img: "/images/76252.png",
    images: ["/images/76252_alt1.png", "/images/76252_alt3.png"],
    imageAlts: ["Vista lateral", ""],
  };

  it("keeps a main picture that is not in images first", () => {
    expect(gallerySources(product)).toEqual(["/images/76252.png", "/images/76252_alt1.png", "/images/76252_alt3.png"]);
  });

  it("seeds the admin editor with the same list as the storefront, alts lined up", () => {
    expect(galleryPictures(product)).toEqual([
      { url: "/images/76252.png", alt: "Batcueva" },
      { url: "/images/76252_alt1.png", alt: "Vista lateral" },
      { url: "/images/76252_alt3.png", alt: "Batcueva" },
    ]);
  });

  it("does not repeat a main picture that is also in images", () => {
    const pictures = galleryPictures({ ...product, img: "/images/76252_alt3.png", imageAlts: ["A", "B"] });
    expect(pictures).toEqual([
      { url: "/images/76252_alt3.png", alt: "B" },
      { url: "/images/76252_alt1.png", alt: "A" },
    ]);
    expect(galleryAlt(product, "/images/otra.png")).toBe("Batcueva");
  });
});
