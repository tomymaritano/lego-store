import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { PaymentInfo, ShippingInfo } from "@/types";
import { paymentSchema, shippingSchema } from "./checkout";
import { contactSchema, type ContactInput } from "./contact";

/**
 * zod-backed resolvers for the checkout and contact forms. Only ever loaded
 * through ./lazy: this module is what pulls zod and @hookform/resolvers in,
 * so it stays out of the routes' first-load JS.
 */
export const shippingResolver: Resolver<ShippingInfo> = zodResolver(shippingSchema);
export const paymentResolver: Resolver<PaymentInfo> = zodResolver(paymentSchema);
export const contactResolver: Resolver<ContactInput> = zodResolver(contactSchema);
