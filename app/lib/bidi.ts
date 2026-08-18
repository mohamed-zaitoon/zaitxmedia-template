/** Keeps Latin currency/number fragments in their intended order inside RTL text. */
export const isolateLtr = (value: string | number): string =>
  `\u2066${String(value)}\u2069`;
