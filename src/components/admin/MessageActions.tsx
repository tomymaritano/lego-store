"use client";

import { useTransition } from "react";
import { Archive, Inbox, Mail, MailOpen } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import { Button, showToast } from "@/components/ui";
import type { ConfirmActionResult } from "./ConfirmAction";

type Status = "NEW" | "READ" | "ARCHIVED";

interface MessageActionsProps {
  /** setMessageStatusAction bound to the message. */
  action: (status: Status) => Promise<ConfirmActionResult>;
  status: Status;
  /** What the buttons name ("el mensaje de Ana"): screen readers hear which row they act on. */
  subject: string;
  size?: "sm" | "md";
}

/** A message's status buttons (inbox rows and the message page); the page re-renders with the new status. */
export function MessageActions({ action, status, subject, size = "sm" }: MessageActionsProps) {
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const run = (next: Status) =>
    startTransition(async () => {
      try {
        const result = await action(next);
        if (result.ok) showToast.success(result.message);
        else showToast.error(result.error);
      } catch {
        showToast.error("No pudimos guardar el cambio. Revisa tu conexión e inténtalo de nuevo.");
      }
    });
  const disabled = pending || !hydrated;
  return (
    <span className="flex flex-wrap gap-2">
      {status === "NEW" ? (
        <Button type="button" variant="secondary" size={size} disabled={disabled} onClick={() => run("READ")}>
          <MailOpen aria-hidden="true" />
          Marcar leído
          <span className="sr-only">: {subject}</span>
        </Button>
      ) : status === "READ" ? (
        <Button type="button" variant="ghost" size={size} disabled={disabled} onClick={() => run("NEW")}>
          <Mail aria-hidden="true" />
          No leído
          <span className="sr-only">: {subject}</span>
        </Button>
      ) : null}
      {status === "ARCHIVED" ? (
        <Button type="button" variant="secondary" size={size} disabled={disabled} onClick={() => run("READ")}>
          <Inbox aria-hidden="true" />
          A la bandeja
          <span className="sr-only">: {subject}</span>
        </Button>
      ) : (
        <Button type="button" variant="ghost" size={size} disabled={disabled} onClick={() => run("ARCHIVED")}>
          <Archive aria-hidden="true" />
          Archivar
          <span className="sr-only">: {subject}</span>
        </Button>
      )}
    </span>
  );
}
