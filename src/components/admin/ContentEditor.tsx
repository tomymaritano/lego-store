"use client";

import { createContext, useCallback, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { ArrowDown, ArrowUp, FileText, HelpCircle, ListOrdered, Plus, Trash2, Undo2, Upload, Save } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";
import type { ContentPageInfo } from "@/lib/content/pages";
import { fillDocument } from "@/lib/content/text";
import {
  CONTENT_BLOCK_LABELS,
  CONTENT_LIMITS as L,
  sameContent,
  type ContentBlock,
  type ContentBlockType,
  type ContentDocument,
  type FaqBlock,
  type ListBlock,
} from "@/lib/content/types";
import type { StoreSettings } from "@/lib/settings/defaults";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Field,
  IconButton,
  Input,
  RadioGroup,
  RadioGroupItem,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  showToast,
} from "@/components/ui";
import { FormAlert } from "@/components/auth/FormAlert";
import { ContentBlocks, ContentTableOfContents } from "@/components/content/ContentBlocks";
import { Markdown } from "@/components/content/Markdown";

export type ContentActionResult = { ok: true; message: string } | { ok: false; error: string; issues?: string[] };

interface ContentEditorProps {
  page: Pick<ContentPageInfo, "slug" | "label" | "path" | "layout">;
  initial: ContentDocument;
  /** Whether the page has a published version (discarding needs one). */
  published: ContentDocument | null;
  /** The placeholders in the preview are filled with these. */
  settings: StoreSettings;
  save: (slug: string, doc: ContentDocument) => Promise<ContentActionResult>;
  publish: (slug: string, doc: ContentDocument) => Promise<ContentActionResult>;
  discard: (slug: string) => Promise<ContentActionResult>;
}

/** An id the schema accepts (letters, digits, "-"), unique enough within a page. */
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const emptyBlock = (type: ContentBlockType): ContentBlock => {
  switch (type) {
    case "markdown":
      return { type, id: newId("texto"), text: "" };
    case "faq":
      return { type, id: newId("grupo"), title: "", items: [{ id: newId("p"), question: "", answer: "" }] };
    case "list":
      return { type, id: newId("lista"), title: "", style: "steps", items: [{ id: newId("i"), title: "", text: "" }] };
  }
};

function moved<T>(list: T[], index: number, direction: "up" | "down"): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

// ---------------------------------------------------------------------------
// Keyboard focus across re-renders: a moved row's button keeps the focus
// (or the other one when the row reached an end); a removed row hands it to
// the "Agregar" button of its list.
// ---------------------------------------------------------------------------

interface FocusRegistry {
  register: (key: string) => (element: HTMLElement | null) => void;
  focusAfterRender: (key: string) => void;
  announce: (message: string) => void;
  /** The polite live region's element (Announcer). */
  live: (element: HTMLElement | null) => void;
}

const FocusContext = createContext<FocusRegistry | null>(null);

function createFocusRegistry(): FocusRegistry & { flush: () => void } {
  const elements = new Map<string, HTMLElement>();
  let pending: string | null = null;
  let live: HTMLElement | null = null;
  return {
    register: (key) => (element) => {
      if (element) elements.set(key, element);
      else elements.delete(key);
    },
    focusAfterRender: (key) => {
      pending = key;
    },
    announce: (message) => {
      if (live) live.textContent = message;
    },
    flush: () => {
      const key = pending;
      pending = null;
      if (key) elements.get(key)?.focus();
    },
    live: (element) => {
      live = element;
    },
  };
}
const useFocusRegistry = () => useContext(FocusContext)!;

/** Where moves and removals are announced (a polite live region). */
function Announcer() {
  const { live } = useFocusRegistry();
  return <span ref={live} role="status" className="sr-only" data-testid="content-announcement" />;
}

interface RowControlsProps {
  /** The row's name in the buttons ("pregunta 2", "bloque 3"). */
  name: string;
  /** Key of the row (its id): the buttons register under it. */
  rowKey: string;
  index: number;
  total: number;
  /** The key of the control that takes the focus when the row is removed. */
  afterRemove: string;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
  /** At least one row must stay (a FAQ group needs a question). */
  minRows?: number;
}

