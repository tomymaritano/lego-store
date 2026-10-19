import Link from "next/link";
import { Home, ShieldX } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";

export const metadata = { title: "Acceso restringido" };

/** 403, rendered by forbidden() (signed-in users without the required role). */
export default function Forbidden() {
  return (
    <div className="container-custom flex min-h-[60vh] items-center justify-center py-16">
      <EmptyState
        headingLevel="h1"
        icon={<ShieldX />}
        title="No tienes permiso para ver esta página"
        description="Esta sección es solo para administradores de la tienda. Si crees que es un error, escríbenos."
        action={
          <>
            <Button size="lg" render={<Link href="/" />}>
              <Home aria-hidden="true" />
              Ir al inicio
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/account" />}>
              Mi cuenta
            </Button>
          </>
        }
      />
    </div>
  );
}
