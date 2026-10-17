import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";
import { brand } from "@/lib/og/brand";

export const alt = `${siteConfig.name}: sets LEGO originales`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const studs = [0, 1, 2, 3];

/** Default social card (pages with their own image, like products, override it). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 96px",
          background: brand.yellow,
          color: brand.ink,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>{siteConfig.name}</div>
          <div style={{ fontSize: 40, marginTop: 16, lineHeight: 1.25 }}>
            Helmets, Brickheadz, vehículos y coleccionables. Construye pieza a pieza.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 20, marginBottom: -4 }}>
            {studs.map((i) => (
              <div key={i} style={{ width: 56, height: 28, borderRadius: "10px 10px 0 0", background: brand.red }} />
            ))}
          </div>
          <div style={{ width: 300, height: 180, borderRadius: 16, background: brand.red, boxShadow: `inset 0 -16px 0 ${brand.shade}` }} />
        </div>
      </div>
    ),
    size
  );
}
