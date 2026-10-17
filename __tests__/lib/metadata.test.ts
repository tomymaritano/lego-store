import { describe, expect, it } from "vitest";
import { defaultOgImage, pageMetadata } from "@/lib/metadata";

describe("pageMetadata", () => {
  it("falls back to the site-wide social card when no images are passed", () => {
    const meta = pageMetadata({ title: "Envíos", description: "Cómo enviamos", path: "/envios" });
    expect(meta.openGraph?.images).toEqual([defaultOgImage]);
    expect(meta.twitter?.images).toEqual([defaultOgImage.url]);
    expect(meta.openGraph).toMatchObject({ locale: "es_AR", url: "/envios", title: "Envíos | LEGO Store" });
  });

  it("uses the page's own images when given", () => {
    const image = { url: "/images/set.png", width: 800, height: 800, alt: "Set" };
    const meta = pageMetadata({ title: "Set", description: "d", path: "/item/1", images: [image] });
    expect(meta.openGraph?.images).toEqual([image]);
    expect(meta.twitter?.images).toEqual(["/images/set.png"]);
  });
});
