import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { contentMetadata, loadContentPage } from "@/lib/content/page";
import { phoneHref } from "@/lib/settings/defaults";
import { ContactForm } from "@/components/forms";
import { ContentBlocks, ContentHeader } from "@/components/content/ContentBlocks";

export const generateMetadata = () => contentMetadata("contacto");

/** /contacto: the admin's introduction (/admin/contenido), the form and the store's channels (/admin/configuracion). */
export default async function ContactPage() {
  const { doc, settings } = await loadContentPage("contacto");
  const { contact } = settings;
  const channels = [
    { icon: Mail, label: "Email", value: contact.email, href: `mailto:${contact.email}` },
    { icon: Phone, label: "Teléfono", value: contact.phone, href: phoneHref(contact.phone) },
    { icon: Clock, label: "Horario de atención", value: contact.hours },
    { icon: MapPin, label: "Ubicación", value: contact.address },
  ];
  return (
    <>
      <ContentHeader icon={<MessageCircle />} title={doc.title} description={doc.description} />
      {doc.blocks.length > 0 ? (
        <div className="mb-10">
          <ContentBlocks blocks={doc.blocks} />
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-8">
          <ContactForm />
        </div>

        <section aria-labelledby="contact-channels" className="xl:order-none">
          <h2 id="contact-channels" className="mb-4 text-title">
            Otros canales
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {channels.map((channel) => (
              <li
                key={channel.label}
                className="flex items-start gap-3 rounded-2xl border border-border bg-bg-subtle p-4"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary"
                >
                  <channel.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-caption font-semibold tracking-wider text-fg-muted uppercase">{channel.label}</p>
                  {channel.href ? (
                    <a
                      href={channel.href}
                      className="rounded-sm font-medium break-words text-fg underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
                    >
                      {channel.value}
                    </a>
                  ) : (
                    <p className="font-medium text-fg">{channel.value}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
