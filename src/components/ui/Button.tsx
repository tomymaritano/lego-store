"use client";

import * as React from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold select-none",
    "transition-[background-color,color,border-color,box-shadow,transform] duration-fast ease-standard",
    "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "active:scale-[0.97] motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary shadow-sm hover:bg-primary-hover hover:shadow-md",
        secondary: "border border-border bg-bg-subtle text-fg hover:bg-bg-muted",
        outline: "border-2 border-primary bg-transparent text-fg hover:bg-primary hover:text-on-primary",
        ghost: "text-fg-secondary hover:bg-bg-muted hover:text-fg",
        destructive: "bg-danger text-on-danger shadow-sm hover:opacity-90",
        link: "text-info underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-base",
        lg: "h-12 px-6 text-lg [&_svg:not([class*='size-'])]:size-5",
        icon: "size-10 [&_svg:not([class*='size-'])]:size-5",
        "icon-sm": "size-8",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type BaseButtonProps = Omit<React.ComponentProps<typeof BaseButton>, "className">;

export interface ButtonProps extends BaseButtonProps, VariantProps<typeof buttonVariants> {
  className?: string;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
}

/**
 * Button built on Base UI. Render it as a link (no <Link><Button> nesting):
 *
 *   <Button render={<Link href="/cart" />}>Ver carrito</Button>
 *
 * With `render`, the element keeps its own semantics (a link stays a link:
 * Base UI's button behaviour would add role="button"). Pass
 * `nativeButton` when `render` is itself a <button>.
 */
function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  render,
  nativeButton,
  focusableWhenDisabled,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  const content = (
    <>
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </>
  );

  const asElement = useRender({
    enabled: Boolean(render) && !nativeButton,
    render: render as useRender.RenderProp,
    props: {
      ...props,
      "data-slot": "button",
      className: classes,
      "aria-busy": loading || undefined,
      "aria-disabled": disabled || loading || undefined,
      children: content,
    },
  });
  if (asElement) return asElement;

  return (
    <BaseButton
      data-slot="button"
      render={render}
      nativeButton={nativeButton ?? true}
      focusableWhenDisabled={focusableWhenDisabled}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {content}
    </BaseButton>
  );
}

export { Button, buttonVariants };
