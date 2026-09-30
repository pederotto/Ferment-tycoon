import { OPEN, CLOSE } from './engine';
import { translator } from './runtime';

/**
 * Translates what is about to be drawn. Used by the JSX runtime wrappers for
 * host elements (div, span, button, …) and fragments only: a custom component's
 * children are left for the host element that finally draws them, so a component
 * that reads its own children is never handed a translation.
 */
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'label'] as const;
const HAS_LETTER = /[A-Za-zÀ-ɏ]/;
const SENTINEL = new RegExp(`${OPEN}(\\d+)${CLOSE}`);

const tr = (s: string): string => (translator as NonNullable<typeof translator>).tr(s);

export function localizeChildren(children: unknown): unknown {
  if (typeof children === 'string') return tr(children);
  if (!Array.isArray(children)) return children;

  let hasText = false;
  let flat = true;
  for (const c of children) {
    if (typeof c === 'string') { if (HAS_LETTER.test(c)) hasText = true; }
    else if (Array.isArray(c)) flat = false;
    else if (c && typeof c === 'object' && (c as { key?: unknown }).key != null) flat = false;
  }

  // Whole-template pass: text and values are one sentence ("Chapter {0} · {1}"),
  // with each element child held as a marker so a translation can reorder them.
  if (hasText && flat) {
    let whole = '';
    const others: unknown[] = [];
    for (const c of children) {
      if (typeof c === 'string') whole += c;
      else if (typeof c === 'number') whole += String(c);
      else if (c && typeof c === 'object') { whole += OPEN + others.length + CLOSE; others.push(c); }
    }
    const out = (translator as NonNullable<typeof translator>).trFlat(whole);
    if (out !== whole) {
      const parts = out.split(new RegExp(`(${OPEN}\\d+${CLOSE})`));
      const rebuilt: unknown[] = [];
      for (const part of parts) {
        const m = SENTINEL.exec(part);
        if (m) rebuilt.push(others[Number(m[1])]);
        else if (part) rebuilt.push(part);
      }
      return rebuilt;
    }
  }

  // Piece by piece: each string on its own, nested lists recursed into.
  let changed = false;
  const next = children.map(c => {
    const t = typeof c === 'string' ? tr(c) : Array.isArray(c) ? localizeChildren(c) : c;
    if (t !== c) changed = true;
    return t;
  });
  return changed ? next : children;
}

export function localizeProps<P extends Record<string, unknown>>(type: unknown, props: P, fragment: unknown): P {
  const host = typeof type === 'string';
  if (!host && type !== fragment) return props;
  let out = props;
  if (props.children !== undefined) {
    const c = localizeChildren(props.children);
    if (c !== props.children) out = { ...props, children: c };
  }
  if (host) {
    for (const a of ATTRS) {
      const v = props[a];
      if (typeof v === 'string') {
        const t = tr(v);
        if (t !== v) { if (out === props) out = { ...props }; (out as Record<string, unknown>)[a] = t; }
      }
    }
  }
  return out;
}
