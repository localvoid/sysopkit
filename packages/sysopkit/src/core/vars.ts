/**
 * Branded symbol type for typed context variables.
 *
 * Vars are looked up via `tryGet()`/`get()` which walk the parent context chain.
 */
export type Var<T> = symbol & {
  readonly __value?: T;
  readonly __type?: 'sysopkit.var';
};
