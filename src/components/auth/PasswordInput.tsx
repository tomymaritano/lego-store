"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { IconButton, Input, type InputProps } from "@/components/ui";

/** Password field with a show/hide toggle (a pressed-state button, so its state is announced). */
export function PasswordInput(props: Omit<InputProps, "type" | "rightIcon">) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      // Browsers must not offer to autocorrect or capitalise a shown password.
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      className="pr-12"
      rightIcon={
        <IconButton
          label="Mostrar contraseña"
          size="icon-sm"
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
          className="-mr-1.5"
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </IconButton>
      }
    />
  );
}
