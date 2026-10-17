/**
 * Card input helpers for the mock payment form. The full number and CVV only
 * ever pass through these pure functions and the form state; what leaves the
 * form is a CardSummary (brand + last 4). The backend will swap the form for
 * Stripe's Payment Element, which does all of this itself.
 */

import type { CardBrand } from "@/types";

export type { CardBrand };

interface BrandRule {
  pattern: RegExp;
  /** Digits in a full number. */
  length: number;
  cvvLength: number;
  /** Digit groups for display, e.g. [4, 6, 5] for Amex. */
  groups: number[];
}

const RULES: Record<Exclude<CardBrand, "unknown">, BrandRule> = {
  visa: { pattern: /^4/, length: 16, cvvLength: 3, groups: [4, 4, 4, 4] },
  mastercard: { pattern: /^(5[1-5]|2[2-7])/, length: 16, cvvLength: 3, groups: [4, 4, 4, 4] },
  amex: { pattern: /^3[47]/, length: 15, cvvLength: 4, groups: [4, 6, 5] },
};

const DEFAULT_RULE: BrandRule = { pattern: /^/, length: 16, cvvLength: 3, groups: [4, 4, 4, 4] };

export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  unknown: "Tarjeta",
};

/** Digits only. */
export const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function detectCardBrand(value: string): CardBrand {
  const digits = onlyDigits(value);
  for (const [brand, rule] of Object.entries(RULES) as [Exclude<CardBrand, "unknown">, BrandRule][]) {
    if (rule.pattern.test(digits)) return brand;
  }
  return "unknown";
}

const ruleFor = (brand: CardBrand) => (brand === "unknown" ? DEFAULT_RULE : RULES[brand]);

/** Digits a full number of this brand has (16, or 15 for Amex). */
export const cardLength = (brand: CardBrand) => ruleFor(brand).length;
/** Digits of the security code (3, or 4 for Amex). */
export const cvvLength = (brand: CardBrand) => ruleFor(brand).cvvLength;

/** "4242424242424242" → "4242 4242 4242 4242" (Amex: "3782 822463 10005"). Extra digits are dropped. */
export function formatCardNumber(value: string): string {
  const brand = detectCardBrand(value);
  const { length, groups } = ruleFor(brand);
  const digits = onlyDigits(value).slice(0, length);
  const parts: string[] = [];
  let start = 0;
  for (const size of groups) {
    if (start >= digits.length) break;
    parts.push(digits.slice(start, start + size));
    start += size;
  }
  return parts.join(" ");
}

/** "1229" → "12/29"; typing "1" then "12" stays as is until the year starts. */
export function formatExpiry(value: string): string {
  const digits = onlyDigits(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** Luhn checksum, which every real card number passes. */
export function passesLuhn(value: string): boolean {
  const digits = onlyDigits(value);
  if (!digits) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** True when "MM/AA" is the current month or later. */
export function isExpiryInFuture(value: string, now = new Date()): boolean {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const currentYear = now.getFullYear();
  return year > currentYear || (year === currentYear && month >= now.getMonth() + 1);
}

/** "•••• 4242" for display. */
export const maskedNumber = (last4: string) => `•••• ${last4}`;
