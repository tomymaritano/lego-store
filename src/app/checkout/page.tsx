"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronLeft,
  CreditCard,
  MapPin,
  Package,
  ShoppingBag,
  Truck,
  Lock,
  Shield,
} from "lucide-react";
import { useCartStore } from "@/stores";
import { useCheckoutStore, type ShippingInfo, type PaymentInfo, type CheckoutStep } from "@/stores/checkoutStore";
import { useHydration } from "@/hooks/useHydration";
import { formatPrice, cn } from "@/lib/utils";
import { Button, Breadcrumbs, showToast } from "@/components/ui";

const steps: { id: CheckoutStep; label: string; icon: typeof MapPin }[] = [
  { id: "shipping", label: "Envío", icon: MapPin },
  { id: "payment", label: "Pago", icon: CreditCard },
  { id: "review", label: "Revisar", icon: Package },
];

export default function CheckoutPage() {
  const router = useRouter();
  const hydrated = useHydration();

  const cart = useCartStore((state) => state.cart);
  const getTotalPrice = useCartStore((state) => state.getTotalPrice);
  const clearCart = useCartStore((state) => state.clearCart);

  const {
    currentStep,
    shippingInfo,
    paymentInfo,
    orderId,
    isProcessing,
    setStep,
    setShippingInfo,
    setPaymentInfo,
    processOrder,
    resetCheckout,
  } = useCheckoutStore();

  // Redirect if cart is empty
  useEffect(() => {
    if (hydrated && cart.length === 0 && currentStep !== "confirmation") {
      router.push("/cart");
    }
  }, [hydrated, cart, currentStep, router]);

  const subtotal = hydrated ? getTotalPrice() : 0;
  const shipping = subtotal >= 5000 ? 0 : 299;
  const total = subtotal + shipping;

  const handleShippingSubmit = (data: ShippingInfo) => {
    setShippingInfo(data);
    setStep("payment");
  };

  const handlePaymentSubmit = (data: PaymentInfo) => {
    setPaymentInfo(data);
    setStep("review");
  };

  const handlePlaceOrder = async () => {
    try {
      await processOrder();
      clearCart();
      showToast.success("¡Pedido realizado con éxito!");
    } catch {
      showToast.error("Error al procesar el pedido");
    }
  };

  const breadcrumbItems = [
    { label: "Carrito", href: "/cart" },
    { label: "Checkout" },
  ];

  if (!hydrated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="container-custom py-6">
        <Breadcrumbs items={breadcrumbItems} />

        {/* Progress Steps */}
        {currentStep !== "confirmation" && (
          <div className="flex justify-center mb-8 mt-4">
            <div className="flex items-center gap-4">
              {steps.map((step, index) => {
                const isActive = step.id === currentStep;
                const isCompleted =
                  steps.findIndex((s) => s.id === currentStep) > index;

                return (
                  <div key={step.id} className="flex items-center">
                    <div
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                        isActive && "bg-lego-yellow text-lego-black",
                        isCompleted && "bg-status-success text-white",
                        !isActive && !isCompleted && "bg-background-tertiary text-foreground-muted"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                      <span className="font-medium hidden sm:inline">{step.label}</span>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={cn(
                          "w-12 h-1 mx-2 rounded",
                          isCompleted ? "bg-status-success" : "bg-background-tertiary"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {currentStep === "shipping" && (
                <ShippingForm
                  key="shipping"
                  initialData={shippingInfo}
                  onSubmit={handleShippingSubmit}
                />
              )}
              {currentStep === "payment" && (
                <PaymentForm
                  key="payment"
                  initialData={paymentInfo}
                  onSubmit={handlePaymentSubmit}
                  onBack={() => setStep("shipping")}
                />
              )}
              {currentStep === "review" && (
                <ReviewStep
                  key="review"
                  shippingInfo={shippingInfo!}
                  paymentInfo={paymentInfo!}
                  onBack={() => setStep("payment")}
                  onPlaceOrder={handlePlaceOrder}
                  isProcessing={isProcessing}
                />
              )}
              {currentStep === "confirmation" && (
                <ConfirmationStep
                  key="confirmation"
                  orderId={orderId!}
                  onContinueShopping={() => {
                    resetCheckout();
                    router.push("/");
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary */}
          {currentStep !== "confirmation" && (
            <div className="lg:col-span-1">
              <div className="bg-surface rounded-2xl shadow-sm border border-border p-6 sticky top-24">
                <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground-primary">
                  <ShoppingBag className="w-5 h-5" />
                  Resumen del pedido
                </h2>

                {/* Items */}
                <div className="space-y-3 mb-4 max-h-64 overflow-auto">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="relative w-16 h-16 bg-background-secondary rounded-lg flex-shrink-0">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-contain p-1"
                        />
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-lego-black text-white text-xs rounded-full flex items-center justify-center">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1 text-foreground-primary">{item.name}</p>
                        <p className="text-sm text-foreground-muted">{formatPrice(item.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <hr className="my-4 border-border" />

                {/* Totals */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Subtotal</span>
                    <span className="text-foreground-primary">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Envío</span>
                    <span className={shipping === 0 ? "text-status-success" : "text-foreground-primary"}>
                      {shipping === 0 ? "GRATIS" : formatPrice(shipping)}
                    </span>
                  </div>
                  <hr className="my-2 border-border" />
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-foreground-primary">Total</span>
                    <span className="text-foreground-primary">{formatPrice(total)}</span>
                  </div>
                </div>

                {/* Trust badges */}
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm text-foreground-muted">
                    <Lock className="w-4 h-4" />
                    <span>Pago 100% seguro</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-foreground-muted mt-2">
                    <Shield className="w-4 h-4" />
                    <span>Garantía de productos originales</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Shipping Form Component
interface ShippingFormProps {
  initialData: ShippingInfo | null;
  onSubmit: (data: ShippingInfo) => void;
}

function ShippingForm({ initialData, onSubmit }: ShippingFormProps) {
  const [formData, setFormData] = useState<ShippingInfo>(
    initialData || {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "México",
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-surface rounded-2xl shadow-sm border border-border p-6"
    >
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-foreground-primary">
        <Truck className="w-6 h-6 text-lego-blue" />
        Información de envío
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground-primary">Nombre *</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-background-primary text-foreground-primary focus:ring-2 focus:ring-lego-yellow focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground-primary">Apellido *</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-background-primary text-foreground-primary focus:ring-2 focus:ring-lego-yellow focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground-primary">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-background-primary text-foreground-primary focus:ring-2 focus:ring-lego-yellow focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground-primary">Teléfono *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-background-primary text-foreground-primary focus:ring-2 focus:ring-lego-yellow focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-foreground-primary">Dirección *</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            placeholder="Calle, número, colonia"
            className="w-full px-4 py-3 rounded-xl border border-border bg-background-primary text-foreground-primary placeholder:text-foreground-muted focus:ring-2 focus:ring-lego-yellow focus:border-transparent"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground-primary">Ciudad *</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-background-primary text-foreground-primary focus:ring-2 focus:ring-lego-yellow focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground-primary">Estado *</label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-background-primary text-foreground-primary focus:ring-2 focus:ring-lego-yellow focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground-primary">C.P. *</label>
            <input
              type="text"
              name="zipCode"
              value={formData.zipCode}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-background-primary text-foreground-primary focus:ring-2 focus:ring-lego-yellow focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Link href="/cart">
            <Button variant="ghost" type="button">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Volver al carrito
            </Button>
          </Link>
          <Button type="submit" size="lg">
            Continuar al pago
          </Button>
        </div>
      </form>
    </motion.div>
  );
}

// Payment Form Component
interface PaymentFormProps {
  initialData: PaymentInfo | null;
  onSubmit: (data: PaymentInfo) => void;
  onBack: () => void;
}

function PaymentForm({ initialData, onSubmit, onBack }: PaymentFormProps) {
  const [formData, setFormData] = useState<PaymentInfo>(
    initialData || {
      cardNumber: "",
      cardName: "",
      expiryDate: "",
      cvv: "",
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Format card number
    if (e.target.name === "cardNumber") {
      value = value.replace(/\D/g, "").slice(0, 16);
      value = value.replace(/(\d{4})/g, "$1 ").trim();
    }

    // Format expiry date
    if (e.target.name === "expiryDate") {
      value = value.replace(/\D/g, "").slice(0, 4);
      if (value.length > 2) {
        value = value.slice(0, 2) + "/" + value.slice(2);
      }
    }

    // Format CVV
    if (e.target.name === "cvv") {
      value = value.replace(/\D/g, "").slice(0, 4);
    }

    setFormData({ ...formData, [e.target.name]: value });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-surface rounded-2xl shadow-sm border border-border p-6"
    >
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-foreground-primary">
        <CreditCard className="w-6 h-6 text-lego-blue" />
        Información de pago
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground-primary">Número de tarjeta *</label>
          <input
            type="text"
            name="cardNumber"
            value={formData.cardNumber}
            onChange={handleChange}
            required
            placeholder="1234 5678 9012 3456"
            className="w-full px-4 py-3 rounded-xl border border-border bg-background-primary text-foreground-primary placeholder:text-foreground-muted focus:ring-2 focus:ring-lego-yellow focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-foreground-primary">Nombre en la tarjeta *</label>
          <input
            type="text"
            name="cardName"
            value={formData.cardName}
            onChange={handleChange}
            required
            placeholder="Como aparece en la tarjeta"
            className="w-full px-4 py-3 rounded-xl border border-border bg-background-primary text-foreground-primary placeholder:text-foreground-muted focus:ring-2 focus:ring-lego-yellow focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground-primary">Fecha de expiración *</label>
            <input
              type="text"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleChange}
              required
              placeholder="MM/AA"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background-primary text-foreground-primary placeholder:text-foreground-muted focus:ring-2 focus:ring-lego-yellow focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground-primary">CVV *</label>
            <input
              type="text"
              name="cvv"
              value={formData.cvv}
              onChange={handleChange}
              required
              placeholder="123"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background-primary text-foreground-primary placeholder:text-foreground-muted focus:ring-2 focus:ring-lego-yellow focus:border-transparent"
            />
          </div>
        </div>

        <div className="bg-background-secondary rounded-xl p-4 mt-4">
          <p className="text-sm text-foreground-secondary flex items-start gap-2">
            <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
            Tus datos están protegidos con encriptación SSL de 256 bits.
            Esta es una demo, no se procesarán pagos reales.
          </p>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="ghost" type="button" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <Button type="submit" size="lg">
            Revisar pedido
          </Button>
        </div>
      </form>
    </motion.div>
  );
}

// Review Step Component
interface ReviewStepProps {
  shippingInfo: ShippingInfo;
  paymentInfo: PaymentInfo;
  onBack: () => void;
  onPlaceOrder: () => void;
  isProcessing: boolean;
}

function ReviewStep({ shippingInfo, paymentInfo, onBack, onPlaceOrder, isProcessing }: ReviewStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Shipping Info */}
      <div className="bg-surface rounded-2xl shadow-sm border border-border p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2 text-foreground-primary">
          <MapPin className="w-5 h-5 text-lego-blue" />
          Dirección de envío
        </h3>
        <div className="text-foreground-secondary">
          <p className="font-medium text-foreground-primary">
            {shippingInfo.firstName} {shippingInfo.lastName}
          </p>
          <p>{shippingInfo.address}</p>
          <p>
            {shippingInfo.city}, {shippingInfo.state} {shippingInfo.zipCode}
          </p>
          <p>{shippingInfo.email}</p>
          <p>{shippingInfo.phone}</p>
        </div>
      </div>

      {/* Payment Info */}
      <div className="bg-surface rounded-2xl shadow-sm border border-border p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2 text-foreground-primary">
          <CreditCard className="w-5 h-5 text-lego-blue" />
          Método de pago
        </h3>
        <div className="text-foreground-secondary">
          <p>
            Tarjeta terminada en{" "}
            <span className="font-medium text-foreground-primary">
              {paymentInfo.cardNumber.slice(-4)}
            </span>
          </p>
          <p>{paymentInfo.cardName}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} disabled={isProcessing}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <Button size="lg" onClick={onPlaceOrder} disabled={isProcessing}>
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Procesando...
            </>
          ) : (
            <>
              <Lock className="w-5 h-5 mr-2" />
              Confirmar pedido
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

// Confirmation Step Component
interface ConfirmationStepProps {
  orderId: string;
  onContinueShopping: () => void;
}

function ConfirmationStep({ orderId, onContinueShopping }: ConfirmationStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-surface rounded-2xl shadow-sm border border-border p-8 text-center max-w-lg mx-auto"
    >
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
        <Check className="w-10 h-10 text-status-success" />
      </div>

      <h1 className="text-2xl font-bold text-foreground-primary mb-2">
        ¡Pedido confirmado!
      </h1>

      <p className="text-foreground-secondary mb-6">
        Gracias por tu compra. Hemos enviado un correo de confirmación con los detalles.
      </p>

      <div className="bg-background-secondary rounded-xl p-4 mb-6">
        <p className="text-sm text-foreground-muted mb-1">Número de pedido</p>
        <p className="text-xl font-bold font-mono text-foreground-primary">{orderId}</p>
      </div>

      <div className="space-y-3">
        <Button size="lg" className="w-full" onClick={onContinueShopping}>
          Continuar comprando
        </Button>
        <Link href="/" className="block">
          <Button variant="outline" className="w-full">
            Volver al inicio
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
