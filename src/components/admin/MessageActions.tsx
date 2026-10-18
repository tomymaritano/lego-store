"use client";

import { useEffect, useRef, useTransition } from "react";
import { Archive, Inbox, Mail, MailOpen } from "lucide-react";
import { useFocusAfterRemoval } from "@/hooks/useFocusAfterRemoval";
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

/** The first status button of an inbox row (`data-message-id`), if that row is on the page. */
const rowButton = (id: string | undefined) => (id ? document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"] [data-message-actions] button`) : null);

/**
 * Where the focus goes when archiving removes this row from the inbox: the
 * next row's buttons, else the previous row's, else the first row's (the
 * next page slid in), else the empty inbox (`data-inbox-focus`).
 */
function removalTarget(from: HTMLElement): () => HTMLElement | null {
  const row = from.closest<HTMLElement>("[data-message-id]");
  const next = (row?.nextElementSibling as HTMLElement | null)?.dataset.messageId;
  const previous = (row?.previousElementSibling as HTMLElement | null)?.dataset.messageId;
  return () =>
    rowButton(next) ??
    rowButton(previous) ??
    document.querySelector<HTMLElement>("[data-message-id] [data-message-actions] button") ??
    document.querySelector<HTMLElement>("[data-inbox-focus]");
}

/**
 * A message's status buttons (inbox rows and the message page); the page
 * re-renders with the new status. While the change is saving the buttons
 * stay focusable (aria-disabled), and each status swaps a button's label in
 * place, so the focus stays where it was; when the row leaves the list
 * (archived from the inbox) it moves to the next row.
 */
export function MessageActions({ action, status, subject, size = "sm" }: MessageActionsProps) {
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const wrapper = useRef<HTMLSpanElement>(null);
  const focus = useFocusAfterRemoval();
  const run = (next: Status) => {
    if (pending) return;
    if (wrapper.current) focus.arm(removalTarget(wrapper.current));
    startTransition(async () => {
      try {
        const result = await action(next);
        if (result.ok) showToast.success(result.message);
        else showToast.error(result.error);
      } catch {
        showToast.error("No pudimos guardar el cambio. Revisa tu conexión e inténtalo de nuevo.");
      }
    });
  };
  // Still here once the change is in: the row stayed, nothing to move.
  const { disarm } = focus;
  useEffect(() => {
    if (!pending) disarm();
  }, [pending, disarm]);

  const common = {
    type: "button" as const,
    size,
    disabled: pending || !hydrated,
    focusableWhenDisabled: hydrated,
  };
  return (
    <span ref={wrapper} className="flex flex-wrap gap-2" data-message-actions="">
      {status === "NEW" ? (
        <Button {...common} variant="secondary" onClick={() => run("READ")}>
          <MailOpen aria-hidden="true" />
          Marcar leído
          <span className="sr-only">: {subject}</span>
        </Button>
      ) : status === "READ" ? (
        <Button {...common} variant="ghost" onClick={() => run("NEW")}>
          <Mail aria-hidden="true" />
          No leído
          <span className="sr-only">: {subject}</span>
        </Button>
      ) : null}
      {status === "ARCHIVED" ? (
        <Button {...common} variant="secondary" onClick={() => run("READ")}>
          <Inbox aria-hidden="true" />A la bandeja
          <span className="sr-only">: {subject}</span>
        </Button>
      ) : (
        <Button {...common} variant="ghost" onClick={() => run("ARCHIVED")}>
          <Archive aria-hidden="true" />
          Archivar
          <span className="sr-only">: {subject}</span>
        </Button>
      )}
    </span>
  );
}
