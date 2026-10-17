"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { scaleIn } from "@/lib/motion";
import { Button } from "@/components/ui";

interface ConfirmationStepProps {
  orderId: string;
  onContinueShopping: () => void;
}

export function ConfirmationStep({ orderId, onContinueShopping }: ConfirmationStepProps) {
  return (
    <motion.section
      aria-labelledby="confirmation-title"
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-8 text-center shadow-card"
    >
      <span
        aria-hidden="true"
        className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-success text-on-success"
      >
        <Check className="size-10" />
      </span>

      <h2 id="confirmation-title" className="mb-2 text-2xl">
        ¡Pedido confirmado!
      </h2>
      <p className="mb-6 text-fg-secondary" role="status">
        Gracias por tu compra. Te enviamos un correo de confirmación con los detalles.
      </p>

      <div className="mb-6 rounded-xl bg-bg-subtle p-4">
        <p className="mb-1 text-sm text-fg-muted">Número de pedido</p>
        <p className="font-mono text-xl font-bold text-fg">{orderId}</p>
      </div>

      <div className="space-y-3">
        <Button size="lg" className="w-full" onClick={onContinueShopping}>
          Continuar comprando
        </Button>
        <Button variant="outline" className="w-full" render={<Link href="/" />}>
          Volver al inicio
        </Button>
      </div>
    </motion.section>
  );
}
