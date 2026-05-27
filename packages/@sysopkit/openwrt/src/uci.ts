export type UciConfig<T extends string> = UciSection<T>[];

export interface UciSection<T extends string> {
  readonly type: T;
  readonly name?: string;
  readonly options?: Record<string, string | number>;
  readonly lists?: Record<string, string[]>;
}

export function serializeUci<T extends string>(config: UciConfig<T>): string {
  let s = '';
  for (const section of config) {
    s += `config ${section.type}${section.name ? ` '${section.name}'` : ''}\n`;

    if (section.options) {
      for (const [key, value] of Object.entries(section.options)) {
        s += `\toption ${key} '${value}'\n`;
      }
    }

    if (section.lists) {
      for (const [key, values] of Object.entries(section.lists)) {
        for (const val of values) {
          s += `\tlist ${key} '${val}'\n`;
        }
      }
    }
    s += '\n';
  }
  return s;
}
