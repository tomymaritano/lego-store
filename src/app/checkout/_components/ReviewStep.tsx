"use client";

import { motion } from "motion/react";
import { ChevronLeft, CreditCard, Lock, MapPin } from "lucide-react";
import { stepSlide } from "@/lib/motion";
import { Button } from "@/components/ui";
import type { PaymentSummary, ShippingInfo } from "@/types";

interface ReviewStepProps {
  shippingInfo: ShippingInfo;
  payment: PaymentSummary;
  onBack: () => void;
  onPlaceOrder: () => void;
  isProcessing: boolean;
}

const panel = "rounded-2xl border border-border bg-surface p-6 shadow-card";

export function ReviewStep({ shippingInfo, payment, onBack, onPlaceOrder, isProcessing }: ReviewStepProps) {
  return (
    <motion.section
      aria-labelledby="review-title"
      variants={stepSlide}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-6"
    >
      <h2 id="review-title" className="sr-only">
        Revisar pedido
      </h2>

      <div className={panel}>
        <h3 className="mb-4 flex items-center gap-2 text-title">
          <MapPin aria-hidden="true" className="size-5 text-info" />
          Dirección de envío
        </h3>
        <address className="text-fg-secondary not-italic">
          <p className="font-medium text-fg">
            {shippingInfo.firstName} {shippingInfo.lastName}
          </p>
          <p>{shippingInfo.address}</p>
          <p>
            {shippingInfo.city}, {shippingInfo.state} {shippingInfo.zipCode}
          </p>
          <p>{shippingInfo.email}</p>
          <p>{shippingInfo.phone}</p>
        </address>
      </div>

      <div className={panel}>
        <h3 className="mb-4 flex items-center gap-2 text-title">
          <CreditCard aria-hidden="true" className="size-5 text-info" />
          Método de pago
        </h3>
        <div className="text-fg-secondary">
          <p>
            Tarjeta terminada en <span className="font-medium text-fg">{payment.last4}</span>
          </p>
          <p>{payment.cardName}</p>
          <p>Vence {payment.expiryDate}</p>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack} disabled={isProcessing}>
          <ChevronLeft aria-hidden="true" />
          Volver
        </Button>
        <Button size="lg" onClick={onPlaceOrder} loading={isProcessing}>
          {isProcessing ? (
            "Procesando…"
          ) : (
            <>
              <Lock aria-hidden="true" />
              Confirmar pedido
            </>
          )}
        </Button>
      </div>
    </motion.section>
  );
}
