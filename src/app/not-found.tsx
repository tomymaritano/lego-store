import Link from "next/link";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui";
import { helpLinks } from "@/config/navigation";

export const metadata = { title: "Página no encontrada" };

/** One LEGO brick per digit: colour pairs from the semantic tokens (AA in both themes). */
const bricks = [
  { digit: "4", className: "bg-sale text-on-sale" },
  { digit: "0", className: "bg-primary text-on-primary" },
  { digit: "4", className: "bg-info text-on-info" },
];

export default function NotFound() {
  return (
    <div className="container-custom flex min-h-[65vh] flex-col items-center justify-center py-16 text-center">
      <div aria-hidden="true" className="mb-10 flex items-end justify-center gap-3">
        {bricks.map((brick, index) => (
          <div
            key={index}
            className="animate-brick-drop flex flex-col items-center"
            // Stagger derived from the motion tokens (half a fast step per brick).
            style={{ animationDelay: `calc(var(--duration-fast) * ${index} / 2)` }}
          >
            <div className="flex gap-2">
              <span className={`h-3 w-5 rounded-t-md ${brick.className} brightness-95`} />
              <span className={`h-3 w-5 rounded-t-md ${brick.className} brightness-95`} />
            </div>
            <span
              className={`flex h-24 w-20 items-center justify-center rounded-xl text-5xl font-black shadow-lg ${brick.className}`}
            >
              {brick.digit}
            </span>
          </div>
        ))}
      </div>

      <h1 className="text-3xl md:text-4xl">Esta pieza no está en la caja</h1>
      <p className="mt-3 max-w-md text-lg text-fg-secondary">
        La página que buscas no existe o se movió. Prueba buscando el set o vuelve al inicio.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" render={<Link href="/" />}>
          <Home aria-hidden="true" />
          Ir al inicio
        </Button>
        <Button variant="outline" size="lg" render={<Link href="/search" />}>
          <Search aria-hidden="true" />
          Buscar productos
        </Button>
      </div>

      <nav aria-label="Ayuda" className="mt-10">
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          {helpLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="rounded-sm text-fg-secondary underline-offset-4 hover:text-fg hover:underline">
                {link.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
