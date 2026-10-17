import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormAlertProps {
  tone?: "error" | "success";
  children: ReactNode;
  className?: string;
}

/**
 * A form-level message (wrong credentials, saved changes). Errors are an
 * alert, so screen readers announce them as soon as they appear; confirmations
 * are a polite status.
 */
export function FormAlert({ tone = "error", children, className }: FormAlertProps) {
  const Icon = tone === "error" ? CircleAlert : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-label font-medium text-fg",
        tone === "error" ? "border-danger/40 bg-danger/10" : "border-success/40 bg-success/10",
        className
      )}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", tone === "error" ? "text-danger" : "text-success")} />
      <p>{children}</p>
    </div>
  );
}
