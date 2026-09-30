import * as React from 'react/jsx-dev-runtime';
import { translator } from './runtime';
import { localizeProps } from './localize';

/** The development twin of jsx-runtime.ts (Vite's dev server compiles to jsxDEV). */
export const Fragment = React.Fragment;

type JsxDev = (type: unknown, props: Record<string, unknown>, key: unknown, isStatic: boolean, source: unknown, self: unknown) => unknown;
const real = React as unknown as { jsxDEV: JsxDev };

export const jsxDEV: JsxDev = translator
  ? (type, props, key, isStatic, source, self) => real.jsxDEV(type, localizeProps(type, props, Fragment), key, isStatic, source, self)
  : real.jsxDEV;
