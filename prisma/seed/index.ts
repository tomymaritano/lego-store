import type { PrismaClient } from "@/generated/prisma/client";
import { products as seedProducts, type SeedProduct } from "@/data/products";
import { categories as seedCategories } from "@/data/categories";
import { productSearchColumns } from "@/lib/api/search";
import { refreshProductRatings } from "@/lib/api/ratings";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { orderTotals } from "@/lib/pricing";
import {
  handwrittenReviews,
  reviewTemplates,
  sampleUsers,
  type HandwrittenReview,
  type SampleUser,
} from "./sample-reviews";
import { DEV_ADMIN } from "./admin";

/*
 * Idempotent seed: running it again converges on the same rows instead of
 * duplicating them. Seed rows are upserted by their natural keys (category
 * slug, product id, user email, one review per user and product, fixed ids for
 * the sample orders); rows created by people (registrations, real reviews,
 * orders) are left alone, and the cached ratings are recomputed over every
 * review at the end.
 *
 * Catalogue rows are reset to the seed values on every run, stock included:
 * re-seeding a dev database puts the catalogue back where it started.
 */

export interface SeedOptions {
  /** Creates/updates this admin user. Null skips it. */
  admin: { email: string; password: string } | null;
  log?: (message: string) => void;
}

export interface SeedSummary {
  categories: number;
  products: number;
  sampleUsers: number;
  reviews: number;
  helpfulVotes: number;
  orders: number;
  admin: string | null;
}

/** Seed dates are fixed so a re-run never changes them. */
const CATALOGUE_EPOCH = Date.UTC(2024, 0, 1);
const DAY = 24 * 60 * 60 * 1000;

