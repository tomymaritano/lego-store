import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GalleryEditor } from "@/components/admin/GalleryEditor";

/*
 * The gallery's uploads when there is not room for every chosen file: the
 * extra ones are not sent, the admin is told how many were left out, and a
 * picture the gallery cannot take is reported on its file instead of
 * "Subimos".
 */

const hex = (n: number) => n.toString(16).padStart(32, "0");
const image = (n: number) => ({ url: `/uploads/${hex(n)}.webp`, alt: `Foto ${n}` });

let sent = 0;
let respond: (n: number) => { url: string } = (n) => ({ url: `/uploads/${hex(100 + n)}.webp` });

class FakeXhr {
  status = 0;
  response: unknown = null;
  responseType = "";
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  open() {}
  send() {
    const n = ++sent;
    setTimeout(() => {
      this.status = 201;
      this.response = { ...respond(n), width: 800, height: 600 };
      this.onload?.();
    }, 0);
  }
}

beforeEach(() => {
  sent = 0;
  respond = (n) => ({ url: `/uploads/${hex(100 + n)}.webp` });
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const files = (count: number) => Array.from({ length: count }, (_, i) => new File([new Uint8Array([1, 2, 3])], `foto-${i + 1}.png`, { type: "image/png" }));

const gallery = () => JSON.parse((document.querySelector('input[name="images"]') as HTMLInputElement).value) as unknown[];

describe("GalleryEditor uploads", () => {
  it("uploads only as many files as fit and says how many it left out", async () => {
    render(<GalleryEditor name="images" initial={Array.from({ length: 8 }, (_, i) => image(i + 1))} />);
    await waitFor(() => expect(screen.getByTestId("image-upload-input")).toBeEnabled());

    await act(async () => {
      fireEvent.change(screen.getByTestId("image-upload-input"), { target: { files: files(4) } });
    });

    await waitFor(() => expect(gallery()).toHaveLength(10));
    expect(sent).toBe(2);
    expect(screen.getByTestId("image-upload-skipped")).toHaveTextContent("Solo entran 2 imágenes más: subimos las primeras 2 y no las otras 2.");
  });

  it("reports a picture the gallery already has on its file, not as uploaded", async () => {
    respond = () => image(1);
    render(<GalleryEditor name="images" initial={[image(1)]} />);
    await waitFor(() => expect(screen.getByTestId("image-upload-input")).toBeEnabled());

    await act(async () => {
      fireEvent.change(screen.getByTestId("image-upload-input"), { target: { files: files(1) } });
    });

    await waitFor(() => expect(screen.getByTestId("image-upload-pending")).toHaveTextContent("Esa imagen ya está en la galería."));
    expect(gallery()).toHaveLength(1);
  });
});
