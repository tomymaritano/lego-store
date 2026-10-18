"use client";

import { useEffect, useRef } from "react";
import { useCartStore, useCouponStore, useStoreHydrated } from "@/stores";
import { requestCouponQuote } from "./couponApi";

/** The message the coupon field shows when the re-check takes the coupon off. */
export const couponRemovedNotice = (code: string, reason: string) => `Quitamos el cupón ${code}: ${reason}`;

/**
 * Asks the server again about the applied coupon when the cart page or the
 * checkout loads, and when the tab comes back into view: an admin may have
 * changed its terms, deactivated it, or its dates or uses may have run out
 * since it was applied. New terms replace the stored ones; a refusal takes
 * it off with the server's reason (the coupon field shows it). Until the
 * first answer the summaries leave the discount out (useCheckedCoupon). When
 * the server cannot be asked, the stored terms stand: the order is checked
 * again anyway when the checkout prepares it.
 *
 * Changing the cart's lines does not ask again: what the server decides
 * (active, dates, limits, terms) does not depend on them, and the minimum
 * subtotal is applied from the terms as the cart changes (lib/pricing).
 */
export function useCouponRecheck() {
  const cartReady = useStoreHydrated(useCartStore);
  const couponReady = useStoreHydrated(useCouponStore);
  const code = useCouponStore((state) => state.coupon?.code ?? null);
  const ready = cartReady && couponReady;
  // The code this mount last saw (undefined: none yet). A coupon applied here, after none, was just confirmed.
  const seen = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!ready) return;
    const appliedHere = seen.current === null && useCouponStore.getState().checked === code;
    seen.current = code;
    if (!code) return;
    let controller: AbortController | null = null;
    const recheck = async () => {
      const lines = useCartStore.getState().cart.map((line) => ({ productId: line.id, quantity: line.quantity }));
      if (lines.length === 0) return;
      controller?.abort();
      const current = new AbortController();
      controller = current;
      let result;
      try {
        result = await requestCouponQuote({ code, lines, recheck: true }, current.signal);
      } catch {
        return; // Aborted: a newer check is on its way, or the page left.
      }
      const store = useCouponStore.getState();
      // Removed or replaced meanwhile: this answer is about another coupon.
      if (current.signal.aborted || store.coupon?.code !== code) return;
      if (result.ok) store.apply(result.quote.coupon, store.owner);
      else if (result.refused) store.remove(couponRemovedNotice(code, result.error));
      else store.markChecked();
    };
    if (!appliedHere) void recheck();
    const onVisible = () => {
      if (document.visibilityState === "visible") void recheck();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, code]);
}
