import Link from "next/link";
import Image from "next/image";
import { Clock, Mail, MapPin, Phone, RotateCcw, Shield, Truck } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { phoneHref, socialLinks, type StoreSettings } from "@/lib/settings/defaults";
import { companyLinks, helpLinks, legalLinks, type NavItem } from "@/config/navigation";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { socialIcons } from "@/components/icons/SocialIcons";
import type { Category } from "@/types";

const { commerce } = siteConfig;

const featuresFor = (settings: StoreSettings) => [
  {
    icon: Truck,
    title: "Envío gratis",
    text: `En compras desde ${formatPrice(settings.shipping.freeFrom)}`,
    href: "/envios",
  },
  { icon: RotateCcw, title: `${commerce.returnDays} días para devolver`, text: "Cambios simples y sin costo", href: "/devoluciones" },
  { icon: Shield, title: "Compra segura", text: "Productos originales con garantía", href: "/faq" },
];

const paymentMethods = ["Visa", "Mastercard", "American Express"];

const linkClasses =
  "rounded-sm text-fg-secondary transition-colors duration-fast ease-standard hover:text-fg hover:underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none";

function LinkColumn({ title, links }: { title: string; links: NavItem[] }) {
  const id = `footer-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-4 text-label font-bold tracking-wider text-fg uppercase">
        {title}
      </h2>
      <ul className="space-y-3 text-label font-normal">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={`inline-block ${linkClasses}`}>
              {link.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Site footer. Server Component; only the newsletter form hydrates.
 * Every link resolves to a page (see config/navigation.ts and its test).
 * The free-shipping threshold, contact details and social profiles are the
 * store's settings (/admin/configuracion).
 */
export function Footer({
  categories,
  themes,
  settings,
}: {
  categories: Pick<Category, "id" | "name">[];
  themes: NavItem[];
  settings: StoreSettings;
}) {
  const { contact } = settings;
  const features = featuresFor(settings);
  const social = socialLinks(settings.social);
  const shopLinks: NavItem[] = [
    { name: "Todos los sets", href: "/" },
    ...categories.slice(0, 4).map((c) => ({ name: c.name, href: `/category/${c.id}` })),
    { name: "Ofertas", href: "/#ofertas" },
  ];

  return (
    <footer className="mt-auto border-t border-border bg-bg-subtle text-fg">
      {/* Store promises */}
      <div className="border-b border-border">
        <ul className="container-custom grid grid-cols-1 gap-3 py-6 md:grid-cols-3 md:gap-6">
          {features.map((feature) => (
            <li key={feature.title}>
              <Link
                href={feature.href}
                className="group flex items-center gap-4 rounded-2xl p-3 transition-colors duration-base ease-standard hover:bg-bg-muted focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm transition-[rotate,scale] duration-base ease-emphasized group-hover:scale-110 group-hover:-rotate-6 motion-reduce:group-hover:scale-100 motion-reduce:group-hover:rotate-0"
                >
                  <feature.icon className="size-6" />
                </span>
                <span>
                  <span className="block font-semibold text-fg">{feature.title}</span>
                  <span className="block text-label font-normal text-fg-secondary">{feature.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="container-custom py-12 lg:py-16">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4 lg:grid-cols-6 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <Link
              href="/"
              className="mb-5 inline-block rounded-sm focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
            >
              <Image
                src="/images/lego.png"
                alt={`${siteConfig.name}, inicio`}
                // The logo file is square: matching dimensions avoid a resized-image warning and layout shift.
                width={48}
                height={48}
                // Can be the largest paint on short pages: never lazy.
                loading="eager"
                className="size-12"
              />
            </Link>

            <p className="mb-6 max-w-sm text-label font-normal leading-relaxed text-fg-secondary">
              Tu tienda favorita de LEGO. Construye mundos increíbles pieza a pieza, con productos originales y
              garantía oficial.
            </p>

            <address className="mb-6 space-y-3 text-label font-normal not-italic">
              <a href={`mailto:${contact.email}`} className={`flex w-fit items-center gap-3 ${linkClasses}`}>
                <Mail aria-hidden="true" className="size-4 shrink-0" />
                {contact.email}
              </a>
              <a href={phoneHref(contact.phone)} className={`flex w-fit items-center gap-3 ${linkClasses}`}>
                <Phone aria-hidden="true" className="size-4 shrink-0" />
                {contact.phone}
              </a>
              <p className="flex items-center gap-3 text-fg-secondary">
                <MapPin aria-hidden="true" className="size-4 shrink-0" />
                {contact.address}
              </p>
              <p className="flex items-center gap-3 text-fg-secondary">
                <Clock aria-hidden="true" className="size-4 shrink-0" />
                {contact.hours}
              </p>
            </address>

            {social.length > 0 ? (
              <ul className="flex gap-2" aria-label="LEGO en redes sociales">
                {social.map((profile) => {
                  const Icon = socialIcons[profile.name];
                  return (
                    <li key={profile.name}>
                      <a
                        href={profile.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${profile.name} (se abre en una pestaña nueva)`}
                        title={profile.name}
                        className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-fg-secondary transition-[color,background-color,border-color,translate] duration-base ease-standard hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-on-primary focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none motion-reduce:hover:translate-y-0"
                      >
                        <Icon className="size-5" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <nav aria-label="Pie de página" className="col-span-2 grid grid-cols-2 gap-x-8 gap-y-10 md:col-span-4 md:grid-cols-4 lg:gap-12">
            <LinkColumn title="Comprar" links={shopLinks} />
            {themes.length > 0 ? <LinkColumn title="Temas" links={themes} /> : null}
            <LinkColumn title="Ayuda" links={helpLinks} />
            <LinkColumn title="La tienda" links={[...companyLinks, ...legalLinks]} />
          </nav>
        </div>

        {/* Newsletter */}
        <section
          aria-labelledby="footer-newsletter-title"
          className="mt-12 flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 shadow-card lg:flex-row lg:items-center lg:justify-between lg:p-8"
        >
          <div>
            <h2 id="footer-newsletter-title" className="text-title text-fg">
              Suscríbete al newsletter
            </h2>
            <p className="mt-1 text-label font-normal text-fg-secondary">
              Ofertas exclusivas y novedades en tu correo. Te regalamos 10% en tu primera compra.
            </p>
          </div>
          <NewsletterForm labelledBy="footer-newsletter-title" />
        </section>
      </div>

      {/* Bottom bar; also holds the room reserved for the compare bar (globals.css) */}
      <div data-footer-bottom className="border-t border-border bg-bg-muted">
        <div className="container-custom flex flex-col items-center justify-between gap-4 py-6 text-center md:flex-row md:text-left">
          <div className="text-label font-normal text-fg-secondary">
            <p>© {new Date().getFullYear()} {siteConfig.name}. Proyecto de portafolio.</p>
            <p className="text-caption text-fg-muted">LEGO® es una marca de The LEGO Group, que no patrocina esta tienda.</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-caption text-fg-secondary">Medios de pago:</span>
            <ul className="flex flex-wrap gap-2" aria-label="Medios de pago">
              {paymentMethods.map((method) => (
                <li
                  key={method}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-caption font-medium text-fg-secondary"
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
