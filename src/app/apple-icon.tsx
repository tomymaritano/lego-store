import { ImageResponse } from "next/og";
import { brand } from "@/lib/og/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const stud = { width: 44, height: 44, borderRadius: 22, background: brand.yellow, boxShadow: `inset 0 -6px 0 ${brand.shade}` };

/** Home-screen icon: a red 2x2 LEGO brick seen from above. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: brand.red }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 28, width: 116 }}>
          <div style={stud} />
          <div style={stud} />
          <div style={stud} />
          <div style={stud} />
        </div>
      </div>
    ),
    size
  );
}
