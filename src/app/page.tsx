"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Truck, Shield, RotateCcw, Star } from "lucide-react";
import { products } from "@/data/products";
import { ProductList } from "@/components/product";
import { ProductListSkeleton, Button } from "@/components/ui";
import { PageTransition } from "@/components/layout";

const categories = [
  {
    name: "Helmets",
    href: "/category/helmet",
    image: "https://www.lego.com/cdn/cs/set/assets/bltde62e4576a817dd4/75349.png",
    description: "Colección de cascos icónicos",
    color: "from-red-500 to-orange-500",
  },
  {
    name: "Brickheadz",
    href: "/category/brickheadz",
    image: "https://www.lego.com/cdn/cs/set/assets/bltc971a95594361e17/40624.png",
    description: "Figuras coleccionables",
    color: "from-blue-500 to-cyan-500",
  },
  {
    name: "Vehículos",
    href: "/category/cars",
    image: "https://www.lego.com/cdn/cs/set/assets/blt38e8915698af2d5f/75308.jpg",
    description: "Autos y naves épicas",
    color: "from-purple-500 to-pink-500",
  },
];

const features = [
  { icon: Truck, title: "Envío Gratis", description: "En compras +$5000" },
  { icon: Shield, title: "Pago Seguro", description: "100% protegido" },
  { icon: RotateCcw, title: "Devoluciones", description: "30 días garantía" },
  { icon: Star, title: "Calidad LEGO", description: "Productos originales" },
];

const featuredProducts = products.filter((p) => p.isNew || p.isOnSale).slice(0, 4);

export default function HomePage() {
  return (
    <PageTransition className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-lego-yellow via-brand-300 to-brand-400 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iNCIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />

        <div className="container-custom relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 items-center min-h-[500px] py-12 lg:py-20">
            {/* Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block bg-lego-red text-white text-sm font-bold px-4 py-1 rounded-full mb-4">
                NUEVA COLECCIÓN 2024
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-lego-black leading-tight">
                Construye tu
                <span className="block text-lego-red">universo LEGO</span>
              </h1>
              <p className="text-lg md:text-xl text-lego-black/70 mt-6 max-w-lg">
                Descubre sets exclusivos de Star Wars, Marvel y más.
                Cada pieza cuenta una historia.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="#products">
                  <Button size="lg" className="shadow-lg hover:shadow-xl">
                    Explorar Productos
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/category/helmet">
                  <Button variant="outline" size="lg">
                    Ver Helmets
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Hero Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="relative w-full aspect-square max-w-lg mx-auto">
                <div className="absolute inset-0 bg-white/20 rounded-full blur-3xl" />
                <Image
                  src="https://www.lego.com/cdn/cs/set/assets/bltde62e4576a817dd4/75349.png"
                  alt="LEGO Captain Rex Helmet"
                  fill
                  className="object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                  priority
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0 text-background-primary">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </section>

      {/* Features Bar */}
      <section className="bg-background-primary py-8 border-b border-border">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-12 h-12 bg-lego-yellow/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-6 h-6 text-foreground-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground-primary">{feature.title}</h3>
                  <p className="text-xs text-foreground-muted">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-background-secondary">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground-primary">Explora por Categoría</h2>
            <p className="text-foreground-secondary mt-2">Encuentra tu colección perfecta</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {categories.map((cat, index) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={cat.href}>
                  <div className="group relative bg-surface rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-border">
                    <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-0 group-hover:opacity-10 transition-opacity`} />

                    <div className="relative h-48 bg-background-tertiary">
                      <Image
                        src={cat.image}
                        alt={cat.name}
                        fill
                        className="object-contain p-6 group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>

                    <div className="p-6">
                      <h3 className="text-xl font-bold text-foreground-primary group-hover:text-lego-blue transition-colors">
                        {cat.name}
                      </h3>
                      <p className="text-foreground-muted text-sm mt-1">{cat.description}</p>
                      <div className="mt-4 flex items-center text-lego-blue font-medium text-sm">
                        Ver colección
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products Highlight */}
      {featuredProducts.length > 0 && (
        <section className="py-16 bg-lego-black text-white">
          <div className="container-custom">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10">
              <div>
                <span className="text-lego-yellow font-semibold text-sm uppercase tracking-wider">
                  Destacados
                </span>
                <h2 className="text-3xl md:text-4xl font-bold mt-2">
                  Ofertas Especiales
                </h2>
              </div>
              <Link href="/" className="text-lego-yellow hover:underline mt-4 md:mt-0">
                Ver todas las ofertas →
              </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {featuredProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link href={`/item/${product.id}`}>
                    <div className="group bg-surface rounded-xl overflow-hidden border border-border/50">
                      <div className="relative aspect-square bg-background-secondary">
                        {product.isOnSale && (
                          <span className="absolute top-3 left-3 z-10 bg-lego-red text-white text-xs font-bold px-2 py-1 rounded">
                            OFERTA
                          </span>
                        )}
                        <Image
                          src={product.img}
                          alt={product.name}
                          fill
                          className="object-contain p-4 group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-foreground-primary text-sm line-clamp-1">
                          {product.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="font-bold text-lego-red">
                            ${product.price.toLocaleString()}
                          </span>
                          {product.originalPrice && (
                            <span className="text-xs text-foreground-muted line-through">
                              ${product.originalPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All Products */}
      <section id="products" className="py-16 bg-background-primary">
        <div className="container-custom">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10">
            <div>
              <span className="text-lego-blue font-semibold text-sm uppercase tracking-wider">
                Catálogo
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mt-2 text-foreground-primary">
                Todos los Productos
              </h2>
              <p className="text-foreground-secondary mt-2">{products.length} sets disponibles</p>
            </div>
          </div>

          <Suspense fallback={<ProductListSkeleton count={6} />}>
            <ProductList products={products} />
          </Suspense>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-gradient-to-r from-lego-blue to-blue-600">
        <div className="container-custom">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="text-white text-center lg:text-left">
              <h2 className="text-3xl md:text-4xl font-bold">
                ¿Nuevo en LEGO?
              </h2>
              <p className="text-white/80 mt-2 text-lg">
                Suscríbete y obtén 10% de descuento en tu primera compra
              </p>
            </div>
            <form className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <input
                type="email"
                placeholder="tu@email.com"
                className="px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 min-w-[280px]"
              />
              <Button className="bg-white text-lego-blue hover:bg-gray-100 whitespace-nowrap">
                Suscribirse
              </Button>
            </form>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