function RowControls({ name, rowKey, index, total, afterRemove, onMove, onRemove, minRows = 0 }: RowControlsProps) {
  const { register, focusAfterRender, announce } = useFocusRegistry();
  const hydrated = useHydrated();
  const move = (direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    const atEnd = target === 0 || target === total - 1;
    focusAfterRender(`${rowKey}:${atEnd ? (direction === "up" ? "down" : "up") : direction}`);
    onMove(direction);
    announce(`${name} quedó en el lugar ${target + 1} de ${total}`);
  };
  return (
    <span className="flex shrink-0 gap-1">
      <IconButton ref={register(`${rowKey}:up`)} type="button" size="icon-sm" variant="ghost" label={`Subir ${name}`} disabled={index === 0 || !hydrated} onClick={() => move("up")}>
        <ArrowUp aria-hidden="true" />
      </IconButton>
      <IconButton
        ref={register(`${rowKey}:down`)}
        type="button"
        size="icon-sm"
        variant="ghost"
        label={`Bajar ${name}`}
        disabled={index === total - 1 || !hydrated}
        onClick={() => move("down")}
      >
        <ArrowDown aria-hidden="true" />
      </IconButton>
      <IconButton
        type="button"
        size="icon-sm"
        variant="ghost"
        label={`Quitar ${name}`}
        disabled={total <= minRows || !hydrated}
        onClick={() => {
          focusAfterRender(afterRemove);
          onRemove();
          announce(`Quitaste ${name}`);
        }}
      >
        <Trash2 aria-hidden="true" />
      </IconButton>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Block editors
// ---------------------------------------------------------------------------

function MarkdownBlockFields({ block, onChange, label }: { block: Extract<ContentBlock, { type: "markdown" }>; onChange: (block: ContentBlock) => void; label: string }) {
  return (
    <Field
      label={`Texto de ${label}`}
      hint={
        <>
          Markdown: <code>## Título</code>, <code>- ítem</code>, <code>**negrita**</code>, <code>[texto](/ruta)</code>, tablas con <code>|</code>. Sin HTML.{" "}
          {block.text.length.toLocaleString("es-AR")} / {L.markdown.toLocaleString("es-AR")}.
        </>
      }
    >
      <Textarea
        rows={12}
        value={block.text}
        maxLength={L.markdown}
        spellCheck
        className="font-mono text-label"
        onChange={(event) => onChange({ ...block, text: event.target.value })}
      />
    </Field>
  );
}

function FaqBlockFields({ block, onChange, label }: { block: FaqBlock; onChange: (block: ContentBlock) => void; label: string }) {
  const { register, focusAfterRender } = useFocusRegistry();
  const addKey = `${block.id}:add`;
  const setItems = (items: FaqBlock["items"]) => onChange({ ...block, items });
  return (
    <div className="space-y-4">
      <Field label={`Título de ${label}`}>
        <Input value={block.title} maxLength={L.blockTitle} onChange={(event) => onChange({ ...block, title: event.target.value })} />
      </Field>
      <ol className="space-y-3">
        {block.items.map((item, index) => {
          const name = `pregunta ${index + 1} de ${label}`;
          const update = (patch: Partial<typeof item>) => setItems(block.items.map((other) => (other.id === item.id ? { ...other, ...patch } : other)));
          return (
            <li key={item.id} className="space-y-3 rounded-xl border border-border bg-bg-subtle p-3" data-testid="faq-item-editor">
              <div className="flex items-start gap-2">
                <Field label={`Pregunta ${index + 1}`} className="min-w-0 flex-1">
                  <Input
                    ref={register(`${item.id}:question`) as React.Ref<HTMLInputElement>}
                    value={item.question}
                    maxLength={L.question}
                    onChange={(event) => update({ question: event.target.value })}
                  />
                </Field>
                <span className="pt-7">
                  <RowControls
                    name={name}
                    rowKey={item.id}
                    index={index}
                    total={block.items.length}
                    afterRemove={addKey}
                    minRows={1}
                    onMove={(direction) => setItems(moved(block.items, index, direction))}
                    onRemove={() => setItems(block.items.filter((other) => other.id !== item.id))}
                  />
                </span>
              </div>
              <Field label={`Respuesta ${index + 1}`} hint="Markdown: negrita, enlaces y listas.">
                <Textarea rows={3} value={item.answer} maxLength={L.answer} onChange={(event) => update({ answer: event.target.value })} />
              </Field>
            </li>
          );
        })}
      </ol>
      <Button
        ref={register(addKey) as React.Ref<HTMLButtonElement>}
        type="button"
        variant="secondary"
        size="sm"
        disabled={block.items.length >= L.faqItems}
        onClick={() => {
          const item = { id: newId("p"), question: "", answer: "" };
          setItems([...block.items, item]);
          focusAfterRender(`${item.id}:question`);
        }}
      >
        <Plus aria-hidden="true" />
        Agregar pregunta
      </Button>
    </div>
  );
}

function ListBlockFields({ block, onChange, label }: { block: ListBlock; onChange: (block: ContentBlock) => void; label: string }) {
  const { register } = useFocusRegistry();
  const addKey = `${block.id}:add`;
  const setItems = (items: ListBlock["items"]) => onChange({ ...block, items });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Título de ${label}`} hint="Opcional.">
          <Input value={block.title} maxLength={L.blockTitle} onChange={(event) => onChange({ ...block, title: event.target.value })} />
        </Field>
        <Field label="Cómo se ve">
          <RadioGroup value={block.style} onValueChange={(value) => onChange({ ...block, style: value === "cards" ? "cards" : "steps" })} className="flex flex-wrap gap-4">
            <RadioGroupItem value="steps" label="Pasos numerados" />
            <RadioGroupItem value="cards" label="Tarjetas" />
          </RadioGroup>
        </Field>
      </div>
      <ol className="space-y-3">
        {block.items.map((item, index) => {
          const name = `ítem ${index + 1} de ${label}`;
          const update = (patch: Partial<typeof item>) => setItems(block.items.map((other) => (other.id === item.id ? { ...other, ...patch } : other)));
          return (
            <li key={item.id} className="rounded-xl border border-border bg-bg-subtle p-3">
              <div className="flex items-start gap-2">
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <Field label={`Título ${index + 1}`}>
                    <Input value={item.title} maxLength={L.itemTitle} onChange={(event) => update({ title: event.target.value })} />
                  </Field>
                  <Field label={`Texto ${index + 1}`}>
                    <Input value={item.text} maxLength={L.itemText} onChange={(event) => update({ text: event.target.value })} />
                  </Field>
                </div>
                <span className="pt-7">
                  <RowControls
                    name={name}
                    rowKey={item.id}
                    index={index}
                    total={block.items.length}
                    afterRemove={addKey}
                    minRows={1}
                    onMove={(direction) => setItems(moved(block.items, index, direction))}
                    onRemove={() => setItems(block.items.filter((other) => other.id !== item.id))}
                  />
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        ref={register(addKey) as React.Ref<HTMLButtonElement>}
        type="button"
        variant="secondary"
        size="sm"
        disabled={block.items.length >= L.listItems}
        onClick={() => setItems([...block.items, { id: newId("i"), title: "", text: "" }])}
      >
        <Plus aria-hidden="true" />
        Agregar ítem
      </Button>
    </div>
  );
}

const BLOCK_ICONS: Record<ContentBlockType, ReactNode> = {
  markdown: <FileText aria-hidden="true" />,
  faq: <HelpCircle aria-hidden="true" />,
  list: <ListOrdered aria-hidden="true" />,
};

/** "Agregar bloque": one button per block type (the first takes the focus after a block is removed). */
function AddBlockButtons({ disabled, onAdd }: { disabled: boolean; onAdd: (type: ContentBlockType) => void }) {
  const { register } = useFocusRegistry();
  const hydrated = useHydrated();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-label font-medium text-fg-secondary">Agregar bloque:</span>
      {(Object.keys(CONTENT_BLOCK_LABELS) as ContentBlockType[]).map((type, index) => (
        <Button
          key={type}
          ref={index === 0 ? (register("add-block") as React.Ref<HTMLButtonElement>) : undefined}
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || !hydrated}
          onClick={() => onAdd(type)}
        >
          <Plus aria-hidden="true" />
          {CONTENT_BLOCK_LABELS[type]}
        </Button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

/**
 * /admin/contenido/<slug>: the page's title, lead and blocks, a preview made
 * with the public page's own components (placeholders filled with the
 * current settings), and "Guardar borrador" / "Publicar" / "Descartar
 * borrador". The server validates the whole document again (zod) and
 * records each action in the audit log. Leaving with unsaved changes asks
 * first.
 */
export function ContentEditor({ page, initial, published, settings, save, publish, discard }: ContentEditorProps) {
  const [doc, setDoc] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [problem, setProblem] = useState<{ error: string; issues?: string[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const hydrated = useHydrated();
  const dirty = !sameContent(doc, saved);
  const unpublished = !published || !sameContent(doc, published);

  // Focus registry (see RowControls): created once, holds the elements in its own closure.
  const [registry] = useState(createFocusRegistry);
  useEffect(() => registry.flush(), [doc, registry]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setBlocks = useCallback((blocks: ContentBlock[]) => setDoc((current) => ({ ...current, blocks })), []);
  const updateBlock = (block: ContentBlock) => setDoc((current) => ({ ...current, blocks: current.blocks.map((other) => (other.id === block.id ? block : other)) }));

  const run = (kind: "save" | "publish" | "discard") => {
    if (pending) return;
    setProblem(null);
    startTransition(async () => {
      try {
        const result = kind === "save" ? await save(page.slug, doc) : kind === "publish" ? await publish(page.slug, doc) : await discard(page.slug);
        if (!result.ok) {
          setProblem({ error: result.error, issues: result.issues });
          return;
        }
        if (kind === "discard" && published) {
          setDoc(published);
          setSaved(published);
        } else {
          setSaved(doc);
        }
        showToast.success(result.message);
      } catch {
        showToast.error("No pudimos guardar. Revisa tu conexión e inténtalo de nuevo.");
      }
    });
  };

  const preview = fillDocument(doc, settings);

  return (
    <FocusContext.Provider value={registry}>
      <div className="space-y-6">
        <div className="sticky top-20 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-sm backdrop-blur-md">
          <span className="flex flex-wrap items-center gap-2 text-label" data-testid="content-state">
            {dirty ? <Badge variant="warning">Cambios sin guardar</Badge> : unpublished ? <Badge variant="warning">Borrador sin publicar</Badge> : <Badge variant="success">Publicada</Badge>}
          </span>
          <span className="ms-auto flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => run("discard")} disabled={!hydrated || pending || !published || (!unpublished && !dirty)}>
              <Undo2 aria-hidden="true" />
              Descartar borrador
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => run("save")} disabled={!hydrated || pending || !dirty} data-testid="content-save">
              <Save aria-hidden="true" />
              Guardar borrador
            </Button>
            <Button type="button" size="sm" onClick={() => run("publish")} loading={pending} disabled={!hydrated || (!unpublished && !dirty)} data-testid="content-publish">
              {pending ? null : <Upload aria-hidden="true" />}
              {pending ? "Guardando…" : "Publicar"}
            </Button>
          </span>
        </div>

        {problem ? (
          <FormAlert>
            {problem.error}
            {problem.issues && problem.issues.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {problem.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </FormAlert>
        ) : null}
        <Announcer />

        <Tabs value={tab} onValueChange={(value) => setTab(value === "preview" ? "preview" : "edit")}>
          <TabsList aria-label="Editor de contenido">
            <TabsTrigger value="edit">Editar</TabsTrigger>
            <TabsTrigger value="preview">Vista previa</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-6">
            <Card>
              <CardContent className="space-y-5">
                <Field label="Título" hint="El título de la página (h1)." required>
                  <Input value={doc.title} maxLength={L.title} onChange={(event) => setDoc({ ...doc, title: event.target.value })} data-testid="content-title" />
                </Field>
                <Field label="Introducción" hint="Debajo del título. Admite enlaces [texto](/ruta) y **negrita**." required>
                  <Textarea rows={2} value={doc.description} maxLength={L.description} onChange={(event) => setDoc({ ...doc, description: event.target.value })} />
                </Field>
              </CardContent>
            </Card>

            <ol className="space-y-4" aria-label="Bloques de la página">
              {doc.blocks.map((block, index) => {
                const label = `bloque ${index + 1}`;
                return (
                  <li key={block.id}>
                    <Card data-testid="content-block">
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bg-muted text-fg-secondary [&_svg]:size-4">
                            {BLOCK_ICONS[block.type]}
                          </span>
                          <h3 className="min-w-0 flex-1 text-body font-semibold text-fg">
                            Bloque {index + 1} · {CONTENT_BLOCK_LABELS[block.type]}
                          </h3>
                          <RowControls
                            name={label}
                            rowKey={block.id}
                            index={index}
                            total={doc.blocks.length}
                            afterRemove="add-block"
                            onMove={(direction) => setBlocks(moved(doc.blocks, index, direction))}
                            onRemove={() => setBlocks(doc.blocks.filter((other) => other.id !== block.id))}
                          />
                        </div>
                        {block.type === "markdown" ? (
                          <MarkdownBlockFields block={block} onChange={updateBlock} label={label} />
                        ) : block.type === "faq" ? (
                          <FaqBlockFields block={block} onChange={updateBlock} label={label} />
                        ) : (
                          <ListBlockFields block={block} onChange={updateBlock} label={label} />
                        )}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ol>

            <AddBlockButtons disabled={doc.blocks.length >= L.blocks} onAdd={(type) => setBlocks([...doc.blocks, emptyBlock(type)])} />
          </TabsContent>

          <TabsContent value="preview">
            <section aria-label="Vista previa de la página" className="rounded-2xl border border-dashed border-border-strong bg-bg p-5 sm:p-8" data-testid="content-preview">
              <p className="mb-6 text-caption font-semibold tracking-wider text-fg-muted uppercase">Vista previa · {page.path}</p>
              <p className="text-headline text-fg">{preview.title || "Sin título"}</p>
              {preview.description ? (
                <p className="mt-3 mb-10 max-w-2xl text-title font-normal text-fg-secondary [&_a]:font-medium [&_a]:text-info [&_a]:underline">
                  <Markdown inline>{preview.description}</Markdown>
                </p>
              ) : null}
              {page.layout === "legal" ? <ContentTableOfContents blocks={preview.blocks} /> : null}
              <ContentBlocks blocks={preview.blocks} legal={page.layout === "legal"} />
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </FocusContext.Provider>
  );
}
