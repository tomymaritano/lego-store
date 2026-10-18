import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { stubFormAction } from "@/components/auth/stub-action";
import type { AuditEntryView } from "@/lib/admin/audit";
import type { CategoryField, ThemeField } from "@/lib/validations/catalog";
import { AuditHistory } from "./AuditHistory";
import { CategoryForm, EMPTY_CATEGORY } from "./CategoryForm";
import { GalleryEditor } from "./GalleryEditor";
import { ImageField } from "./ImageField";
import { ImageUploader } from "./ImageUploader";
import { OrderButtons } from "./OrderButtons";
import { ThemeForm } from "./ThemeForm";

/**
 * The admin's catalogue pieces (categories, themes, pictures, history) in
 * their idle, error and in-progress states, light and dark, so the storybook
 * project's axe checks cover them. Server Actions and the upload endpoint
 * are stand-ins.
 */

const meta = {
  title: "Admin/Catalog",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const dark = { theme: "dark" } as const;

// ---------------------------------------------------------------------------
// Category and theme forms
// ---------------------------------------------------------------------------

const categoryErrors = stubFormAction<CategoryField>({
  status: "error",
  message: "Revisa los campos marcados.",
  fieldErrors: { slug: "Ese slug ya es de otra categoría", imageAlt: "Escribe el texto alternativo de la imagen" },
});

const editCategory = {
  slug: "helmet",
  name: "Helmets",
  description: "Cascos de colección para exhibir.",
  image: "/images/lego.png",
  imageAlt: "Un casco LEGO de frente",
  visible: true,
};

/** Submits the form and waits for the stand-in action's field errors (focus lands on the first). */
const submitForErrors = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: /Crear|Guardar/ }));
  await waitFor(() => expect(canvasElement.querySelector("[aria-invalid='true']")).toHaveFocus());
};

export const CategoryNew: Story = {
  name: "Category form (new)",
  render: () => <CategoryForm mode="create" action={stubFormAction({})} initial={EMPTY_CATEGORY} />,
};
export const CategoryEditDark: Story = {
  name: "Category form (edit, dark)",
  render: () => <CategoryForm mode="edit" action={stubFormAction({})} initial={editCategory} />,
  globals: dark,
};
export const CategoryErrors: Story = {
  name: "Category form (field errors)",
  render: () => <CategoryForm mode="edit" action={categoryErrors} initial={{ ...editCategory, imageAlt: "" }} />,
  play: submitForErrors,
};
export const CategoryErrorsDark: Story = { ...CategoryErrors, name: "Category form (field errors, dark)", globals: dark };

const themeErrors = stubFormAction<ThemeField>({
  status: "error",
  message: "Revisa los campos marcados.",
  fieldErrors: { name: "Ya hay un tema con ese nombre", slug: "Usa minúsculas, números y guiones" },
});

export const ThemeNew: Story = {
  name: "Theme form (new)",
  render: () => <ThemeForm mode="create" action={stubFormAction({})} initial={{ name: "", slug: "", visible: true }} />,
};
export const ThemeEditDark: Story = {
  name: "Theme form (edit, dark)",
  render: () => <ThemeForm mode="edit" action={stubFormAction({})} initial={{ name: "Star Wars", slug: "star-wars", visible: false }} />,
  globals: dark,
};
export const ThemeErrors: Story = {
  name: "Theme form (field errors)",
  render: () => <ThemeForm mode="edit" action={themeErrors} initial={{ name: "Marvel", slug: "Marvel!", visible: true }} />,
  play: submitForErrors,
};
export const ThemeErrorsDark: Story = { ...ThemeErrors, name: "Theme form (field errors, dark)", globals: dark };

// ---------------------------------------------------------------------------
// Pictures: uploader, single image field, gallery
// ---------------------------------------------------------------------------

/**
 * A stand-in XMLHttpRequest for the upload endpoint: it reports 40 % sent
 * and never finishes, so the progress bar stays on screen.
 */
class StalledUpload {
  status = 0;
  response = null;
  responseType = "";
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  open() {}
  send() {
    setTimeout(() => this.upload.onprogress?.({ lengthComputable: true, loaded: 40, total: 100 }), 0);
  }
}

const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "torre.png", { type: "image/png" });
const gif = () => new File([new TextEncoder().encode("GIF89a")], "animada.gif", { type: "image/gif" });

const uploader = <ImageUploader multiple label="Subir imágenes" onUploaded={() => {}} />;

