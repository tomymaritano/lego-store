"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_SHIPPING_RULES, type ShippingRules } from "@/lib/pricing";

const ShippingRulesContext = createContext<ShippingRules>(DEFAULT_SHIPPING_RULES);

/**
 * The store's shipping rule (cost and free-shipping threshold, an admin's
 * setting) for the client islands that price a cart: the drawer, the cart
 * page and checkout. The root layout reads it from the settings cache on
 * every request, so a change shows on the next page load. Only for what
 * the browser shows: the server prices the order again with the rule in the
 * database (src/lib/settings, readShippingRules), and checkout's review step
 * shows the server's totals.
 */
export function ShippingRulesProvider({ rules, children }: { rules: ShippingRules; children: ReactNode }) {
  return <ShippingRulesContext.Provider value={rules}>{children}</ShippingRulesContext.Provider>;
}

/** The shipping rule (DEFAULT_SHIPPING_RULES outside the provider: Storybook, unit tests). */
export function useShippingRules(): ShippingRules {
  return useContext(ShippingRulesContext);
}
