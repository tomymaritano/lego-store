import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, cardVariants } from "@/components/ui";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { cn, pluralize } from "@/lib/utils";
import type { Category } from "@/types";
import { SectionHeader } from "./SectionHeader";

/** Flagship collections get a picture card; the rest are listed as chips. */
const FEATURED = 3;

export function CategoriesSection({ categories }: { categories: Category[] }) {
  const withProducts = categories.filter((category) => category.productCount > 0);
  const featured = withProducts.slice(0, FEATURED);
  const more = withProducts.slice(FEATURED);

  return (
    <section aria-labelledby="categories-title" className="bg-bg-subtle py-16 md:py-20">
      <div className="container-custom">
        <SectionHeader
          id="categories-title"
          eyebrow="Colecciones"
          title="Explora por categoría"
          description="Encuentra tu colección perfecta"
        />

        <Stagger as="ul" inView className="grid gap-6 md:grid-cols-3">
          {featured.map((category) => (
            <StaggerItem as="li" key={category.id}>
              <Link
                href={`/category/${category.id}`}
                className={cn(
                  cardVariants({ interactive: true }),
                  "group block overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                )}
              >
                {/* Same media area as the product cards; opaque white-background covers blend into it (photo-blend). */}
                <div className="relative h-48 overflow-hidden bg-bg-subtle">
                  <Image
                    src={category.image}
                    alt=""
                    fill
                    sizes="(max-width: 767px) calc(100vw - 2rem), 400px"
                    className="photo-blend object-contain p-5 transition-[scale] duration-slow ease-emphasized group-hover:scale-110 motion-reduce:group-hover:scale-100"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-title">{category.name}</h3>
                    <span className="text-caption text-fg-muted">{pluralize(category.productCount, "set")}</span>
                  </div>
                  <p className="mt-1 text-label font-normal text-fg-muted">{category.description}</p>
                  <span className="mt-4 flex items-center text-label text-info">
                    Ver colección
                    <ArrowRight
                      aria-hidden="true"
                      className="ml-2 size-4 transition-[translate] duration-base ease-standard group-hover:translate-x-1.5 motion-reduce:group-hover:translate-x-0"
                    />
                  </span>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>

        {more.length > 0 ? (
          <nav aria-label="Más categorías" className="mt-8">
            <Stagger as="ul" inView className="flex flex-wrap gap-2">
              {more.map((category) => (
                <StaggerItem as="li" effect="pop" key={category.id}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full bg-surface"
                    render={<Link href={`/category/${category.id}`} />}
                  >
                    {category.name}
                    <span className="text-caption font-normal text-fg-muted">
                      {category.productCount}
                      <span className="sr-only">{category.productCount === 1 ? " set" : " sets"}</span>
                    </span>
                  </Button>
                </StaggerItem>
              ))}
            </Stagger>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
