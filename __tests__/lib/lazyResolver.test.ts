import { describe, it, expect, vi } from "vitest";
import type { Resolver } from "react-hook-form";
import { lazyResolver, shippingResolver } from "@/lib/validations/lazy";

type Values = { name: string };
const ok: Resolver<Values> = async (values) => ({ values, errors: {} });
const args = [{ name: "Ana" }, undefined, { fields: {}, shouldUseNativeValidation: false }] as const;

describe("lazyResolver", () => {
  it("loads the validator once, on first use or preload", async () => {
    const load = vi.fn(() => Promise.resolve(ok));
    const resolver = lazyResolver<Values>(load);
    expect(load).not.toHaveBeenCalled();

    resolver.preload();
    resolver.preload();
    await expect(resolver(...args)).resolves.toEqual({ values: { name: "Ana" }, errors: {} });
    await resolver(...args);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("retries the import after a failure", async () => {
    const load = vi.fn<() => Promise<Resolver<Values>>>().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(ok);
    const resolver = lazyResolver<Values>(load);
    await expect(resolver(...args)).rejects.toThrow("offline");
    await expect(resolver(...args)).resolves.toMatchObject({ errors: {} });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("the checkout resolver validates with the zod schema once loaded", async () => {
    const result = await shippingResolver(
      { firstName: "", lastName: "", email: "", phone: "", address: "", city: "", state: "", zipCode: "", country: "Argentina" },
      undefined,
      { fields: {}, shouldUseNativeValidation: false }
    );
    expect(Object.keys(result.errors)).toContain("firstName");
  });
});
