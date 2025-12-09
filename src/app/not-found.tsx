import Link from "next/link";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        {/* LEGO-style 404 blocks */}
        <div className="flex justify-center gap-2 mb-8">
          <div className="w-16 h-20 bg-lego-red rounded-lg shadow-lg flex items-center justify-center">
            <span className="text-3xl font-black text-white">4</span>
          </div>
          <div className="w-16 h-20 bg-lego-yellow rounded-lg shadow-lg flex items-center justify-center">
            <span className="text-3xl font-black text-lego-black">0</span>
          </div>
          <div className="w-16 h-20 bg-lego-blue rounded-lg shadow-lg flex items-center justify-center">
            <span className="text-3xl font-black text-white">4</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground-primary mb-3">
          Página no encontrada
        </h1>
        <p className="text-foreground-muted mb-8">
          Lo sentimos, la página que buscas no existe o ha sido movida.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button size="lg">
              <Home className="w-4 h-4 mr-2" />
              Ir al inicio
            </Button>
          </Link>
          <Link href="/search">
            <Button variant="outline" size="lg">
              <Search className="w-4 h-4 mr-2" />
              Buscar productos
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
