import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KNOWN_DEVICE_COOKIE, knownDeviceValue, readKnownDevice } from "@/lib/auth/known-device";

const cookieHeader = (value: string) => new Headers({ cookie: `otra=1; ${KNOWN_DEVICE_COOKIE}=${value}; tema=oscuro` });

describe("known-device cookie", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "unit-test-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("proves a past login for that email (any casing), and only for it", () => {
    const value = knownDeviceValue("ana@tienda.test", "dispositivo-1234567")!;
    expect(readKnownDevice(cookieHeader(value), " ANA@tienda.test")).toBe("dispositivo-1234567");
    expect(readKnownDevice(cookieHeader(value), "bruno@tienda.test")).toBeNull();
  });

  it("refuses a tampered, malformed or missing cookie", () => {
    const value = knownDeviceValue("ana@tienda.test", "dispositivo-1234567")!;
    const [, signature] = value.split(".");
    expect(readKnownDevice(cookieHeader(`otro-dispositivo-999.${signature}`), "ana@tienda.test")).toBeNull();
    expect(readKnownDevice(cookieHeader("dispositivo-1234567"), "ana@tienda.test")).toBeNull();
    expect(readKnownDevice(cookieHeader("x.y"), "ana@tienda.test")).toBeNull();
    expect(readKnownDevice(new Headers(), "ana@tienda.test")).toBeNull();
  });

  it("does not verify with another secret, and makes nothing without one", () => {
    const value = knownDeviceValue("ana@tienda.test", "dispositivo-1234567")!;
    vi.stubEnv("AUTH_SECRET", "otro-secreto");
    expect(readKnownDevice(cookieHeader(value), "ana@tienda.test")).toBeNull();
    vi.stubEnv("AUTH_SECRET", "");
    expect(knownDeviceValue("ana@tienda.test")).toBeNull();
    expect(readKnownDevice(cookieHeader(value), "ana@tienda.test")).toBeNull();
  });
});
