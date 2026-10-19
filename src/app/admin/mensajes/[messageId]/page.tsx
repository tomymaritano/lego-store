import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reply } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { setMessageStatusAction } from "@/lib/admin/actions";
import { getAdminMessageDetail } from "@/lib/admin/data";
import { formatAdminDateTime } from "@/lib/admin/format";
import { MESSAGE_STATUS_LABELS } from "@/lib/contact/messages";
import { siteConfig } from "@/config/site";
import { CONTACT_TOPICS } from "@/lib/validations/contact-options";
import { idSchema } from "@/lib/validations/ids";
import { PageHeader } from "@/components/layout/PageHeader";
import { AuditHistory } from "@/components/admin/AuditHistory";
import { MessageActions } from "@/components/admin/MessageActions";
import { Badge, Button, Card, CardContent } from "@/components/ui";

type MessagePageProps = { params: Promise<{ messageId: string }> };

const topicLabel = (value: string) => CONTACT_TOPICS.find((topic) => topic.value === value)?.label ?? value;

export async function generateMetadata({ params }: MessagePageProps): Promise<Metadata> {
  const { messageId } = await params;
  const id = idSchema.safeParse(messageId);
  const message = id.success ? await getAdminMessageDetail(id.data) : null;
  return { title: `${message ? `Mensaje de ${message.name}` : "Mensaje"} · Administración` };
}

/** "mailto:" with the reply's subject and the message quoted. */
function replyHref(message: { email: string; topic: string; orderNumber: string | null; message: string; createdAt: string }) {
  const subject = `Re: ${topicLabel(message.topic)}${message.orderNumber ? ` (${message.orderNumber})` : ""} · ${siteConfig.name}`;
  const quoted = message.message
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
  const body = `\n\n—\nEl ${formatAdminDateTime(message.createdAt)} escribiste:\n${quoted}`;
  return `mailto:${message.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** /admin/mensajes/<id>: one message whole, reply by email (mailto), mark read / archive, and its history. */
export default async function AdminMessagePage({ params }: MessagePageProps) {
  const { messageId } = await params;
  await requireAdmin({ callbackUrl: `/admin/mensajes/${encodeURIComponent(messageId)}` });
  const id = idSchema.safeParse(messageId);
  const message = id.success ? await getAdminMessageDetail(id.data) : null;
  if (!message) notFound();

  return (
    <>
      <PageHeader
        title={`Mensaje de ${message.name}`}
        breadcrumbs={[{ label: "Administración", href: "/admin" }, { label: "Mensajes", href: "/admin/mensajes" }, { label: message.name }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={message.status === "NEW" ? "warning" : "neutral"}>{MESSAGE_STATUS_LABELS[message.status]}</Badge>
            <span>{formatAdminDateTime(message.createdAt)}</span>
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <Card>
          <CardContent className="space-y-6">
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-caption font-semibold tracking-wider text-fg-muted uppercase">De</dt>
                <dd className="text-fg">
                  {message.name} ·{" "}
                  <a href={`mailto:${message.email}`} className="font-medium underline underline-offset-4 hover:no-underline">
                    {message.email}
                  </a>
                  {message.userId ? (
                    <>
                      {" "}
                      ·{" "}
                      <Link href={`/admin/users/${message.userId}`} prefetch={false} className="text-label underline underline-offset-4">
                        Ver cuenta
                      </Link>
                    </>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-caption font-semibold tracking-wider text-fg-muted uppercase">Motivo</dt>
                <dd className="text-fg">{topicLabel(message.topic)}</dd>
              </div>
              {message.orderNumber ? (
                <div>
                  <dt className="text-caption font-semibold tracking-wider text-fg-muted uppercase">Pedido</dt>
                  <dd>
                    <Link href={`/admin/orders?q=${encodeURIComponent(message.orderNumber)}`} prefetch={false} className="font-mono text-fg underline underline-offset-4">
                      {message.orderNumber}
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
            <div>
              <h2 className="mb-2 text-title text-fg">Mensaje</h2>
              <p className="rounded-xl border border-border bg-bg-subtle p-4 whitespace-pre-wrap text-fg" data-testid="message-body">
                {message.message}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button render={<a href={replyHref(message)} />}>
                <Reply aria-hidden="true" />
                Responder por email
              </Button>
              <MessageActions action={setMessageStatusAction.bind(null, message.id)} status={message.status} subject={`este mensaje`} size="md" />
            </div>
          </CardContent>
        </Card>
        <AuditHistory entries={message.history} entity={{ type: "message", id: message.id }} />
      </div>
    </>
  );
}
