import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A 2×4 brick (decorative), in token colours. */
function Brick({ className, studs = 4 }: { className: string; studs?: number }) {
  return (
    <span className="flex flex-col items-center">
      <span className="flex gap-2">
        {Array.from({ length: studs }).map((_, i) => (
          <span key={i} className={cn("h-2.5 w-6 rounded-t-md brightness-95", className)} />
        ))}
      </span>
      <span className={cn("block h-12 rounded-xl shadow-lg", className)} style={{ width: `${studs * 2.5}rem` }} />
    </span>
  );
}

/** Bottom to top: a wide base, then smaller bricks set off-centre, as if just snapped on. */
const bricks = [
  { className: "bg-info-surface", studs: 4, offset: "" },
  { className: "bg-brand-red", studs: 3, offset: "translate-x-8" },
  { className: "bg-surface", studs: 2, offset: "-translate-x-4" },
];

/**
 * Shell of /login and /register: the form column, and on large screens a
 * yellow panel with a stack of bricks that drop in (CSS, honours reduced motion).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container-custom grid gap-10 py-10 lg:min-h-[75vh] lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-16">
      <div className="mx-auto w-full max-w-md lg:order-2">{children}</div>

      <div aria-hidden="true" className="relative hidden h-full min-h-[32rem] overflow-hidden rounded-3xl bg-primary p-10 text-on-primary shadow-card lg:flex lg:flex-col lg:justify-between">
        <div className="flex flex-1 flex-col-reverse items-center justify-center">
          {bricks.map((brick, index) => (
            <div
              key={brick.className}
              className={cn("animate-brick-drop", brick.offset)}
              style={{ animationDelay: `calc(var(--duration-fast) * ${index})` }}
            >
              <Brick className={brick.className} studs={brick.studs} />
            </div>
          ))}
        </div>
        <div>
          <p className="max-w-md text-headline font-extrabold">Cada colección empieza con una pieza.</p>
          <p className="mt-2 max-w-sm text-body">Ingresa o crea tu cuenta en un minuto: solo te pedimos nombre, email y contraseña.</p>
        </div>
      </div>
    </div>
  );
}
