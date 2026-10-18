"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import type { FormState } from "@/lib/auth/form-state";
import { REMOTE_IMAGE_HOSTS } from "@/lib/images";
import { splitList, MAX_PRODUCT_IMAGES, type ProductField } from "@/lib/validations/admin";
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
import { ImagePreview } from "./ImagePreview";

/** What the form starts with: a product's current values, or empty for a new one. */
export interface ProductFormValues {
  name: string;
  price: number | null;
  originalPrice: number | null;
  isNew: boolean;
  isOnSale: boolean;
  categoryId: string;
  type: string;
  age: string;
  theme: string;
  interests: string[];
  pieces: string;
  highlight: string;
  img: string;
  imageSecondary: string | null;
  images: string[];
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
  type: "",
  age: "",
  theme: "",
  interests: [],
  pieces: "",
  highlight: "",
  img: "",
  imageSecondary: null,
  images: [],
  stock: 0,
  shortDescription: "",
  description: "",
};

export interface ProductFormProps {
  /** saveProductAction bound to the product id (null to create). */
  action: (state: FormState<ProductField>, formData: FormData) => Promise<FormState<ProductField>>;
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
  /** Values already in use, offered as suggestions. */
  suggestions: Record<"type" | "age" | "theme" | "pieces" | "highlight" | "interests", string[]>;
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
 * same zod schema (src/lib/validations/admin.ts). Pictures are URLs (a file
 * of the site or the allowed CDN), previewed as the store will show them.
 *
 * The form is submitted through the action by hand (not `<form action>`), so
 * React does not reset it after an error: what the admin typed stays.
 */
export function ProductForm({ action, initial, categories, suggestions, mode }: ProductFormProps) {
  const [state, formAction] = useActionState(action, {});
  const [pending, startTransition] = useTransition();
  const formRef = useFocusFirstInvalid(state);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [isNew, setIsNew] = useState(initial.isNew);
  const [isOnSale, setIsOnSale] = useState(initial.isOnSale);
  const [img, setImg] = useState(initial.img);
  const [imageSecondary, setImageSecondary] = useState(initial.imageSecondary ?? "");
  const [images, setImages] = useState(initial.images.join("\n"));
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

  const gallery = splitList(images, /\r?\n/).slice(0, MAX_PRODUCT_IMAGES);
  const categoryItems = Object.fromEntries(categories.map((category) => [category.id, category.name]));

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
          <Field label="Tema" error={errors.theme} hint="Por ejemplo: Star Wars, Marvel, Technic." required>
            <Input name="theme" defaultValue={initial.theme} list="admin-themes" maxLength={60} autoComplete="off" />
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
          <Suggestions id="admin-themes" values={suggestions.theme} />
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
            URLs: un archivo del sitio (/images/…) o una imagen https de {REMOTE_IMAGE_HOSTS.join(", ")}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-4">
            <Field label="Imagen principal" error={errors.img} required className="min-w-0 flex-1">
              <Input name="img" type="url" value={img} onChange={(event) => setImg(event.target.value)} autoComplete="off" />
            </Field>
            <ImagePreview url={img} label="Imagen principal" className="mt-7 size-20 sm:size-24" />
          </div>
          <div className="flex items-start gap-4">
            <Field label="Imagen al pasar el mouse" error={errors.imageSecondary} hint="Opcional." className="min-w-0 flex-1">
              <Input
                name="imageSecondary"
                type="url"
                value={imageSecondary}
                onChange={(event) => setImageSecondary(event.target.value)}
                autoComplete="off"
              />
            </Field>
            <ImagePreview url={imageSecondary} label="Imagen al pasar el mouse" className="mt-7 size-20 sm:size-24" />
          </div>
          <Field
            label="Galería"
            error={errors.images}
            hint={`Una URL por línea, hasta ${MAX_PRODUCT_IMAGES}. Vacía: se usa la imagen principal.`}
          >
            <Textarea name="images" rows={4} value={images} onChange={(event) => setImages(event.target.value)} className="font-mono text-caption" />
          </Field>
          {gallery.length > 0 ? (
            <ul aria-label="Vista previa de la galería" className="flex flex-wrap gap-3">
              {gallery.map((url, index) => (
                <li key={`${url}-${index}`}>
                  <ImagePreview url={url} label={`Galería, imagen ${index + 1}`} className="size-20" />
                </li>
              ))}
            </ul>
          ) : null}
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
