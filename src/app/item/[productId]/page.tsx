import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RotateCcw, Shield, Truck } from "lucide-react";
import { getCategoryById, getProductById, getProducts, getRelatedProducts } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { Breadcrumbs, Price, Rating } from "@/components/ui";
import {
  ProductCard,
  ProductGallery,
  ProductPurchase,
  ProductReviews,
  RecentlyViewed,
  TrackRecentlyViewed,
} from "@/components/product";

interface ItemPageProps {
  params: Promise<{ productId: string }>;
}

export async function generateStaticParams() {
  return (await getProducts()).map((product) => ({ productId: product.id }));
}

export async function generateMetadata({ params }: ItemPageProps): Promise<Metadata> {
  const product = await getProductById((await params).productId);
  if (!product) return { title: "Producto no encontrado" };

  const title = `${product.name} | ${siteConfig.name}`;
  const description = product.shortDescription || product.description.slice(0, 160);
  return {
    title: product.name,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: product.img, width: 800, height: 800, alt: product.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [product.img] },
  };
}

const perks = [
  { icon: Truck, title: "Envío gratis", detail: `Desde ${formatPrice(siteConfig.commerce.freeShippingThreshold)}` },
  { icon: Shield, title: "Garantía", detail: "Producto original" },
  { icon: RotateCcw, title: "Devolución", detail: "30 días" },
];

export default async function ItemPage({ params }: ItemPageProps) {
  const { productId } = await params;
  const product = await getProductById(productId);
  if (!product) notFound();

  const [category, related] = await Promise.all([
    getCategoryById(product.category),
    getRelatedProducts(product.id, 4),
  ]);

  const specs = [
    { label: "Categoría", value: category?.name ?? product.category },
    { label: "Tema", value: product.theme },
    { label: "Edad", value: product.age },
    { label: "Piezas", value: product.pieces },
  ];

  return (
    <>
      <TrackRecentlyViewed productId={product.id} />

      <div className="container-custom py-6">
        <Breadcrumbs
          items={[{ label: category?.name ?? product.category, href: `/category/${product.category}` }, { label: product.name }]}
        />

        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          <ProductGallery product={product} />

          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold tracking-wider text-info uppercase">{product.theme}</p>
              <h1 className="text-3xl lg:text-4xl">{product.name}</h1>
              <Rating value={product.rating} count={Math.floor(product.rating * 20)} showValue size="lg" />
            </div>

            <Price
              value={product.price}
              originalValue={product.isOnSale ? product.originalPrice : undefined}
              showDiscount
              size="lg"
            />

            <p className="text-lg leading-relaxed text-fg-secondary">{product.description}</p>

            <p className="flex items-center gap-2 font-medium">
              <span
                aria-hidden="true"
                className={product.stock > 0 ? "size-2.5 rounded-full bg-success" : "size-2.5 rounded-full bg-danger"}
              />
              <span className={product.stock > 0 ? "text-success" : "text-danger"}>
                {product.stock > 0 ? `${product.stock} unidades disponibles` : "Agotado"}
              </span>
            </p>

            <ProductPurchase product={product} />

            <ul className="grid grid-cols-3 gap-3 pt-2">
              {perks.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex flex-col items-center rounded-xl bg-bg-subtle p-3 text-center">
                  <Icon aria-hidden="true" className="mb-2 size-6 text-info" />
                  <span className="text-caption font-semibold text-fg">{title}</span>
                  <span className="text-caption text-fg-muted">{detail}</span>
                </li>
              ))}
            </ul>

            <section aria-labelledby="specs-title" className="space-y-4 border-t border-border pt-6">
              <h2 id="specs-title" className="text-title">
                Especificaciones
              </h2>
              <dl className="grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-2">
                {specs.map((spec) => (
                  <div key={spec.label} className="flex justify-between border-b border-border py-2">
                    <dt className="text-fg-muted">{spec.label}</dt>
                    <dd className="font-medium text-fg">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>
      </div>

      <ProductReviews productId={product.id} />

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="py-12">
          <div className="container-custom">
            <h2 id="related-title" className="mb-6 text-title">
              También te puede gustar
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
              {related.map((item) => (
                <li key={item.id}>
                  <ProductCard product={item} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <RecentlyViewed excludeId={product.id} />
    </>
  );
}
