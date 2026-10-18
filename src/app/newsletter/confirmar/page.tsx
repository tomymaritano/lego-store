import type { Metadata } from "next";
import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { confirmNewsletterAction } from "@/lib/contact/actions";
import { getDb } from "@/lib/db";
import { findByResubscribeToken } from "@/lib/newsletter";
import { confirmTokenSchema } from "@/lib/validations/inbox";
import { Button, Card, EmptyState } from "@/components/ui";
import { ConfirmSubscriptionForm } from "@/components/newsletter/ConfirmSubscriptionForm";

export const metadata: Metadata = {
  title: "Confirmar la suscripción al newsletter",
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * /newsletter/confirmar?token=…: the link in the email an address that
 * unsubscribed gets when someone signs it up again. Opening it only shows
 * who it is for; the button subscribes (a GET never does: mail scanners
 * open links). A wrong, used or expired token says so.
 */
export default async function ConfirmSubscriptionPage({ searchParams }: PageProps) {
  const raw = (await searchParams).token;
  const token = confirmTokenSchema.safeParse(Array.isArray(raw) ? raw[0] : raw);
  const found = token.success ? await findByResubscribeToken(getDb(), token.data) : ({ found: false } as const);

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
              description="Puede que esté incompleto, que ya lo hayas usado o que haya vencido. Si quieres recibir el newsletter, suscríbete desde el pie de cualquier página."
              action={
                <Button variant="secondary" render={<Link href="/" />}>
                  Volver a la tienda
                </Button>
              }
            />
          ) : (
            <>
              <h2 className="sr-only">Confirmar la suscripción</h2>
              <ConfirmSubscriptionForm token={token.data!} email={found.email} action={confirmNewsletterAction} />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
