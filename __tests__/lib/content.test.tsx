import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { seedContent } from "@/data/content";
import { CONTENT_SLUGS } from "@/lib/content/pages";
import { fillDocument, legalHeadings, markdownToText } from "@/lib/content/text";
import { DEFAULT_STORE_SETTINGS } from "@/lib/settings/defaults";
import { fillPlaceholders } from "@/lib/settings/placeholders";
import { contentDocumentSchema, parseContentDocument } from "@/lib/validations/content";
import { Markdown, safeHref } from "@/components/content/Markdown";
import { ContentBlocks } from "@/components/content/ContentBlocks";

describe("the seed's content", () => {
  it("has a valid document for every info page", () => {
    expect(Object.keys(seedContent).sort()).toEqual([...CONTENT_SLUGS].sort());
    for (const doc of Object.values(seedContent)) expect(contentDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("writes the settings' figures as placeholders, never as numbers", () => {
    const faq = JSON.stringify(seedContent.faq);
    expect(faq).toContain("{{costo_envio}}");
    expect(faq).not.toMatch(/\$\s?299|5\.000/);
  });
});

describe("the content schema", () => {
  const doc = { title: "Ayuda", description: "Hola", blocks: [{ type: "markdown", id: "a", text: "Texto" }] };

  it("refuses unknown block types, empty answers, repeated ids and oversized texts", () => {
    expect(parseContentDocument(doc)).toEqual(doc);
    expect(parseContentDocument({ ...doc, blocks: [{ type: "html", id: "a", html: "<script>" }] })).toBeNull();
    expect(parseContentDocument({ ...doc, blocks: [{ type: "faq", id: "f", title: "T", items: [{ id: "q", question: "¿Sí?", answer: " " }] }] })).toBeNull();
    expect(parseContentDocument({ ...doc, blocks: [doc.blocks[0], doc.blocks[0]] })).toBeNull();
    expect(parseContentDocument({ ...doc, title: "x".repeat(121) })).toBeNull();
    expect(parseContentDocument({ ...doc, blocks: [{ type: "markdown", id: "a b", text: "x" }] })).toBeNull();
  });
});

describe("placeholders", () => {
  it("fill the known names with the settings and leave the rest alone", () => {
    const settings = { ...DEFAULT_STORE_SETTINGS, shipping: { cost: 450, freeFrom: 8000 } };
    expect(fillPlaceholders("Envío {{ costo_envio }}, gratis desde {{envio_gratis_desde}} {{otra}}", settings)).toMatch(
      /^Envío \$\s450, gratis desde \$\s8\.000 \{\{otra\}\}$/
    );
    const filled = fillDocument(seedContent.faq, settings);
    expect(JSON.stringify(filled)).not.toContain("{{costo_envio}}");
  });
});

describe("markdownToText", () => {
  it("keeps the words of links and drops the marks", () => {
    expect(markdownToText("Sí, **gratis** en [Envíos](/envios).\n\n- uno\n- dos")).toBe("Sí, gratis en Envíos. uno dos");
  });
});

describe("legalHeadings", () => {
  it("numbers the ## headings across blocks with unique anchors, skipping code", () => {
    const headings = legalHeadings([
      { type: "markdown", id: "a", text: "## Qué datos usamos\n\ntexto\n\n```\n## no\n```\n## Tus derechos" },
      { type: "list", id: "l", title: "x", style: "steps", items: [{ id: "i", title: "t", text: "t" }] },
      { type: "markdown", id: "b", text: "## Tus derechos" },
    ]);
    expect(headings.map(({ id, number, blockId, line }) => ({ id, number, blockId, line }))).toEqual([
      { id: "que-datos-usamos", number: 1, blockId: "a", line: 1 },
      { id: "tus-derechos", number: 2, blockId: "a", line: 8 },
      { id: "tus-derechos-2", number: 3, blockId: "b", line: 1 },
    ]);
  });
});

describe("<Markdown>", () => {
  it("never renders raw HTML or scripts", () => {
    const { container } = render(<Markdown>{'Hola <img src=x onerror="alert(1)"> <script>alert(1)</script> <b>negrita</b>'}</Markdown>);
    expect(container.querySelector("img, script, b")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
  });

  it("keeps only safe link destinations", () => {
    render(<Markdown>{"[mal](javascript:alert(1)) [datos](data:text/html,x) [ayuda](/faq) [lego](https://www.lego.com) [mail](mailto:hola@legostore.com)"}</Markdown>);
    expect(screen.queryByRole("link", { name: "mal" })).toBeNull();
    expect(screen.getByText("mal").closest("a")).toBeNull();
    expect(screen.queryByRole("link", { name: "datos" })).toBeNull();
    expect(screen.getByRole("link", { name: "ayuda" })).toHaveAttribute("href", "/faq");
    const external = screen.getByRole("link", { name: /lego/ });
    expect(external).toHaveAttribute("rel", "noopener noreferrer");
    expect(external).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "mail" })).toHaveAttribute("href", "mailto:hola@legostore.com");
    expect(safeHref("//evil.example/x")).toBe("");
    expect(safeHref("  JAVASCRIPT:alert(1)")).toBe("");
  });

  it("renders a table with headers and drops images", () => {
    const { container } = render(<Markdown>{"| Zona | Plazo |\n| --- | --- |\n| CABA | 1 a 3 días |\n\n![foto](/images/lego.png)"}</Markdown>);
    expect(screen.getByRole("columnheader", { name: "Zona" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "1 a 3 días" })).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("<ContentBlocks>", () => {
  it("shows the FAQ as disclosures and the legal sections numbered with anchors", () => {
    render(<ContentBlocks blocks={fillDocument(seedContent.faq, DEFAULT_STORE_SETTINGS).blocks} />);
    expect(screen.getByRole("heading", { level: 2, name: "Pedidos y pagos" })).toBeInTheDocument();
    expect(screen.getByText("¿Cuánto cuesta el envío?").closest("details")).not.toBeNull();

    render(<ContentBlocks blocks={seedContent.privacidad.blocks} legal />);
    expect(screen.getByRole("heading", { level: 2, name: "1. Qué datos usamos" })).toHaveAttribute("id", "que-datos-usamos");
  });
});
