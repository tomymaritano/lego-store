import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Award, Blocks, RotateCcw, Shield, Sparkles, Truck, Users } from "lucide-react";
import { getCategoryById, getProductById, getProducts, getRelatedProducts, getReviewPage } from "@/lib/api";
import { DEFAULT_REVIEW_SORT, REVIEW_PAGE_SIZE } from "@/lib/reviews/sorts";
import type { ReviewPage } from "@/types";
import { formatPrice } from "@/lib/utils";
import { defaultOgImage, pageMetadata } from "@/lib/metadata";
import { productImages, productJsonLd, serializeJsonLd } from "@/lib/structuredData";
import { siteConfig } from "@/config/site";
import { Badge, Breadcrumbs, Price, Rating } from "@/components/ui";
import { ProductDetailsTabs } from "@/components/product/ProductDetailsTabs";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { RecentlyViewed, TrackRecentlyViewed } from "@/components/product/RecentlyViewed";
import { ReviewsLink } from "@/components/product/ReviewsLink";

interface ItemPageProps {
  params: Promise<{ productId: string }>;
}

export async function generateStaticParams() {
  return (await getProducts()).map((product) => ({ productId: product.id }));
}

export async function generateMetadata({ params }: ItemPageProps): Promise<Metadata> {
  const product = await getProductById((await params).productId);
  if (!product) return { title: "Producto no encontrado", robots: { index: false } };

  const description = product.shortDescription || product.description.slice(0, 160);
  // Social cards need a raster picture: sets without a real one use the site-wide card.
  const [image] = productImages(product);
  return pageMetadata({
    title: product.name,
    description,
    path: `/item/${product.id}`,
    images: image ? [{ url: image, width: 800, height: 800, alt: product.name }] : [defaultOgImage],
  });
}

const emptyReviewPage: ReviewPage = {
  items: [],
  summary: { average: 0, count: 0, distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 })) },
  sort: DEFAULT_REVIEW_SORT,
  page: 1,
  limit: REVIEW_PAGE_SIZE,
  totalPages: 0,
  hasMore: false,
};

const perks = [
  { icon: Truck, title: "Envío gratis", detail: `Desde ${formatPrice(siteConfig.commerce.freeShippingThreshold)}` },
  { icon: Shield, title: "Garantía", detail: "Producto original" },
  { icon: RotateCcw, title: "Devolución", detail: `${siteConfig.commerce.returnDays} días` },
];

/**
 * Product page (Server Component, statically generated per product). Unknown
 * ids get a real 404 from src/proxy.ts before rendering; notFound() here is
 * the fallback. Reviews are read from the database here (tagged with the
 * product, so a review write regenerates the page). Client islands: gallery,
 * buy box, details tabs (reviews),
 * related grid and the recently viewed strip.
 */
export default async function ItemPage({ params }: ItemPageProps) {
  const { productId } = await params;
  const product = await getProductById(productId);
  if (!product) notFound();

  const [category, related, reviewPage] = await Promise.all([
    getCategoryById(product.category),
    getRelatedProducts(product.id, 4),
    getReviewPage(product.id, DEFAULT_REVIEW_SORT),
  ]);
  const reviews = reviewPage ?? emptyReviewPage;
  const categoryName = category?.name ?? product.category;

  const facts = [
    { icon: Users, label: "Edad recomendada", value: product.age },
    { icon: Blocks, label: "Piezas", value: product.pieces },
    { icon: Sparkles, label: "Tema", value: product.theme },
    { icon: Award, label: "Colección", value: product.highlight },
  ];

  const specs = [
    { label: "Referencia", value: `#${product.id}` },
    { label: "Categoría", value: categoryName },
    { label: "Tema", value: product.theme },
    { label: "Tipo", value: product.type },
    { label: "Edad", value: product.age },
    { label: "Piezas", value: product.pieces },
    { label: "Intereses", value: product.interests.join(", ") || "—" },
    { label: "Disponibilidad", value: product.stock > 0 ? `${product.stock} unidades` : "Agotado" },
  ];

  return (
    <>
      <TrackRecentlyViewed productId={product.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd(product, categoryName)) }}
      />

      <div className="container-custom space-y-12 py-6 lg:space-y-16">
        <div>
          <Breadcrumbs items={[{ label: categoryName, href: `/category/${product.category}` }, { label: product.name }]} />

          <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <ProductGallery product={product} />
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-label tracking-wider text-info uppercase">{product.theme}</p>
                  <Badge variant="neutral">{product.highlight}</Badge>
                </div>
                <h1 className="text-headline text-balance">{product.name}</h1>
                {/* Rating, link and tab all come from the same reviews in the database (one cache tag: a review write refreshes them together). */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label font-normal">
                  <Rating value={product.rating} unrated={product.reviewCount === 0} showValue />
                  {product.reviewCount > 0 ? <span className="text-fg-muted">valoración general</span> : null}
                  <span aria-hidden="true" className="text-fg-muted">
                    ·
                  </span>
                  <ReviewsLink count={reviews.summary.count} />
                </div>
              </div>

              <Price
                value={product.price}
                originalValue={product.isOnSale ? product.originalPrice : undefined}
                showDiscount
                size="lg"
              />

              <p className="text-title font-normal leading-relaxed text-fg-secondary">{product.shortDescription}</p>

              <div className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
                <ProductPurchase product={product} />
              </div>

              <ul className="grid grid-cols-3 gap-3">
                {perks.map(({ icon: Icon, title, detail }) => (
                  <li key={title} className="flex flex-col items-center rounded-xl bg-bg-subtle p-3 text-center">
                    <Icon aria-hidden="true" className="mb-2 size-6 text-info" />
                    <span className="text-caption font-semibold text-fg">{title}</span>
                    <span className="text-caption text-fg-muted">{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <ProductDetailsTabs
          productId={product.id}
          reviews={reviews}
          description={
            <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <h2 className="sr-only">Descripción</h2>
                <p className="max-w-prose text-body leading-relaxed text-fg-secondary">{product.description}</p>
              </div>
              <ul className="grid grid-cols-2 gap-3 self-start" aria-label="Lo esencial">
                {facts.map(({ icon: Icon, label, value }) => (
                  <li key={label} className="flex flex-col gap-1 rounded-xl border border-border bg-bg-subtle p-4">
                    <Icon aria-hidden="true" className="size-5 text-info" />
                    <span className="text-caption text-fg-muted">{label}</span>
                    <span className="text-label text-fg">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
          }
          specs={
            <div>
              <h2 className="sr-only">Especificaciones</h2>
              <dl className="grid grid-cols-1 gap-x-10 text-label font-normal sm:grid-cols-2">
                {specs.map((spec) => (
                  <div key={spec.label} className="flex justify-between gap-4 border-b border-border py-3">
                    <dt className="text-fg-muted">{spec.label}</dt>
                    <dd className="text-right font-medium text-fg">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          }
        />
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="border-t border-border py-12">
          <div className="container-custom">
            <h2 id="related-title" className="mb-6 text-heading">
              También te puede gustar
            </h2>
            <ProductGrid products={related} reveal="in-view" label="Productos relacionados" />
          </div>
        </section>
      )}

      <RecentlyViewed excludeId={product.id} />
    </>
  );
}
