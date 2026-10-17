import type { ReactNode } from "react";
import { infoNav } from "@/config/navigation";
import { NavLink } from "@/components/layout";

const linkClasses =
  "block rounded-lg border-l-2 border-transparent px-3 py-2 text-sm font-medium text-fg-secondary transition-colors duration-fast ease-standard hover:bg-bg-muted hover:text-fg aria-[current=page]:border-primary aria-[current=page]:bg-bg-muted aria-[current=page]:text-fg";

/**
 * Shell of the static info pages (help, company, legal): the page on the
 * left/top and a sticky sidebar with the sibling pages (below the content on
 * phones, so the page itself comes first).
 */
export default function InfoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container-custom grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-16 lg:py-12">
      {/* One measure for every block (header, fact cards, prose, tables). */}
      <div className="min-w-0 lg:max-w-4xl">{children}</div>

      <nav
        aria-labelledby="info-nav-title"
        className="rounded-2xl border border-border bg-bg-subtle p-4 lg:sticky lg:top-24 lg:self-start"
      >
        {/* Names the landmark; the visible group labels (Ayuda, La tienda…) head the lists. */}
        <h2 id="info-nav-title" className="sr-only">
          Ayuda e información
        </h2>
        <div className="space-y-4">
          {infoNav.map((group) => (
            <div key={group.title}>
              <h3 className="px-3 pb-1 text-caption font-bold tracking-wider text-fg-muted uppercase">{group.title}</h3>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink href={item.href} className={linkClasses}>
                      {item.name}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
