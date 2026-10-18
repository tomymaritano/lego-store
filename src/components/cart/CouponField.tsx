"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { Check, TicketPercent, X } from "lucide-react";
import type { CouponQuote } from "@/lib/coupons/server";
import { fadeInUp, successPop } from "@/lib/motion";
import type { CheckoutError } from "@/lib/orders/types";
import { cn, formatPrice } from "@/lib/utils";
import { useAppliedCoupon, useCouponStore } from "@/stores";
import { Button, Field, Input } from "@/components/ui";

type QuoteResult = { ok: true; quote: CouponQuote } | { ok: false; error: string };

const NETWORK_ERROR = "No pudimos validar el cupón. Revisa tu conexión e inténtalo de nuevo.";

/** POST /api/checkout/coupon: the server checks the code and prices the lines. */
async function requestQuote(body: { code: string; lines: { productId: string; quantity: number }[]; email?: string }): Promise<QuoteResult> {
  try {
    const response = await fetch("/api/checkout/coupon", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as (CouponQuote & Partial<CheckoutError>) | null;
    if (response.ok && data?.coupon) return { ok: true, quote: data };
    return { ok: false, error: data?.error ?? NETWORK_ERROR };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

export interface CouponFieldProps {
  /** What the coupon would apply to (the server prices them). */
  lines: { productId: string; quantity: number }[];
  /** The subtotal the coupon's minimum is compared with. */
  subtotal: number;
  /** The checkout's email, once known: the per-customer limit is checked for guests too. */
  email?: string | null;
  /** While the payment runs nothing changes. */
  disabled?: boolean;
  /** Prefix of the data-testid values (`${prefix}-coupon-…`): two summaries can be on a page. */
  testIdPrefix?: string;
  className?: string;
}

/**
 * "Código de descuento" in the cart's and the checkout's summary. Applying
 * asks the server (POST /api/checkout/coupon: active, dates, limits, per
 * customer); an accepted coupon's terms go into the coupon store, and the
 * totals around it show the discount with lib/pricing as the cart changes.
 * The order is what really takes it: preparing it validates and reserves the
 * coupon again on the server.
 *
 * The form and the applied coupon swap in place; the applied one pops its
 * check mark, and a live region says what happened for screen readers.
 */
export function CouponField({ lines, subtotal, email, disabled = false, testIdPrefix = "cart", className }: CouponFieldProps) {
  const coupon = useAppliedCoupon();
  const apply = useCouponStore((state) => state.apply);
  const remove = useCouponStore((state) => state.remove);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  /** Where focus goes once the swap has happened (the new element mounts after the old one has left). */
  const focusNext = useRef<"input" | "remove" | null>(null);
  const fieldId = useId();
  const focusOnMount = (target: "input" | "remove") => (node: HTMLElement | null) => {
    if (node && focusNext.current === target) {
      focusNext.current = null;
      node.focus();
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || disabled) return;
    const typed = code.trim();
    if (!typed) {
      setError("Escribe el código de tu cupón.");
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    const result = await requestQuote({ code: typed, lines, ...(email ? { email } : {}) });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      inputRef.current?.focus();
      return;
    }
    const { coupon: terms } = result.quote;
    apply(terms);
    setCode("");
    setAnnouncement(`Aplicamos el cupón ${terms.code}: ${terms.label}.`);
    // The applied coupon replaces the form: focus lands on its "Quitar" once it is there.
    focusNext.current = "remove";
  };

  const removeCoupon = () => {
    if (!coupon || disabled) return;
    setAnnouncement(`Quitamos el cupón ${coupon.code}.`);
    focusNext.current = "input";
    remove();
    setError(null);
  };

  const shortBy = coupon ? Math.max(0, coupon.minSubtotal - subtotal) : 0;

  return (
    <div className={cn("min-h-11", className)} data-testid={`${testIdPrefix}-coupon`}>
      <AnimatePresence mode="wait" initial={false}>
        {coupon ? (
          <m.div
            key="applied"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-3"
            data-testid={`${testIdPrefix}-coupon-applied`}
          >
            <m.span
              variants={successPop}
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-on-success"
              aria-hidden="true"
            >
              <Check className="size-4" />
            </m.span>
            <span className="flex min-w-0 flex-1 flex-col text-label font-normal">
              <span className="font-mono font-semibold text-fg" data-testid={`${testIdPrefix}-coupon-code`}>
                {coupon.code}
              </span>
              <span className="text-fg-secondary">{coupon.label}</span>
              {shortBy > 0 ? (
                <span className="mt-1 text-caption text-fg-muted" data-testid={`${testIdPrefix}-coupon-short`}>
                  Se aplica desde {formatPrice(coupon.minSubtotal)}: te faltan {formatPrice(shortBy)}.
                </span>
              ) : null}
            </span>
            <Button
              ref={focusOnMount("remove")}
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeCoupon}
              disabled={disabled}
              aria-label={`Quitar el cupón ${coupon.code}`}
              className="-my-1 -mr-1 shrink-0"
            >
              <X aria-hidden="true" />
              Quitar
            </Button>
          </m.div>
        ) : (
          <m.form key="form" variants={fadeInUp} initial="hidden" animate="visible" exit="exit" onSubmit={submit} noValidate aria-label="Cupón de descuento">
            <Field label="Código de descuento" error={error} id={`${fieldId}-coupon`} disabled={disabled}>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                <Input
                  ref={(node) => {
                    inputRef.current = node;
                    focusOnMount("input")(node);
                  }}
                  name="coupon"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Por ejemplo: BIENVENIDA10"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={40}
                  leftIcon={<TicketPercent />}
                  className="uppercase placeholder:normal-case"
                  data-testid={`${testIdPrefix}-coupon-input`}
                />
                </div>
                <Button type="submit" variant="secondary" loading={pending} disabled={disabled} className="shrink-0" data-testid={`${testIdPrefix}-coupon-apply`}>
                  Aplicar
                </Button>
              </div>
            </Field>
          </m.form>
        )}
      </AnimatePresence>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
