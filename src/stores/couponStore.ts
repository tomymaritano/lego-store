import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CouponTerms } from "@/lib/pricing";
import { isRecord, persistStorage } from "./persist";

/*
 * The coupon applied in the cart or the checkout: its terms as the server
 * returned them (POST /api/checkout/coupon), so the summaries can show the
 * discount as the cart changes (lib/pricing, the same math as the server).
 * Kept in localStorage with the cart, so it carries from the cart into the
 * checkout and survives a reload.
 *
 * Never trusted:
 * - the cart and the checkout ask the server about it again when they load
 *   (useCouponRecheck): new terms replace these, a refusal removes it with
 *   the reason (`notice`), and until the first answer of the page load the
 *   summaries leave the discount out (`checked`);
 * - preparing the order sends only the code, and the server validates and
 *   prices it again;
 * - it belongs to whoever applied it (`owner`, like the cart's): signing out
 *   or into another account drops it (<ListsSync />), a visitor who signs in
 *   keeps it (and the re-check decides).
 */

export interface AppliedCouponTerms extends CouponTerms {
  /** "10% de descuento". */
  label: string;
}

interface CouponState {
  coupon: AppliedCouponTerms | null;
  /** The account that applied it; null for a visitor. */
  owner: string | null;
  /** The code the server confirmed during this page load (not persisted). */
  checked: string | null;
  /** Why the coupon was taken off (not persisted): the coupon field shows it. */
  notice: string | null;
  /** The server accepted it (applied, or confirmed again). */
  apply: (coupon: AppliedCouponTerms, owner: string | null) => void;
  /** Takes it off; `notice` says why when it was not the customer's doing. */
  remove: (notice?: string) => void;
  clearNotice: () => void;
  /** The server could not be asked (offline, rate limited): the stored terms stand (the order checks them again). */
  markChecked: () => void;
  /** The session changed: a visitor's coupon goes with them into their account; another account's is dropped. */
  adoptOwner: (viewerId: string | null) => void;
}

const COUPON_TYPES = new Set(["PERCENT", "FIXED"]);

/** A persisted coupon, or null when the stored value is not one (an older or hand-edited shape). */
function couponFrom(value: unknown): AppliedCouponTerms | null {
  if (!isRecord(value)) return null;
  const { code, type, value: amount, minSubtotal, label } = value;
  if (typeof code !== "string" || typeof type !== "string" || !COUPON_TYPES.has(type)) return null;
  if (typeof amount !== "number" || typeof minSubtotal !== "number" || typeof label !== "string") return null;
  return { code, type: type as CouponTerms["type"], value: amount, minSubtotal, label };
}

export const useCouponStore = create<CouponState>()(
  persist(
    (set, get) => ({
      coupon: null,
      owner: null,
      checked: null,
      notice: null,
      apply: (coupon, owner) => set({ coupon, owner, checked: coupon.code, notice: null }),
      remove: (notice) => set({ coupon: null, owner: null, checked: null, notice: notice ?? null }),
      clearNotice: () => set({ notice: null }),
      markChecked: () => set((state) => ({ checked: state.coupon?.code ?? null })),
      adoptOwner: (viewerId) => {
        const { coupon, owner } = get();
        if (!coupon || owner === viewerId) return;
        if (owner === null && viewerId !== null) set({ owner: viewerId });
        else set({ coupon: null, owner: null, checked: null });
      },
    }),
    {
      name: "lego-coupon-storage",
      version: 2,
      storage: createJSONStorage(persistStorage),
      skipHydration: true,
      partialize: (state) => ({ coupon: state.coupon, owner: state.owner }),
      // Version 1 had no owner: such a coupon is a visitor's (the re-check decides whether it still applies).
      migrate: (persisted) => persisted as { coupon: AppliedCouponTerms | null; owner: string | null },
      merge: (persisted, current) => {
        const coupon = couponFrom(isRecord(persisted) ? persisted.coupon : null);
        const owner = coupon && isRecord(persisted) && typeof persisted.owner === "string" ? persisted.owner : null;
        // Another tab's change: what this page confirmed still stands only for the same code.
        return { ...current, coupon, owner, checked: coupon && current.checked === coupon.code ? current.checked : null };
      },
    }
  )
);

/** The applied coupon, as stored (the coupon field shows it while it is being checked). */
export const useAppliedCoupon = () => useCouponStore((state) => state.coupon);

/** The applied coupon once the server confirmed it during this page load: what the totals discount. */
export const useCheckedCoupon = () => useCouponStore((state) => (state.coupon && state.checked === state.coupon.code ? state.coupon : null));
