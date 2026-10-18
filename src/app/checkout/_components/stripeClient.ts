"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Appearance, Stripe } from "@stripe/stripe-js";

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

const token = (styles: CSSStyleDeclaration, name: string) => styles.getPropertyValue(name).trim();

/**
 * The Payment Element themed with the store's tokens, read from <html> at
 * this moment (light or dark: the same variables change with the theme).
 * Stripe's iframe cannot read CSS variables, so their resolved values go in.
 */
export function readStripeAppearance(): Appearance {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const dark = root.classList.contains("dark");
  const border = token(styles, "--border-strong");
  const focus = token(styles, "--focus-ring");
  return {
    theme: dark ? "night" : "stripe",
    labels: "above",
    variables: {
      colorPrimary: focus,
      colorBackground: token(styles, "--surface"),
      colorText: token(styles, "--fg"),
      colorTextSecondary: token(styles, "--fg-secondary"),
      colorTextPlaceholder: token(styles, "--fg-muted"),
      colorDanger: token(styles, "--danger"),
      colorSuccess: token(styles, "--success"),
      fontFamily: "Barlow, system-ui, sans-serif",
      fontSizeBase: "16px",
      borderRadius: token(styles, "--radius-lg") || "0.5rem",
      spacingUnit: "4px",
    },
    rules: {
      ".Label": { fontWeight: "600", color: token(styles, "--fg"), marginBottom: "6px" },
      ".Input": { borderColor: border, boxShadow: "none", padding: "11px 14px" },
      ".Input:focus": { borderColor: focus, boxShadow: `0 0 0 1px ${focus}` },
      ".Input--invalid": { borderColor: token(styles, "--danger") },
      ".Tab": { borderColor: border },
    },
  };
}

/** readStripeAppearance, refreshed whenever the theme changes (the `dark` class on <html>). */
export function useStripeAppearance(): Appearance | null {
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  useEffect(() => {
    const update = () => setAppearance(readStripeAppearance());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return appearance;
}
