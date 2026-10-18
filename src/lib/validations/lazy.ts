import type { FieldValues, Resolver } from "react-hook-form";
import type { ShippingInfo } from "@/types";
import type { ContactInput } from "./contact";

export type LazyResolver<T extends FieldValues> = Resolver<T> & {
  /** Starts loading the validator (call when the visitor reaches the form). */
  preload: () => void;
};

/**
 * A react-hook-form resolver whose validator module loads on first use.
 * Resolvers are async anyway, so the first validation simply awaits the
 * import; `preload()` (on the form's first focus) makes even that instant.
 * A failed import is retried on the next validation.
 */
export function lazyResolver<T extends FieldValues>(load: () => Promise<Resolver<T>>): LazyResolver<T> {
  let pending: Promise<Resolver<T>> | undefined;
  const get = () =>
    (pending ??= load().catch((error: unknown) => {
      pending = undefined;
      throw error;
    }));
  const resolver: Resolver<T> = async (values, context, options) => (await get())(values, context, options);
  return Object.assign(resolver, { preload: () => void get().catch(() => {}) });
}

const resolvers = () => import("./resolvers");

export const shippingResolver = lazyResolver<ShippingInfo>(() => resolvers().then((mod) => mod.shippingResolver));
export const contactResolver = lazyResolver<ContactInput>(() => resolvers().then((mod) => mod.contactResolver));
