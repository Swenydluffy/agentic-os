"use client";

import { type ReactNode } from "react";
import { Check } from "lucide-react";

/**
 * A small, dependency-free Markdown renderer styled for this app. Supports the
 * subset used by the guide: headings, paragraphs, bold/italic/inline-code,
 * fenced code blocks, blockquotes, horizontal rules, links, ordered/unordered
 * lists, and GFM task lists (- [ ] / - [x]) rendered as real checkboxes.
 */
export function Markdown({ source }: { source: string }) {
  return <div className="space-y-4">{renderBlocks(source)}</div>;
}

type ListItem = { ordered: boolean; checked: boolean | null; text: string };

const LIST_RE = /^\s*([-*]|\d+\.)\s+/;
const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const HR_RE = /^---+\s*$/;
const QUOTE_RE = /^>\s?/;
const FENCE_RE = /^```/;

function isSpecial(line: string): boolean {
  return (
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    QUOTE_RE.test(line) ||
    FENCE_RE.test(line) ||
    LIST_RE.test(line)
  );
}

function parseListItem(line: string): ListItem {
  const ordered = /^\s*\d+\.\s+/.test(line);
  const body = line.replace(LIST_RE, "");
  const task = /^\[([ xX])\]\s+/.exec(body);
  if (task) {
    return { ordered, checked: task[1].toLowerCase() === "x", text: body.replace(/^\[[ xX]\]\s+/, "") };
  }
  return { ordered, checked: null, text: body };
}

function renderBlocks(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (FENCE_RE.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-[13px] leading-relaxed text-[var(--color-ink)]"
        >
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push(<hr key={key++} className="border-white/10" />);
      i++;
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      blocks.push(renderHeading(heading[1].length, heading[2], key++));
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        buf.push(lines[i].replace(QUOTE_RE, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="space-y-2 rounded-r-xl border-l-2 border-[var(--color-violet)] bg-white/[0.03] py-2 pl-4 pr-3 text-[var(--color-ink-dim)]"
        >
          {buf.map((b, bi) => (
            <p key={bi}>{inline(b)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    if (LIST_RE.test(line)) {
      const items: ListItem[] = [];
      while (i < lines.length && LIST_RE.test(lines[i])) {
        items.push(parseListItem(lines[i]));
        i++;
      }
      blocks.push(renderList(items, key++));
      continue;
    }

    // Paragraph — gather consecutive plain lines
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isSpecial(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="leading-relaxed text-[var(--color-ink-dim)]">
        {inline(buf.join(" "))}
      </p>,
    );
  }

  return blocks;
}

function renderHeading(level: number, text: string, key: number): ReactNode {
  const content = inline(text);
  if (level === 1) {
    return (
      <h1 key={key} className="hue pt-1 font-display text-3xl font-bold tracking-tight">
        {content}
      </h1>
    );
  }
  if (level === 2) {
    return (
      <h2 key={key} className="border-b border-white/10 pb-2 pt-3 font-display text-xl font-semibold text-white">
        {content}
      </h2>
    );
  }
  return (
    <h3 key={key} className="pt-2 font-display text-base font-semibold text-white">
      {content}
    </h3>
  );
}

function renderList(items: ListItem[], key: number): ReactNode {
  const ordered = items[0]?.ordered ?? false;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag key={key} className="space-y-1.5">
      {items.map((it, idx) => (
        <li key={idx} className="flex items-start gap-2.5 text-[var(--color-ink-dim)]">
          {it.checked === null ? (
            ordered ? (
              <span className="mt-0.5 shrink-0 font-mono text-xs text-[var(--color-cyan)]">{idx + 1}.</span>
            ) : (
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
            )
          ) : (
            <span
              className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border ${
                it.checked
                  ? "border-[var(--color-lime)] bg-[var(--color-lime)] text-[#04060d]"
                  : "border-white/25 text-transparent"
              }`}
            >
              <Check size={12} strokeWidth={3} />
            </span>
          )}
          <span className={it.checked ? "text-[var(--color-ink-faint)] line-through" : undefined}>
            {inline(it.text)}
          </span>
        </li>
      ))}
    </Tag>
  );
}

/** Inline formatting: **bold**, *italic*, `code`, and [links](url). */
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold text-white">
          {inline(m[2])}
        </strong>,
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <code
          key={key++}
          className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--color-cyan)]"
        >
          {m[3]}
        </code>,
      );
    } else if (m[4] !== undefined) {
      nodes.push(
        <em key={key++} className="italic text-[var(--color-ink)]">
          {inline(m[4])}
        </em>,
      );
    } else if (m[5] !== undefined && m[6] !== undefined) {
      nodes.push(
        <a
          key={key++}
          href={m[6]}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-cyan)] underline decoration-[var(--color-cyan)]/40 underline-offset-2 hover:decoration-[var(--color-cyan)]"
        >
          {m[5]}
        </a>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
