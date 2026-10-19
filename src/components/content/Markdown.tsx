import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { LegalHeading } from "@/lib/content/text";
import { cn } from "@/lib/utils";

/*
 * The info pages' Markdown (an admin writes it in /admin/contenido),
 * rendered safely: react-markdown builds React elements from the Markdown
 * syntax tree, never HTML strings. Raw HTML in the text is dropped
 * (skipHtml), images are not rendered (pictures go through the uploads,
 * not the text), and links keep only safe destinations: site paths and
 * anchors, http(s), mailto and tel. Everything else loses its href.
 *
 * Works in Server Components (the pages) and in the browser (the editor's
 * preview): no hooks, no state.
 */

/** A link destination the text may use, or "" (the link renders as plain text). */
export function safeHref(url: string): string {
  const value = url.trim();
  if (value.startsWith("#")) return value;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    const parsed = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

type AnchorProps = ComponentProps<"a"> & ExtraProps;

function MarkdownLink(allProps: AnchorProps) {
  const { href = "", children, ...props } = domProps(allProps);
  if (!href) return <span>{children}</span>;
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    );
  }
  const external = /^https?:/.test(href);
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...props}>
      {children}
      {external ? <span className="sr-only"> (se abre en una pestaña nueva)</span> : null}
    </a>
  );
}

/** A component's props without react-markdown's `node` (and the inline `style` GFM puts on aligned cells). */
function domProps<P extends ExtraProps & { style?: unknown }>(props: P): Omit<P, "node" | "style"> {
  const rest: Record<string, unknown> = { ...props };
  delete rest.node;
  delete rest.style;
  return rest as Omit<P, "node" | "style">;
}

const tableComponents: Components = {
  table: (props) => (
    <div className="my-6 overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-left text-label font-normal" {...domProps(props)} />
    </div>
  ),
  thead: (props) => <thead className="bg-bg-muted text-fg" {...domProps(props)} />,
  tbody: (props) => <tbody className="divide-y divide-border bg-surface text-fg-secondary" {...domProps(props)} />,
  th: (props) => <th scope="col" className="px-4 py-3 font-semibold" {...domProps(props)} />,
  td: (props) => <td className="px-4 py-3" {...domProps(props)} />,
};

interface MarkdownProps {
  children: string;
  /**
   * The legal pages' numbered sections: each `## ` heading of this block
   * gets its anchor and number from here, by its line (src/lib/content/text.ts).
   */
  headings?: LegalHeading[];
  /** Only inline marks (links, bold, italics): a lead or a short answer kept on one line. */
  inline?: boolean;
  className?: string;
}

const INLINE_ELEMENTS = ["p", "a", "strong", "em", "del", "code", "br"];

export function Markdown({ children, headings, inline = false, className }: MarkdownProps): ReactNode {
  const byLine = new Map((headings ?? []).map((heading) => [heading.line, heading]));
  const components: Components = {
    ...tableComponents,
    a: MarkdownLink,
    // The page has its h1: a "#" in the text is a section like "##".
    h1: (props) => <h2 {...domProps(props)} />,
    h2: (props) => {
      const { children: content, ...rest } = domProps(props);
      const heading = props.node?.position ? byLine.get(props.node.position.start.line) : undefined;
      if (!heading) return <h2 {...rest}>{content}</h2>;
      return (
        <h2 id={heading.id} className="scroll-mt-28" {...rest}>
          {heading.number}. {content}
        </h2>
      );
    },
    h4: (props) => <h3 {...domProps(props)} />,
    h5: (props) => <h3 {...domProps(props)} />,
    h6: (props) => <h3 {...domProps(props)} />,
    ...(inline ? { p: ({ children: content }) => <>{content}</> } : {}),
  };
  const markdown = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={components}
      urlTransform={safeHref}
      // react-markdown takes one of the two lists: inline text keeps only its marks, the rest drops images.
      {...(inline ? { allowedElements: INLINE_ELEMENTS, unwrapDisallowed: true } : { disallowedElements: ["img"] })}
    >
      {children}
    </ReactMarkdown>
  );
  return className ? <div className={cn(className)}>{markdown}</div> : markdown;
}
