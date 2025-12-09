import type { Metadata } from "next";
import { products } from "@/data/products";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ productId: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<Metadata> {
  const { productId } = await params;
  const product = products.find((p) => p.id === productId);

  if (!product) {
    return {
      title: "Producto no encontrado",
    };
  }

  const title = `${product.name} | LEGO Store`;
  const description = product.shortDescription || product.description.slice(0, 160);

  return {
    title: product.name,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: product.img,
          width: 800,
          height: 800,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [product.img],
    },
  };
}

export default function ProductLayout({ children }: LayoutProps) {
  return children;
}
