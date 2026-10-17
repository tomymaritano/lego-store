import Image from "next/image";
import Link from "next/link";
import { ArrowRight, RotateCcw, Shield, Star, Truck } from "lucide-react";
import { getCategories, getPaginatedProducts, getSaleProducts } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { Badge, Button, Price } from "@/components/ui";
import { ProductImage, ProductList } from "@/components/product";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { NewsletterForm } from "@/components/forms";

const features = [
  {
    icon: Truck,
    title: "Envío gratis",
    description: `En compras desde ${formatPrice(siteConfig.commerce.freeShippingThreshold)}`,
  },
  { icon: Shield, title: "Pago seguro", description: "100% protegido" },
  { icon: RotateCcw, title: "Devoluciones", description: "30 días de garantía" },
  { icon: Star, title: "Calidad LEGO", description: "Productos originales" },
];

const FEATURED_CATEGORIES = 3;

/** LEGO stud pattern for the hero, drawn with the current text colour. */
const studs =
  "bg-[radial-gradient(circle,currentColor_3px,transparent_3.5px)] bg-size-[36px_36px] opacity-[0.06]";

export default async function HomePage() {
  const [allCategories, saleProducts, firstPage] = await Promise.all([
    getCategories(),
    getSaleProducts(4),
    getPaginatedProducts({ limit: 12 }),
  ]);
  // The three flagship collections; the navbar lists every category.
  const categories = allCategories.slice(0, FEATURED_CATEGORIES);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-linear-to-br from-primary to-primary-hover text-on-primary">
        <div aria-hidden="true" className={`absolute inset-0 ${studs}`} />

        <div className="container-custom relative z-10">
          <Stagger className="grid min-h-[500px] items-center gap-8 py-12 lg:grid-cols-2 lg:py-20" stagger={0.08}>
            <StaggerItem>
              <Badge variant="sale" className="mb-4 px-4 py-1 text-sm">
                Nueva colección
              </Badge>
              <h1 className="text-display text-on-primary">
                Construye tu{" "}
                <span className="mt-2 inline-block rounded-2xl bg-sale px-4 pb-1 text-on-sale">universo LEGO</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg md:text-xl">
                Descubre sets exclusivos de Star Wars, Marvel y más. Cada pieza cuenta una historia.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button size="lg" variant="secondary" className="shadow-lg" render={<Link href="#products" />}>
                  Explorar productos
                  <ArrowRight aria-hidden="true" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-on-primary text-on-primary hover:bg-on-primary hover:text-primary"
                  render={<Link href="/category/helmet" />}
                >
                  Ver helmets
                </Button>
              </div>
            </StaggerItem>

            <StaggerItem effect="pop" className="relative hidden lg:block">
              <div className="relative mx-auto aspect-square w-full max-w-lg">
                <div aria-hidden="true" className="absolute inset-8 rounded-full bg-surface/30 blur-3xl" />
                <Image
                  src="https://www.lego.com/cdn/cs/set/assets/bltde62e4576a817dd4/75349.png"
                  alt="Casco LEGO de Captain Rex"
                  fill
                  sizes="(max-width: 1024px) 0px, 512px"
                  className="object-contain drop-shadow-2xl transition-[scale] duration-slow ease-emphasized hover:scale-105"
                  preload
                />
              </div>
            </StaggerItem>
          </Stagger>
        </div>

        {/* Wave divider into the page background */}
        <div aria-hidden="true" className="absolute right-0 bottom-0 left-0 text-bg">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="block w-full">
            <path
              d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </section>

      {/* Perks */}
      <section aria-label="Beneficios" className="border-b border-border bg-bg py-8">
        <div className="container-custom">
          <Stagger as="ul" className="grid grid-cols-2 gap-6 md:grid-cols-4" stagger={0.06} delay={0.1}>
            {features.map((feature) => (
              <StaggerItem as="li" key={feature.title} className="flex items-center gap-3">
                <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
                  <feature.icon className="size-6" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-fg">{feature.title}</p>
                  <p className="text-caption text-fg-muted">{feature.description}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Categories */}
      <section aria-labelledby="categories-title" className="bg-bg-subtle py-16">
        <div className="container-custom">
          <div className="mb-12 text-center">
            <h2 id="categories-title">Explora por categoría</h2>
            <p className="mt-2 text-fg-secondary">Encuentra tu colección perfecta</p>
          </div>

          <Stagger as="ul" inView className="grid gap-6 md:grid-cols-3">
            {categories.map((category) => (
              <StaggerItem as="li" key={category.id}>
                <Link
                  href={`/category/${category.id}`}
                  className="group block overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-[translate,box-shadow] duration-base ease-standard hover:-translate-y-1 hover:shadow-xl motion-reduce:hover:translate-y-0"
                >
                  <div className="relative h-48 bg-bg-muted">
                    <Image
                      src={category.image}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-contain p-6 transition-[scale] duration-slow ease-emphasized group-hover:scale-110"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-title transition-colors group-hover:text-info">{category.name}</h3>
                      <span className="text-caption text-fg-muted">{category.productCount} sets</span>
                    </div>
                    <p className="mt-1 text-sm text-fg-muted">{category.description}</p>
                    <span className="mt-4 flex items-center text-sm font-semibold text-info">
                      Ver colección
                      <ArrowRight
                        aria-hidden="true"
                        className="ml-2 size-4 transition-[translate] duration-base ease-standard group-hover:translate-x-1.5"
                      />
                    </span>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Sale */}
      {saleProducts.length > 0 && (
        <section id="ofertas" aria-labelledby="sale-title" className="scroll-mt-20 bg-bg-muted py-16">
          <div className="container-custom">
            <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold tracking-wider text-sale uppercase">Destacados</p>
                <h2 id="sale-title" className="mt-2">
                  Ofertas especiales
                </h2>
              </div>
              <Button variant="link" className="mt-4 md:mt-0" render={<Link href="#products" />}>
                Ver todo el catálogo
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>

            <Stagger as="ul" inView stagger={0.05} className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
              {saleProducts.map((product) => (
                <StaggerItem as="li" effect="pop" key={product.id}>
                  <Link
                    href={`/item/${product.id}`}
                    className="group block overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-[translate,box-shadow] duration-base ease-standard hover:-translate-y-1 hover:shadow-lg motion-reduce:hover:translate-y-0"
                  >
                    <div className="relative aspect-square bg-bg-subtle">
                      <Badge variant="sale" className="absolute top-3 left-3 z-10">
                        Oferta
                      </Badge>
                      <ProductImage
                        src={product.img}
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="object-contain p-4 transition-[scale] duration-slow ease-emphasized group-hover:scale-105"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-1 text-sm font-semibold text-fg">{product.name}</h3>
                      <Price value={product.price} originalValue={product.originalPrice} size="sm" className="mt-2" />
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* Catalogue */}
      <section id="products" aria-labelledby="products-title" className="scroll-mt-20 bg-bg py-16">
        <div className="container-custom">
          <div className="mb-10">
            <p className="text-sm font-semibold tracking-wider text-info uppercase">Catálogo</p>
            <h2 id="products-title" className="mt-2">
              Todos los productos
            </h2>
            <p className="mt-2 text-fg-secondary">{firstPage.total} sets disponibles</p>
          </div>

          <ProductList initialPage={firstPage} />
        </div>
      </section>

      {/* Newsletter */}
      <section aria-labelledby="newsletter-title" className="bg-info py-16 text-on-info">
        <div className="container-custom">
          <div className="flex flex-col items-center justify-between gap-8 lg:flex-row">
            <div className="text-center lg:text-left">
              <h2 id="newsletter-title" className="text-on-info">
                ¿Nuevo en LEGO?
              </h2>
              <p className="mt-2 text-lg">Suscríbete y obtén 10% de descuento en tu primera compra</p>
            </div>
            <div className="w-full rounded-2xl bg-surface p-4 text-fg shadow-lg lg:w-auto">
              <NewsletterForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
