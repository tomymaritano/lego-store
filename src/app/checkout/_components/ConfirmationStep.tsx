"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Mail, Truck } from "lucide-react";
import { siteConfig } from "@/config/site";
import { drawPath, scaleIn, staggerContainer, staggerItem, successPop } from "@/lib/motion";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui";

interface ConfirmationStepProps {
  orderId: string;
  total: number | null;
  email: string | null;
}

const { deliveryDays } = siteConfig.commerce;

/**
 * Order placed: an animated tick, the order number and what happens next.
 * Its heading is the page's h1 (the checkout header is gone by then); focus
 * moves to it so the success is announced.
 */
export function ConfirmationStep({ orderId, total, email }: ConfirmationStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <motion.section
      aria-labelledby="confirmation-title"
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      data-testid="order-confirmation"
      className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-6 text-center shadow-card sm:p-10"
    >
      <motion.div variants={staggerContainer(0.06, 0.1)} initial="hidden" animate="visible" className="flex flex-col items-center">
        <motion.span
          variants={successPop}
          aria-hidden="true"
          className="mb-6 flex size-20 items-center justify-center rounded-full bg-success text-on-success shadow-card"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" variants={drawPath} />
          </svg>
        </motion.span>

        <motion.h1
          variants={staggerItem}
          id="confirmation-title"
          ref={headingRef}
          tabIndex={-1}
          className="mb-2 scroll-mt-32 text-2xl text-fg sm:text-3xl outline-none"
        >
          ¡Gracias por tu compra!
        </motion.h1>
        <motion.p variants={staggerItem} className="mb-6 text-fg-secondary">
          Tu pedido está confirmado y ya lo estamos preparando.
        </motion.p>

        <motion.dl variants={staggerItem} className="mb-6 grid w-full gap-3 rounded-xl bg-bg-subtle p-4 text-left sm:grid-cols-2">
          <div>
            <dt className="text-caption text-fg-muted">Número de pedido</dt>
            <dd className="font-mono text-lg font-bold text-fg" data-testid="order-id">
              {orderId}
            </dd>
          </div>
          {total !== null && (
            <div className="sm:text-right">
              <dt className="text-caption text-fg-muted">Total pagado</dt>
              <dd className="text-lg font-bold text-fg tabular-nums">{formatPrice(total)}</dd>
            </div>
          )}
        </motion.dl>

        <motion.ul variants={staggerItem} className="mb-8 w-full space-y-2 text-left text-sm text-fg-secondary">
          {email && (
            <li className="flex items-start gap-2">
              <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
              <span>
                Te enviamos la confirmación a <strong className="font-semibold text-fg">{email}</strong>.
              </span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <Truck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
            <span>
              Llega en {deliveryDays.min} a {deliveryDays.max} días hábiles.
            </span>
          </li>
        </motion.ul>

        <motion.div variants={staggerItem} className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" render={<Link href="/" />}>
            Seguir comprando
            <ArrowRight aria-hidden="true" />
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/contacto" />}>
            ¿Necesitas ayuda?
          </Button>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}
