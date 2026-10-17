import { duration, ease } from "@/lib/motion";

/** The Navbar cart button (CountIcon) is the landing spot. */
const CART_SELECTOR = "[data-testid='cart-button']";

/**
 * Add-to-cart feedback: a small copy of the product picture flies from
 * `source` to the cart button in the Navbar, where the count bubble then
 * bumps (CountIcon). Purely decorative: a detached, aria-hidden,
 * pointer-events:none clone that never blocks interaction. Skipped under
 * reduced motion, or when either end is off screen.
 *
 * Runs on the Web Animations API rather than motion's `animate()`: it is
 * called from product cards on every page, and the native API keeps the
 * animation engine out of the first-load bundle (motion's features load
 * lazily, see ClientProviders).
 */
export function flyToCart(source: Element | null, imageSrc: string) {
  if (!source || typeof window === "undefined") return;
  if (typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const target = Array.from(document.querySelectorAll(CART_SELECTOR)).find((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  if (!target) return;

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (from.bottom < 0 || from.top > window.innerHeight) return;

  const size = Math.min(from.width, from.height, 160);
  const startX = from.left + from.width / 2 - size / 2;
  const startY = from.top + from.height / 2 - size / 2;
  const dx = to.left + to.width / 2 - (startX + size / 2);
  const dy = to.top + to.height / 2 - (startY + size / 2);

  const ghost = document.createElement("img");
  if (typeof ghost.animate !== "function") return;
  ghost.src = imageSrc;
  ghost.alt = "";
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${startX}px`,
    top: `${startY}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: "60",
    willChange: "transform, translate, scale, opacity",
  });
  document.body.appendChild(ghost);

  const ms = duration.slow * 1000;
  const curve = (points: readonly number[]) => `cubic-bezier(${points.join(", ")})`;
  // Arc: x (translate) and y (transform) run on separate curves, so the
  // picture lifts, then drops into the cart while it shrinks and fades.
  const flights = [
    ghost.animate({ translate: ["0px 0px", `${dx}px 0px`] }, { duration: ms, easing: curve(ease.emphasized), fill: "forwards" }),
    ghost.animate({ transform: ["translateY(0px)", `translateY(${dy}px)`] }, { duration: ms, easing: curve(ease.exit), fill: "forwards" }),
    ghost.animate(
      { scale: [1, 0.15], opacity: [1, 1, 0.4] },
      { duration: ms, easing: curve(ease.emphasized), fill: "forwards" }
    ),
  ];
  Promise.allSettled(flights.map((flight) => flight.finished)).finally(() => ghost.remove());
}
