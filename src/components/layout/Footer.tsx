import Link from "next/link";
import Image from "next/image";
import { CreditCard, Heart, Mail, MapPin, Phone, Shield, Truck } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { FacebookIcon, InstagramIcon, TwitterIcon, YoutubeIcon } from "@/components/icons/SocialIcons";

const footerLinks = [
  {
    title: "Comprar",
    links: [
      { name: "Todos los sets", href: "/" },
      { name: "Helmets", href: "/category/helmet" },
      { name: "Brickheadz", href: "/category/brickheadz" },
      { name: "Vehículos", href: "/category/cars" },
      { name: "Ofertas", href: "/?sale=true" },
    ],
  },
  {
    title: "Temas",
    links: [
      { name: "Star Wars", href: "/?theme=Star+Wars" },
      { name: "Marvel", href: "/?theme=Marvel" },
      { name: "Disney", href: "/?theme=Disney" },
      { name: "Harry Potter", href: "/?theme=Harry+Potter" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { name: "Preguntas frecuentes", href: "/faq" },
      { name: "Envíos y entregas", href: "/shipping" },
      { name: "Devoluciones", href: "/returns" },
      { name: "Contacto", href: "/contact" },
    ],
  },
  {
    title: "Nosotros",
    links: [
      { name: "Sobre LEGO Store", href: "/about" },
      { name: "Blog", href: "/blog" },
      { name: "Trabaja con nosotros", href: "/careers" },
      { name: "Prensa", href: "/press" },
    ],
  },
];

const socialLinks = [
  { name: "Facebook", icon: FacebookIcon, href: "#" },
  { name: "Twitter", icon: TwitterIcon, href: "#" },
  { name: "Instagram", icon: InstagramIcon, href: "#" },
  { name: "YouTube", icon: YoutubeIcon, href: "#" },
];

const legalLinks = [
  { name: "Privacidad", href: "/privacy" },
  { name: "Términos", href: "/terms" },
  { name: "Cookies", href: "/cookies" },
  { name: "Accesibilidad", href: "/accessibility" },
];

const paymentMethods = ["Visa", "Mastercard", "Amex", "PayPal"];

const features = [
  { icon: Truck, text: `Envío gratis desde ${formatPrice(siteConfig.commerce.freeShippingThreshold)}` },
  { icon: Shield, text: "Compra segura" },
  { icon: CreditCard, text: "MSI disponibles" },
];

const linkClasses =
  "rounded-sm text-fg-secondary transition-colors duration-fast ease-standard hover:text-fg focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none";

/** Site footer. Server Component; only the stagger wrapper and the newsletter form hydrate. */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-bg-subtle text-fg">
      {/* Features */}
      <div className="border-b border-border">
        <div className="container-custom py-6">
          <Stagger as="ul" inView className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <StaggerItem as="li" key={feature.text} className="flex items-center justify-center gap-3 py-2">
                <span
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-full bg-primary text-on-primary"
                >
                  <feature.icon className="size-5" />
                </span>
                <span className="text-sm font-medium text-fg-secondary">{feature.text}</span>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>

      <div className="container-custom py-12 lg:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <Link href="/" className="mb-6 inline-block rounded-sm focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none">
              <Image src="/images/lego.png" alt="LEGO Store, inicio" width={120} height={60} className="h-12 w-auto" />
            </Link>

            <p className="mb-6 max-w-sm text-sm leading-relaxed text-fg-secondary">
              Tu tienda favorita de LEGO. Construye mundos increíbles pieza a pieza. Productos originales con garantía
              oficial.
            </p>

            <address className="mb-6 space-y-3 text-sm not-italic">
              <a href="mailto:hola@legostore.com" className={`flex w-fit items-center gap-3 ${linkClasses}`}>
                <Mail aria-hidden="true" className="size-4" />
                hola@legostore.com
              </a>
              <a href="tel:+525512345678" className={`flex w-fit items-center gap-3 ${linkClasses}`}>
                <Phone aria-hidden="true" className="size-4" />
                +52 55 1234 5678
              </a>
              <p className="flex items-center gap-3 text-fg-secondary">
                <MapPin aria-hidden="true" className="size-4" />
                Ciudad de México, México
              </p>
            </address>

            <ul className="flex gap-2" aria-label="Redes sociales">
              {socialLinks.map((social) => (
                <li key={social.name}>
                  <a
                    href={social.href}
                    aria-label={social.name}
                    className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-fg-secondary transition-[color,background-color,scale] duration-base ease-standard hover:bg-primary hover:text-on-primary focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none motion-safe:hover:scale-110"
                  >
                    <social.icon className="size-5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Link columns */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h2 id={`footer-${section.title}`} className="mb-4 text-sm font-bold tracking-wider text-fg uppercase">
                {section.title}
              </h2>
              <ul className="space-y-3 text-sm">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} prefetch={false} className={`inline-block ${linkClasses}`}>
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div className="mt-12 border-t border-border pt-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="mb-1 text-lg font-bold text-fg">Suscríbete al newsletter</h2>
              <p className="text-sm text-fg-secondary">Recibe ofertas exclusivas y novedades directamente en tu correo.</p>
            </div>
            <NewsletterForm />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border bg-bg-muted">
        <div className="container-custom flex flex-col items-center justify-between gap-4 py-6 md:flex-row">
          <p className="flex items-center gap-2 text-sm text-fg-secondary">
            <span>© {new Date().getFullYear()} LEGO Store.</span>
            <span aria-hidden="true" className="hidden sm:inline">
              •
            </span>
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              Hecho con
              <Heart aria-hidden="true" className="size-4 fill-sale text-sale" />
              <span className="sr-only">amor</span>
              para portafolio
            </span>
          </p>

          <ul className="flex flex-wrap justify-center gap-4 text-sm" aria-label="Legal">
            {legalLinks.map((link) => (
              <li key={link.name}>
                <Link href={link.href} prefetch={false} className={linkClasses}>
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <span className="text-caption text-fg-secondary">Métodos de pago:</span>
            <ul className="flex gap-2">
              {paymentMethods.map((method) => (
                <li
                  key={method}
                  className="rounded-sm border border-border bg-surface px-2 py-1 text-caption font-medium text-fg-secondary"
                >
                  {method}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
