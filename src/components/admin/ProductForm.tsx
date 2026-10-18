"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import type { FormState } from "@/lib/auth/form-state";
import { REMOTE_IMAGE_HOSTS } from "@/lib/images";
import { MAX_PRODUCT_IMAGES, type GalleryImage, type ProductField } from "@/lib/validations/admin";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Checkbox,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  showToast,
} from "@/components/ui";
import { FormAlert } from "@/components/auth/FormAlert";
import { useFocusFirstInvalid } from "@/components/auth/useFormFeedback";
import { GalleryEditor } from "./GalleryEditor";
import { ImageField } from "./ImageField";

/** What the form starts with: a product's current values, or empty for a new one. */
export interface ProductFormValues {
  name: string;
  price: number | null;
  originalPrice: number | null;
  isNew: boolean;
  isOnSale: boolean;
  categoryId: string;
  themeId: string;
  type: string;
  age: string;
  interests: string[];
  pieces: string;
  highlight: string;
  /** The pictures in order (the first is the main one), each with its alt text. */
  gallery: GalleryImage[];
  imageSecondary: string | null;
  stock: number;
  shortDescription: string;
  description: string;
}

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "",
  price: null,
  originalPrice: null,
  isNew: true,
  isOnSale: false,
  categoryId: "",
  themeId: "",
  type: "",
  age: "",
  interests: [],
  pieces: "",
  highlight: "",
  gallery: [],
  imageSecondary: null,
  stock: 0,
  shortDescription: "",
  description: "",
};

export interface ProductFormProps {
  /** saveProductAction bound to the product id (null to create). */
  action: (state: FormState<ProductField>, formData: FormData) => Promise<FormState<ProductField>>;
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
  /** Every theme in the store's order (hidden ones marked: their products keep them). */
  themes: { id: string; name: string; visible: boolean }[];
  /** Values already in use, offered as suggestions. */
  suggestions: Record<"type" | "age" | "pieces" | "highlight" | "interests", string[]>;
  mode: "create" | "edit";
}

function Suggestions({ id, values }: { id: string; values: string[] }) {
  return (
    <datalist id={id}>
      {values.map((value) => (
        <option key={value} value={value} />
      ))}
    </datalist>
  );
}

/**
 * Create / edit a product (/admin/products/new, /admin/products/<id>). Every
 * field of the storefront's product, validated again on the server with the
 * same zod schema (src/lib/validations/admin.ts). Pictures are uploaded or
 * pasted as URLs (a file of the site or the allowed CDN), each with its alt
 * text, previewed as the store will show them; the first is the main one.
 *
 * The form is submitted through the action by hand (not `<form action>`), so
 * React does not reset it after an error: what the admin typed stays.
 */
