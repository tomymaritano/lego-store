import type { Metadata } from "next";
import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { unsubscribeNewsletterAction } from "@/lib/contact/actions";
import { getDb } from "@/lib/db";
import { findByUnsubscribeToken } from "@/lib/newsletter";
import { unsubscribeTokenSchema } from "@/lib/validations/inbox";
import { Button, Card, EmptyState } from "@/components/ui";
import { UnsubscribeForm } from "@/components/newsletter/UnsubscribeForm";

export const metadata: Metadata = {
  title: "Darse de baja del newsletter",
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * /newsletter/baja?token=…: the link in every newsletter email. Opening it
 * only shows who it is for; the button unsubscribes (a GET never does:
 * mail scanners open links). A wrong or old token says so.
 */
export default async function UnsubscribePage({ searchParams }: PageProps) {
  const raw = (await searchParams).token;
  const token = unsubscribeTokenSchema.safeParse(Array.isArray(raw) ? raw[0] : raw);
  const found = token.success ? await findByUnsubscribeToken(getDb(), token.data) : ({ found: false } as const);

  return (
    <div className="container-custom py-12 md:py-16">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-center text-headline">Newsletter</h1>
        <Card className="p-6 sm:p-8">
          {!found.found ? (
            <EmptyState
              headingLevel="h2"
              icon={<LinkIcon />}
              title="Este enlace no es válido"
              description="Puede que esté incompleto o que sea de un email viejo. Usa el enlace del último newsletter que recibiste."
              action={
                <Button variant="secondary" render={<Link href="/" />}>
                  Volver a la tienda
                </Button>
              }
            />
          ) : !found.active ? (
            <EmptyState
              headingLevel="h2"
              title="Ya estabas dado de baja"
              description={`No enviamos el newsletter a ${found.email}.`}
              action={
                <Button variant="secondary" render={<Link href="/" />}>
                  Volver a la tienda
                </Button>
              }
            />
          ) : (
            <>
              <h2 className="sr-only">Confirmar la baja</h2>
              <UnsubscribeForm token={token.data!} email={found.email} action={unsubscribeNewsletterAction} />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