export const UploaderIdle: Story = { name: "Uploader (idle)", render: () => uploader };
export const UploaderIdleDark: Story = { name: "Uploader (idle, dark)", render: () => uploader, globals: dark };

export const UploaderUploading: Story = {
  name: "Uploader (uploading)",
  render: () => uploader,
  beforeEach: () => {
    const original = window.XMLHttpRequest;
    window.XMLHttpRequest = StalledUpload as unknown as typeof XMLHttpRequest;
    return () => {
      window.XMLHttpRequest = original;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.upload(canvas.getByTestId("image-upload-input"), png());
    const bar = await canvas.findByRole("progressbar", { name: "Subiendo torre.png" });
    await waitFor(() => expect(bar).toHaveAttribute("aria-valuenow", "40"));
  },
};
export const UploaderUploadingDark: Story = { ...UploaderUploading, name: "Uploader (uploading, dark)", globals: dark };

export const UploaderError: Story = {
  name: "Uploader (refused file)",
  render: () => uploader,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.upload(canvas.getByTestId("image-upload-input"), gif(), { applyAccept: false });
    await expect(await canvas.findByRole("button", { name: "Descartar animada.gif" })).toBeVisible();
  },
};
export const UploaderErrorDark: Story = { ...UploaderError, name: "Uploader (refused file, dark)", globals: dark };

const imageField = (
  <div className="max-w-xl">
    <ImageField
      name="image"
      label="Imagen"
      initialUrl="/images/lego.png"
      error="Sube una imagen, o usa una ruta del sitio (/images/…)"
      required
      alt={{ name: "imageAlt", initial: "", error: "Escribe el texto alternativo de la imagen" }}
    />
  </div>
);

export const ImageFieldErrors: Story = { name: "Image field (errors)", render: () => imageField };
export const ImageFieldErrorsDark: Story = { name: "Image field (errors, dark)", render: () => imageField, globals: dark };

const gallery = (
  <div className="max-w-3xl">
    <GalleryEditor
      name="gallery"
      initial={[
        { url: "/images/lego.png", alt: "Torre de prueba, vista de frente" },
        { url: "/images/placeholder-product.svg", alt: "" },
      ]}
      error="La imagen 2 necesita su texto alternativo (qué se ve en ella)"
      issue={{ index: 1, field: "alt" }}
    />
  </div>
);

export const GalleryMissingAlt: Story = {
  name: "Gallery (missing alt text)",
  render: () => gallery,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("textbox", { name: /Texto alternativo \(imagen 2\)/ })).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.queryByTestId("gallery-error")).toBeNull();
  },
};
export const GalleryMissingAltDark: Story = { ...GalleryMissingAlt, name: "Gallery (missing alt text, dark)", globals: dark };

// ---------------------------------------------------------------------------
// Ordering and history
// ---------------------------------------------------------------------------

const move = async () => ({ ok: true as const, message: "Cambiamos el orden de los temas." });

const ordering = (
  <ul className="max-w-sm space-y-2">
    {["Star Wars", "Marvel", "Technic"].map((name, index) => (
      <li key={name} className="flex items-center justify-between rounded-xl border border-border bg-surface p-2">
        <span className="text-label font-medium text-fg">{name}</span>
        <OrderButtons name={name} position={index + 1} total={3} action={move} />
      </li>
    ))}
  </ul>
);

export const Ordering: Story = { name: "Order buttons", render: () => ordering };
export const OrderingDark: Story = { name: "Order buttons (dark)", render: () => ordering, globals: dark };

const entries: AuditEntryView[] = [
  {
    id: "a2",
    action: "product.update",
    actorId: "u1",
    actorEmail: "admin@example.com",
    entityType: "product",
    entityId: "7",
    changes: { price: [12999, 11999], stock: [3, 10] },
    ip: "127.0.0.1",
    at: "2026-10-18T15:30:00.000Z",
  },
  {
    id: "a1",
    action: "product.create",
    actorId: "u1",
    actorEmail: "admin@example.com",
    entityType: "product",
    entityId: "7",
    changes: null,
    ip: null,
    at: "2026-10-17T12:00:00.000Z",
  },
];

const history = (
  <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
    <AuditHistory entries={entries} entity={{ type: "product", id: "7" }} />
    <AuditHistory entries={[]} entity={{ type: "theme", id: "t1" }} title="Historial del tema" />
  </div>
);

export const History: Story = { name: "Audit history", render: () => history };
export const HistoryDark: Story = { name: "Audit history (dark)", render: () => history, globals: dark };
