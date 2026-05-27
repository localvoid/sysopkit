/**
 * Branded symbol type for type-safe events.
 */
export type Event<T> = symbol & {
  readonly __value?: T;
  readonly __type?: 'sysopkit.event';
};

/**
 * Describes a state change to a resource, used by the CHANGE_EVENT.
 *
 * Fields:
 * - `type`: category of the changed resource (e.g. "file", "package")
 * - `resource`: identifier of the changed resource
 * - `property`: optional sub-property that changed
 * - `from`/`to`: previous and new values (omitted for create/delete)
 */
export interface ChangeEntry {
  readonly type: string;
  readonly resource: string;
  readonly property?: string;
  readonly from?: string;
  readonly to?: string;
}

/** Event emitted when a resource state changes. Create: `from` omitted; delete: `to` omitted; update: both present. */
export const CHANGE_EVENT: Event<ChangeEntry | ChangeEntry[]> = Symbol('sysopkit.event.change');