export function ProductForm({ action, initial, categories, themes, suggestions, mode }: ProductFormProps) {
  const [state, formAction] = useActionState(action, {});
  const [pending, startTransition] = useTransition();
  const formRef = useFocusFirstInvalid(state);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [themeId, setThemeId] = useState(initial.themeId);
  const [isNew, setIsNew] = useState(initial.isNew);
  const [isOnSale, setIsOnSale] = useState(initial.isOnSale);
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

  const categoryItems = Object.fromEntries(categories.map((category) => [category.id, category.name]));
  const themeItems = Object.fromEntries(themes.map((theme) => [theme.id, theme.visible ? theme.name : `${theme.name} (oculto)`]));

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-label={mode === "create" ? "Nuevo producto" : "Editar producto"} className="space-y-6">
      {state.status === "error" && state.message ? <FormAlert>{state.message}</FormAlert> : null}

      <Card>
        <CardHeader>
          <h2 className="text-title text-fg">Información</h2>
          <CardDescription>Lo que se ve en la tarjeta, la ficha y los filtros del catálogo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Nombre" error={errors.name} required className="sm:col-span-2">
            <Input name="name" defaultValue={initial.name} maxLength={120} autoComplete="off" />
          </Field>
          <Field label="Categoría" error={errors.categoryId} required>
            <Select items={categoryItems} value={categoryId || null} onValueChange={(value) => setCategoryId(typeof value === "string" ? value : "")}>
              <SelectTrigger>
                <SelectValue placeholder="Elige una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="categoryId" value={categoryId} />
          </Field>
          <Field label="Tema" error={errors.themeId} hint="Los temas se crean y ordenan en Temas." required>
            <Select items={themeItems} value={themeId || null} onValueChange={(value) => setThemeId(typeof value === "string" ? value : "")}>
              <SelectTrigger>
                <SelectValue placeholder="Elige un tema" />
              </SelectTrigger>
              <SelectContent>
                {themes.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {themeItems[theme.id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="themeId" value={themeId} />
          </Field>
          <Field label="Tipo" error={errors.type} required>
            <Input name="type" defaultValue={initial.type} list="admin-types" maxLength={60} autoComplete="off" />
          </Field>
          <Field label="Edad" error={errors.age} hint="Como en la caja: 18+, 9+." required>
            <Input name="age" defaultValue={initial.age} list="admin-ages" maxLength={20} autoComplete="off" />
          </Field>
          <Field label="Piezas" error={errors.pieces} hint="El rango del filtro: 501-1000, 2001+." required>
            <Input name="pieces" defaultValue={initial.pieces} list="admin-pieces" maxLength={20} autoComplete="off" />
          </Field>
          <Field label="Destacado" error={errors.highlight} required>
            <Input name="highlight" defaultValue={initial.highlight} list="admin-highlights" maxLength={60} autoComplete="off" />
          </Field>
          <Field label="Intereses" error={errors.interests} hint="Separados por comas." className="sm:col-span-2">
            <Input name="interests" defaultValue={initial.interests.join(", ")} autoComplete="off" />
          </Field>
          <Suggestions id="admin-types" values={suggestions.type} />
          <Suggestions id="admin-ages" values={suggestions.age} />
          <Suggestions id="admin-pieces" values={suggestions.pieces} />
          <Suggestions id="admin-highlights" values={suggestions.highlight} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-title text-fg">Precio y stock</h2>
          <CardDescription>En pesos, sin centavos. El checkout siempre cobra el precio que esté guardado acá.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <Field label="Precio" error={errors.price} required>
            <Input name="price" type="number" inputMode="numeric" min={1} step={1} defaultValue={initial.price ?? ""} />
          </Field>
          <Field
            label="Precio anterior"
            error={errors.originalPrice}
            hint={isOnSale ? "Mayor que el precio: se muestra tachado." : "Solo para productos en oferta."}
            disabled={!isOnSale}
          >
            <Input name="originalPrice" type="number" inputMode="numeric" min={1} step={1} defaultValue={initial.originalPrice ?? ""} />
          </Field>
          <Field label="Stock" error={errors.stock} required>
            {/*
             * Keyed on the saved stock: when the page re-renders with another
             * value (a sale while editing), the field shows it again. The
             * server only writes a changed stock while it is still stockSeen.
             */}
            <Input key={initial.stock} name="stock" type="number" inputMode="numeric" min={0} step={1} defaultValue={initial.stock} />
          </Field>
          <input type="hidden" name="stockSeen" value={initial.stock} />
          <div className="flex flex-col gap-3 sm:col-span-3 sm:flex-row sm:gap-8">
            <Checkbox label="En oferta" description="Muestra el descuento y entra en «Ofertas»." checked={isOnSale} onCheckedChange={setIsOnSale} />
            <Checkbox label="Nuevo" description="Insignia «Nuevo» y la sección de novedades." checked={isNew} onCheckedChange={setIsNew} />
            <input type="hidden" name="isOnSale" value={isOnSale ? "on" : ""} />
            <input type="hidden" name="isNew" value={isNew ? "on" : ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-title text-fg">Imágenes</h2>
          <CardDescription>
            Hasta {MAX_PRODUCT_IMAGES}, en orden: la primera es la principal (tarjetas, carrito, búsqueda). Sube JPG, PNG, WebP o AVIF, o pega la
            URL de un archivo del sitio (/images/…) o de {REMOTE_IMAGE_HOSTS.join(", ")}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <GalleryEditor name="gallery" initial={initial.gallery} error={errors.gallery} />
          <ImageField
            name="imageSecondary"
            label="Imagen al pasar el mouse"
            initialUrl={initial.imageSecondary ?? ""}
            error={errors.imageSecondary}
            hint="Opcional: la tarjeta la muestra al pasar el mouse. Sube una imagen o pega su URL."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-title text-fg">Descripción</h2>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Descripción corta" error={errors.shortDescription} hint="Una o dos líneas: la tarjeta y la vista rápida." required>
            <Textarea name="shortDescription" rows={2} defaultValue={initial.shortDescription} maxLength={300} />
          </Field>
          <Field label="Descripción" error={errors.description} required>
            <Textarea name="description" rows={6} defaultValue={initial.description} maxLength={5000} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending} disabled={!hydrated} data-testid="product-save">
          {pending ? "Guardando…" : mode === "create" ? "Crear producto" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
