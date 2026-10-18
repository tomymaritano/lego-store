"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import type { FormState } from "@/lib/auth/form-state";
import { MAX_SLUG, slugify } from "@/lib/slug";
import type { CategoryField } from "@/lib/validations/catalog";
import { Button, Card, CardContent, CardDescription, CardHeader, Checkbox, Field, Input, Textarea, showToast } from "@/components/ui";
import { FormAlert } from "@/components/auth/FormAlert";
import { useFocusFirstInvalid } from "@/components/auth/useFormFeedback";
import { ImageField } from "./ImageField";

export interface CategoryFormValues {
  slug: string;
  name: string;
  description: string;
  image: string;
  imageAlt: string;
  visible: boolean;
}

export const EMPTY_CATEGORY: CategoryFormValues = { slug: "", name: "", description: "", image: "", imageAlt: "", visible: true };

interface CategoryFormProps {
  /** saveCategoryAction bound to the category's slug (null to create). */
  action: (state: FormState<CategoryField>, formData: FormData) => Promise<FormState<CategoryField>>;
  initial: CategoryFormValues;
  mode: "create" | "edit";
}

/**
 * Create / edit a category (/admin/categories/new, /admin/categories/<slug>):
 * what the navigation, the home page and its page show, and its slug (the
 * URL). A new category's slug follows its name until the admin edits it.
 * The server validates everything again (src/lib/validations/catalog.ts).
 */
export function CategoryForm({ action, initial, mode }: CategoryFormProps) {
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
    <form ref={formRef} onSubmit={submit} noValidate aria-label={mode === "create" ? "Nueva categoría" : "Editar categoría"} className="space-y-6">
      {state.status === "error" && state.message ? <FormAlert>{state.message}</FormAlert> : null}

      <Card>
        <CardHeader>
          <h2 className="text-title text-fg">Información</h2>
          <CardDescription>Lo que se ve en la navegación, la home y la página de la categoría.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Nombre" error={errors.name} required>
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
          <Field
            label="Slug"
            error={errors.slug}
            hint={mode === "edit" ? "Es la URL (/category/…). Si lo cambias, la URL vieja redirige a la nueva." : "Es la URL: /category/…"}
            required
          >
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
          <Field label="Descripción" error={errors.description} hint="Una línea: la tarjeta de la home." required className="sm:col-span-2">
            <Textarea name="description" rows={2} defaultValue={initial.description} maxLength={200} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              label="Visible en la tienda"
              description="Apagada no aparece en la navegación, la home ni los filtros, y su página no se encuentra. Sus productos se siguen vendiendo."
              checked={visible}
              onCheckedChange={setVisible}
            />
            <input type="hidden" name="visible" value={visible ? "on" : ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-title text-fg">Imagen</h2>
          <CardDescription>La portada de la tarjeta en la home.</CardDescription>
        </CardHeader>
        <CardContent>
          <ImageField
            name="image"
            label="Imagen"
            initialUrl={initial.image}
            error={errors.image}
            required
            alt={{ name: "imageAlt", initial: initial.imageAlt, error: errors.imageAlt }}
          />
        </CardContent>
      </Card>

      <Button type="submit" loading={pending} disabled={!hydrated} data-testid="category-save">
        {pending ? "Guardando…" : mode === "create" ? "Crear categoría" : "Guardar cambios"}
      </Button>
    </form>
  );
}
