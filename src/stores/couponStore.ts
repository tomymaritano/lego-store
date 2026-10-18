import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CouponTerms } from "@/lib/pricing";
import { isRecord, persistStorage } from "./persist";

/*
 * The coupon applied in the cart or the checkout: its terms as the server
 * returned them (POST /api/checkout/coupon), so the summaries can show the
 * discount as the cart changes (lib/pricing, the same math as the server).
 * Kept in localStorage with the cart, so it carries from the cart into the
 * checkout and survives a reload. Never trusted: preparing the order sends
 * only the code, and the server validates and prices it again.
 */

export interface AppliedCouponTerms extends CouponTerms {
  /** "10% de descuento". */
  label: string;
}

interface CouponState {
  coupon: AppliedCouponTerms | null;
  apply: (coupon: AppliedCouponTerms) => void;
  remove: () => void;
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
    (set) => ({
      coupon: null,
      apply: (coupon) => set({ coupon }),
      remove: () => set({ coupon: null }),
    }),
    {
      name: "lego-coupon-storage",
      version: 1,
      storage: createJSONStorage(persistStorage),
      skipHydration: true,
      partialize: (state) => ({ coupon: state.coupon }),
      merge: (persisted, current) => ({ ...current, coupon: couponFrom(isRecord(persisted) ? persisted.coupon : null) }),
    }
  )
);

export const useAppliedCoupon = () => useCouponStore((state) => state.coupon);
