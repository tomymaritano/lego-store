"use client";

import { loadStripe } from "@stripe/stripe-js/pure";
import type { Appearance, Stripe } from "@stripe/stripe-js";
import { useThemed, type ThemeTokens } from "./providerTheme";

/*
 * Stripe.js in the browser. Loaded from js.stripe.com only when the payment
 * step first renders (the /pure entry does not inject the script on import),
 * once per page.
 */

let stripePromise: Promise<Stripe | null> | null = null;
let loadedKey: string | null = null;

export function getStripe(publishableKey: string): Promise<Stripe | null> {
  if (!stripePromise || loadedKey !== publishableKey) {
    loadedKey = publishableKey;
    stripePromise = loadStripe(publishableKey, { locale: "es-419" });
  }
  return stripePromise;
}

/** Barlow from Google Fonts: the Payment Element's iframe cannot see our self-hosted copy. */
export const STRIPE_FONTS = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&display=swap" }];

/** The Payment Element themed with the store's tokens (./providerTheme.ts). */
export function stripeAppearance({ dark, token }: ThemeTokens): Appearance {
  const border = token("--border-strong");
  const focus = token("--focus-ring");
  return {
    theme: dark ? "night" : "stripe",
    labels: "above",
    variables: {
      colorPrimary: focus,
      colorBackground: token("--surface"),
      colorText: token("--fg"),
      colorTextSecondary: token("--fg-secondary"),
      colorTextPlaceholder: token("--fg-muted"),
      colorDanger: token("--danger"),
      colorSuccess: token("--success"),
      fontFamily: "Barlow, system-ui, sans-serif",
      fontSizeBase: "16px",
      borderRadius: token("--radius-lg") || "0.5rem",
      spacingUnit: "4px",
    },
    rules: {
      ".Label": { fontWeight: "600", color: token("--fg"), marginBottom: "6px" },
      ".Input": { borderColor: border, boxShadow: "none", padding: "11px 14px" },
      ".Input:focus": { borderColor: focus, boxShadow: `0 0 0 1px ${focus}` },
      ".Input--invalid": { borderColor: token("--danger") },
      ".Tab": { borderColor: border },
    },
  };
}

/** stripeAppearance, refreshed whenever the theme changes. */
export const useStripeAppearance = (): Appearance | null => useThemed(stripeAppearance);
