import { describe, it, expect } from "vitest";
import {
  cardLength,
  cvvLength,
  detectCardBrand,
  formatCardNumber,
  formatExpiry,
  isExpiryInFuture,
  maskedNumber,
  passesLuhn,
} from "@/lib/card";

describe("card helpers", () => {
  it("detects the brand from the first digits", () => {
    expect(detectCardBrand("4242")).toBe("visa");
    expect(detectCardBrand("5555 4444")).toBe("mastercard");
    expect(detectCardBrand("2221")).toBe("mastercard");
    expect(detectCardBrand("3782")).toBe("amex");
    expect(detectCardBrand("6011")).toBe("unknown");
    expect(detectCardBrand("")).toBe("unknown");
  });

  it("groups digits by brand and drops extras", () => {
    expect(formatCardNumber("4242424242424242999")).toBe("4242 4242 4242 4242");
    expect(formatCardNumber("42a42-42")).toBe("4242 42");
    expect(formatCardNumber("378282246310005")).toBe("3782 822463 10005");
    expect(cardLength("amex")).toBe(15);
    expect(cvvLength("amex")).toBe(4);
    expect(cvvLength("visa")).toBe(3);
  });

  it("formats the expiry as MM/AA", () => {
    expect(formatExpiry("1")).toBe("1");
    expect(formatExpiry("12")).toBe("12");
    expect(formatExpiry("1229")).toBe("12/29");
    expect(formatExpiry("12/299")).toBe("12/29");
  });

  it("checks the Luhn sum", () => {
    expect(passesLuhn("4242 4242 4242 4242")).toBe(true);
    expect(passesLuhn("378282246310005")).toBe(true);
    expect(passesLuhn("4242 4242 4242 4241")).toBe(false);
    expect(passesLuhn("")).toBe(false);
  });

  it("accepts the current month and later", () => {
    const now = new Date(2026, 9, 17); // October 2026
    expect(isExpiryInFuture("10/26", now)).toBe(true);
    expect(isExpiryInFuture("01/27", now)).toBe(true);
    expect(isExpiryInFuture("09/26", now)).toBe(false);
    expect(isExpiryInFuture("13/30", now)).toBe(false);
  });

  it("masks for display", () => {
    expect(maskedNumber("4242")).toBe("•••• 4242");
  });
});
