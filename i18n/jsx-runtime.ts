import * as React from 'react/jsx-runtime';
import { translator } from './runtime';
import { localizeProps } from './localize';

/**
 * The JSX runtime the compiler imports (vite.config.ts: jsxImportSource). In
 * English these ARE React's own functions. In another language each call first
 * translates the text it is about to draw (i18n/localize.ts).
 */
export const Fragment = React.Fragment;

type Jsx = (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
const real = React as unknown as { jsx: Jsx; jsxs: Jsx };

export const jsx: Jsx = translator
  ? (type, props, key) => real.jsx(type, localizeProps(type, props, Fragment), key)
  : real.jsx;
export const jsxs: Jsx = translator
  ? (type, props, key) => real.jsxs(type, localizeProps(type, props, Fragment), key)
  : real.jsxs;
