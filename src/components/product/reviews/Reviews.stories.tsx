import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Review } from "@/types";
import { ReviewForm, type ReviewFormActions } from "./ReviewForm";
import { ReviewItem } from "./ReviewItem";
import { ReviewSummary } from "./ReviewSummary";

/*
 * The pieces of the product page's reviews tab. The form gets stand-in
 * Server Actions (the real ones, src/lib/reviews/actions.ts, need a session
 * and a database); each story's answer is one the server gives.
 */

const review: Review = {
  id: "r1",
  productId: "1",
  userId: "u1",
  userName: "Carlos M.",
  rating: 5,
  title: "Increíble nivel de detalle",
  comment: "Los detalles de las marcas de batalla son perfectos. La construcción fue divertida y el resultado final es espectacular.",
  date: "2024-01-15",
  helpful: 12,
  verified: true,
};

/** Review items fade in: wait until they are fully drawn before the checks (and axe) run. */
const settled = async (canvasElement: HTMLElement) => {
  const items = within(canvasElement).getAllByTestId("review");
  await waitFor(() => items.forEach((item) => expect(getComputedStyle(item).opacity).toBe("1")));
};

const saved: ReviewFormActions = { create: async () => ({ ok: true }), update: async () => ({ ok: true }) };

const meta = {
  title: "Product/Reviews",
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Item: Story = {
  render: () => (
    <ul aria-label="Reseñas">
      <ReviewItem review={review} onHelpfulChange={fn()} />
    </ul>
  ),
  play: async ({ canvasElement }) => settled(canvasElement),
};

export const ItemVoted: Story = {
  render: () => (
    <ul aria-label="Reseñas">
      <ReviewItem review={{ ...review, verified: false, helpful: 13 }} voted onHelpfulChange={fn()} />
    </ul>
  ),
  play: async ({ canvasElement }) => {
    await settled(canvasElement);
    await expect(within(canvasElement).getByRole("button", { name: "Útil (13)" })).toHaveAttribute("aria-pressed", "true");
  },
};

export const OwnReview: Story = {
  render: () => (
    <ul aria-label="Reseñas">
      <ReviewItem review={{ ...review, userName: "Ana Pérez" }} mine onHelpfulChange={fn()} onEdit={fn()} onDelete={fn()} />
    </ul>
  ),
  play: async ({ canvasElement }) => {
    await settled(canvasElement);
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Tu reseña")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: /Útil/ })).toBeNull();
    await expect(canvas.getByRole("button", { name: "Editar" })).toBeVisible();
  },
};

export const Summary: Story = {
  render: () => (
    <ReviewSummary
      summary={{
        average: 4.3,
        count: 7,
        distribution: [
          { rating: 5, count: 4 },
          { rating: 4, count: 1 },
          { rating: 3, count: 1 },
          { rating: 2, count: 1 },
          { rating: 1, count: 0 },
        ],
      }}
    />
  ),
};

export const Form: Story = {
  render: () => <ReviewForm productId="1" authorName="Ana Pérez" actions={saved} onSaved={fn()} onDone={fn()} />,
};

export const FormInvalid: Story = {
  render: () => <ReviewForm productId="1" authorName="Ana Pérez" actions={saved} onSaved={fn()} onDone={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Publicar reseña" }));
    await expect(await canvas.findByText("Elige una calificación de 1 a 5 estrellas")).toBeVisible();
    await expect(canvas.getByText("Escribe un título (al menos 3 caracteres)")).toBeVisible();
  },
};

export const FormEditing: Story = {
  render: () => (
    <ReviewForm productId="1" authorName="Ana Pérez" review={review} actions={saved} onSaved={fn()} onDone={fn()} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Editar tu reseña" })).toBeVisible();
    await expect(canvas.getByLabelText(/Título/)).toHaveValue(review.title);
  },
};

export const FormRefused: Story = {
  render: () => (
    <ReviewForm
      productId="1"
      authorName="Ana Pérez"
      review={review}
      actions={{ ...saved, update: async () => ({ ok: false, error: "No encontramos esa reseña. Puede que se haya eliminado." }) }}
      onSaved={fn()}
      onDone={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Guardar cambios" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("No encontramos esa reseña");
  },
};
