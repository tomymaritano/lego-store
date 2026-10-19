"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import type { FormState } from "@/lib/auth/form-state";
import { MAX_SLUG, slugify } from "@/lib/slug";
import type { ThemeField } from "@/lib/validations/catalog";
import { Button, Card, CardContent, Checkbox, Field, Input, showToast } from "@/components/ui";
import { FormAlert } from "@/components/auth/FormAlert";
import { useFocusFirstInvalid } from "@/components/auth/useFormFeedback";

export interface ThemeFormValues {
  name: string;
  slug: string;
  visible: boolean;
}

export const EMPTY_THEME: ThemeFormValues = { name: "", slug: "", visible: true };

interface ThemeFormProps {
  /** saveThemeAction bound to the theme id (null to create). */
  action: (state: FormState<ThemeField>, formData: FormData) => Promise<FormState<ThemeField>>;
  initial: ThemeFormValues;
  mode: "create" | "edit";
}

/**
 * Create / edit a theme (/admin/themes/new, /admin/themes/<id>): its name
 * (the cards' label, the menu and the filter), its slug (also a filter
 * value: ?theme=star-wars) and whether the "Temas" menu and the filters show
 * it. A new theme's slug follows its name until the admin edits it.
 */
export function ThemeForm({ action, initial, mode }: ThemeFormProps) {
  const [state, formAction] = useActionState(action, {});
  const [pending, startTransition] = useTransition();
  const formRef = useFocusFirstInvalid(state);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [visible, setVisible] = useState(initial.visible);
  const errors = state.fieldErrors ?? {};
  const handled = useRef(state);
  const hydrated = useHydrated();

  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (state.status === "success" && state.message) showToast.success(state.message);
  }, [state]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-label={mode === "create" ? "Nuevo tema" : "Editar tema"} className="space-y-6">
      {state.status === "error" && state.message ? <FormAlert>{state.message}</FormAlert> : null}
      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Nombre" error={errors.name} hint="Como se ve en las tarjetas: Star Wars, Technic." required>
            <Input
              name="name"
              defaultValue={initial.name}
              maxLength={60}
              autoComplete="off"
              onChange={(event) => {
                if (!slugTouched) setSlug(slugify(event.target.value));
              }}
            />
          </Field>
          <Field label="Slug" error={errors.slug} hint="Para los enlaces del filtro: /search?theme=…" required>
            <Input
              name="slug"
              value={slug}
              maxLength={MAX_SLUG}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
            />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              label="Visible en el menú «Temas» y en los filtros"
              description="Oculto, sus productos lo siguen mostrando en la tarjeta y la ficha."
              checked={visible}
              onCheckedChange={setVisible}
            />
            <input type="hidden" name="visible" value={visible ? "on" : ""} />
          </div>
        </CardContent>
      </Card>
      <Button type="submit" loading={pending} disabled={!hydrated} data-testid="theme-save">
        {pending ? "Guardando…" : mode === "create" ? "Crear tema" : "Guardar cambios"}
      </Button>
    </form>
  );
}