export async function seedDatabase(db: PrismaClient, options: SeedOptions): Promise<SeedSummary> {
  const log = options.log ?? (() => {});

  await seedCatalogue(db);
  log(`Catálogo: ${seedCategories.length} categorías, ${seedProducts.length} productos.`);

  const users = await seedSampleUsers(db);
  const reviews = planReviews();
  const { reviewIds, helpfulVotes } = await seedReviews(db, users, reviews);
  const orders = await seedOrders(db, users, reviews);
  await refreshProductRatings(db);
  log(`Reseñas: ${reviewIds.length} de ${users.size} usuarios de ejemplo, ${helpfulVotes} votos "útil", ${orders} pedidos entregados.`);

  let admin: string | null = null;
  if (options.admin) {
    admin = await seedAdmin(db, options.admin);
    log(`Admin: ${admin}`);
  }
  // The dev admin's password is public: it never stays an admin next to (or instead of) a real one.
  if (admin !== DEV_ADMIN.email && (await demoteDevAdmin(db))) {
    log(`ATENCIÓN: ${DEV_ADMIN.email} (admin de desarrollo, contraseña pública) pasó a USER y ya no puede iniciar sesión.`);
  }

  return {
    categories: seedCategories.length,
    products: seedProducts.length,
    sampleUsers: users.size,
    reviews: reviewIds.length,
    helpfulVotes,
    orders,
    admin,
  };
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

async function seedCatalogue(db: PrismaClient) {
  const categoryNames = new Map(seedCategories.map((c) => [c.id, c.name]));

  await db.$transaction([
    ...seedCategories.map((category, position) => {
      const data = { name: category.name, description: category.description, image: category.image, position };
      return db.category.upsert({ where: { id: category.id }, create: { id: category.id, ...data }, update: data });
    }),
    ...seedProducts.map((product, index) => {
      const data = productRow(product, categoryNames.get(product.category) ?? product.category);
      // Catalogue order ("Destacados") is creation order: one minute apart, in file order.
      const createdAt = new Date(CATALOGUE_EPOCH + index * 60_000);
      return db.product.upsert({
        where: { id: product.id },
        create: { id: product.id, ...data, createdAt },
        update: { ...data, createdAt },
      });
    }),
  ]);
}

function productRow(product: SeedProduct, categoryName: string) {
  return {
    name: product.name,
    price: product.price,
    originalPrice: product.originalPrice ?? null,
    isNew: product.isNew,
    isOnSale: product.isOnSale,
    categoryId: product.category,
    type: product.type,
    age: product.age,
    theme: product.theme,
    interests: product.interests,
    pieces: product.pieces,
    highlight: product.highlight,
    img: product.img,
    imageSecondary: product.imageSecondary ?? null,
    images: product.images.length ? product.images : [product.img],
    stock: product.stock,
    shortDescription: product.shortDescription,
    description: product.description,
    ...productSearchColumns({
      name: product.name,
      theme: product.theme,
      categoryId: product.category,
      categoryName,
      description: product.description,
    }),
  };
}

// ---------------------------------------------------------------------------
// Sample users, reviews and helpful votes
// ---------------------------------------------------------------------------

async function seedSampleUsers(db: PrismaClient): Promise<Map<string, { id: string; user: SampleUser }>> {
  const rows = await db.$transaction(
    sampleUsers.map((user) =>
      db.user.upsert({
        where: { email: user.email },
        create: { email: user.email, name: user.name },
        update: { name: user.name },
        select: { id: true },
      })
    )
  );
  return new Map(sampleUsers.map((user, i) => [user.key, { id: rows[i].id, user }]));
}

interface PlannedReview extends HandwrittenReview {
  createdAt: Date;
}

/** Small deterministic hash, so the generated reviews are the same on every run. */
function hash(text: string): number {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Star ratings for `count` new reviews so that, together with `fixed`, the
 * average rounds to `target`. Picks the smallest review count (from `min`)
 * that hits it exactly; falls back to the closest.
 */
export function planRatings(target: number, fixed: number[], min: number, max: number): number[] {
  let best: { ratings: number[]; error: number } | null = null;
  const fixedSum = fixed.reduce((a, b) => a + b, 0);
  for (let n = Math.max(min, fixed.length); n <= max; n++) {
    const extra = n - fixed.length;
    const wanted = Math.round(target * n) - fixedSum;
    const sum = Math.min(5 * extra, Math.max(extra, wanted));
    const ratings = Array.from({ length: extra }, (_, i) => Math.floor(sum / extra) + (i < sum % extra ? 1 : 0));
    const error = Math.abs(round1((fixedSum + sum) / n) - target);
    if (!best || error < best.error) best = { ratings, error };
    if (error === 0) break;
  }
  return best?.ratings ?? [];
}

function planReviews(): PlannedReview[] {
  const planned: PlannedReview[] = handwrittenReviews.map((r) => ({ ...r, createdAt: new Date(`${r.date}T12:00:00Z`) }));

  seedProducts.forEach((product, index) => {
    const fixed = handwrittenReviews.filter((r) => r.productId === product.id);
    const taken = new Set(fixed.map((r) => r.userKey));
    const authors = sampleUsers.filter((u) => !taken.has(u.key));
    const ratings = planRatings(product.rating, fixed.map((r) => r.rating), 3 + (index % 3), sampleUsers.length);

    ratings.forEach((rating, i) => {
      const author = authors[(index + i) % authors.length];
      const seed = hash(`${product.id}:${author.key}`);
      const templates = reviewTemplates[rating];
      const template = templates[seed % templates.length];
      planned.push({
        productId: product.id,
        userKey: author.key,
        rating,
        title: template.title,
        comment: template.comment.replaceAll("{name}", product.name),
        date: "",
        // Two in three generated reviews come from a past (seeded) order.
        verified: seed % 3 !== 0,
        // Spread over 2025, after the catalogue epoch.
        createdAt: new Date(Date.UTC(2025, 0, 1) + (seed % 300) * DAY + (seed % 86_400) * 1000),
      });
    });
  });

  return planned;
}

async function seedReviews(
  db: PrismaClient,
  users: Map<string, { id: string }>,
  reviews: PlannedReview[]
): Promise<{ reviewIds: string[]; helpfulVotes: number }> {
  const rows = await db.$transaction(
    reviews.map((review) => {
      const userId = users.get(review.userKey)!.id;
      const data = { rating: review.rating, title: review.title, comment: review.comment, createdAt: review.createdAt };
      return db.review.upsert({
        where: { userId_productId: { userId, productId: review.productId } },
        create: { userId, productId: review.productId, ...data },
        update: data,
        select: { id: true, userId: true },
      });
    })
  );

  // 0-4 "útil" votes per review, from sample users other than the author.
  const voters = Array.from(users.values());
  const votes = rows.flatMap((row, i) => {
    const count = hash(`helpful:${reviews[i].productId}:${reviews[i].userKey}`) % 5;
    return voters
      .filter((voter) => voter.id !== row.userId)
      .slice(0, count)
      .map((voter) => ({ userId: voter.id, reviewId: row.id }));
  });
  await db.reviewHelpful.createMany({ data: votes, skipDuplicates: true });

  return { reviewIds: rows.map((r) => r.id), helpfulVotes: votes.length };
}

// ---------------------------------------------------------------------------
// Past orders (what makes a review "compra verificada")
// ---------------------------------------------------------------------------

async function seedOrders(
  db: PrismaClient,
  users: Map<string, { id: string; user: SampleUser }>,
  reviews: PlannedReview[]
): Promise<number> {
  const byId = new Map(seedProducts.map((p) => [p.id, p]));
  let count = 0;

  for (const [key, { id: userId, user }] of users) {
    const verified = reviews.filter((r) => r.userKey === key && r.verified);
    if (verified.length === 0) continue;

    const lines = verified.map((r) => {
      const product = byId.get(r.productId)!;
      return { productId: product.id, name: product.name, unitPrice: product.price, image: product.img, quantity: 1 };
    });
    const totals = orderTotals(lines.map((l) => ({ price: l.unitPrice, quantity: l.quantity })));
    // Ordered two weeks before the user's first review, delivered a week later.
    const firstReview = Math.min(...verified.map((r) => r.createdAt.getTime()));
    const createdAt = new Date(firstReview - 14 * DAY);
    const [firstName, lastName = ""] = user.name.split(" ");

    const order = {
      userId,
      email: user.email,
      status: "DELIVERED" as const,
      firstName,
      lastName,
      phone: "1155550000",
      address: "Av. Siempre Viva 742",
      city: user.city,
      state: user.state,
      zipCode: user.zipCode,
      country: "Argentina",
      subtotal: totals.subtotal,
      shipping: totals.shipping.cost,
      total: totals.total,
      createdAt,
      paidAt: createdAt,
      shippedAt: new Date(createdAt.getTime() + 2 * DAY),
      deliveredAt: new Date(createdAt.getTime() + 7 * DAY),
    };
    const id = `seed-order-${key}`;

    await db.$transaction([
      db.order.upsert({ where: { id }, create: { id, ...order }, update: order }),
      db.orderItem.deleteMany({ where: { orderId: id } }),
      db.orderItem.createMany({ data: lines.map((line) => ({ ...line, orderId: id })) }),
    ]);
    count++;
  }

  return count;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/**
 * Takes the ADMIN role and the password away from the dev admin, if it exists
 * and still has either. The user row stays (it may own data). True if it changed.
 */
async function demoteDevAdmin(db: PrismaClient): Promise<boolean> {
  const { count } = await db.user.updateMany({
    where: { email: DEV_ADMIN.email, OR: [{ role: "ADMIN" }, { passwordHash: { not: null } }] },
    // Bumping the session version also signs out every session it already had.
    data: { role: "USER", passwordHash: null, sessionVersion: { increment: 1 } },
  });
  return count > 0;
}

async function seedAdmin(db: PrismaClient, admin: { email: string; password: string }): Promise<string> {
  const email = admin.email.trim().toLowerCase();
  if (admin.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  const existing = await db.user.findUnique({ where: { email }, select: { passwordHash: true } });
  // Only re-hash when the password changed: bcrypt is slow on purpose.
  const keepHash = existing?.passwordHash && (await verifyPassword(admin.password, existing.passwordHash));
  const passwordHash = keepHash ? existing!.passwordHash! : await hashPassword(admin.password);

  await db.user.upsert({
    where: { email },
    create: { email, name: "Admin", role: "ADMIN", passwordHash },
    // A new password signs out the sessions opened with the old one (src/lib/auth/session.ts).
    update: { role: "ADMIN", passwordHash, ...(keepHash ? {} : { sessionVersion: { increment: 1 } }) },
  });
  return email;
}
