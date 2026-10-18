/**
 * The sample coupons the seed writes (prisma/seed/index.ts), so a dev or demo
 * store has something to try in the cart. The README ("Inicio rápido") lists them.
 * Re-seeding puts their terms back (not their uses).
 */
export interface SeedCoupon {
  code: string;
  description: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minSubtotal: number;
  maxRedemptions: number | null;
  maxPerUser: number | null;
  /** Last valid store day (inclusive), "YYYY-MM-DD"; null = no end. */
  validUntil: string | null;
}

export const coupons: SeedCoupon[] = [
  {
    code: "BIENVENIDA10",
    description: "Ejemplo: 10% en compras desde $2.000, una vez por cliente.",
    type: "PERCENT",
    value: 10,
    minSubtotal: 2000,
    maxRedemptions: null,
    maxPerUser: 1,
    validUntil: null,
  },
  {
    code: "LEGO500",
    description: "Ejemplo: $500 menos en compras desde $4.000; 100 usos en total, hasta fin de 2027.",
    type: "FIXED",
    value: 500,
    minSubtotal: 4000,
    maxRedemptions: 100,
    maxPerUser: null,
    validUntil: "2027-12-31",
  },
];
