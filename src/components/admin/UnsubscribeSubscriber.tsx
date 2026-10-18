"use client";

import { UserMinus } from "lucide-react";
import { useFocusAfterRemoval } from "@/hooks/useFocusAfterRemoval";
import { ConfirmAction, type ConfirmActionResult } from "./ConfirmAction";

interface UnsubscribeSubscriberProps {
  /** unsubscribeSubscriberAction bound to the subscriber. */
  action: () => Promise<ConfirmActionResult>;
  email: string;
  /** The id of the row's element that takes the focus once the button is gone (the email cell). */
  focusId: string;
}

/**
 * "Dar de baja" on an active subscriber's row of /admin/newsletter, after a
 * confirmation. Once it worked the row shows "De baja" instead of the
 * button, and the focus goes to the row's email instead of the page's start.
 */
export function UnsubscribeSubscriber({ action, email, focusId }: UnsubscribeSubscriberProps) {
  const focus = useFocusAfterRemoval();
  return (
    <span className="inline-flex" onClickCapture={() => focus.arm(() => document.getElementById(focusId))}>
      <ConfirmAction
        label={
          <>
            Dar de baja<span className="sr-only">: {email}</span>
          </>
        }
        icon={<UserMinus aria-hidden="true" />}
        variant="ghost"
        title={`¿Dar de baja a ${email}?`}
        description="Deja de recibir el newsletter desde ahora. Si quiere volver, puede suscribirse otra vez y confirmar desde su correo."
        confirmLabel="Dar de baja"
        confirmVariant="destructive"
        action={action}
        testId="admin-unsubscribe"
      />
    </span>
  );
}
