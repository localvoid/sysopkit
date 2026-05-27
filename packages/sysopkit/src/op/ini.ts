/**
 * @module op/ini
 *
 * INI-style configuration file parser and serializer.
 */

export interface IniSection {
  [key: string]: IniValue | IniValue[] | IniSection | IniSection[] | undefined;
}

export type IniValue = number | string;

/**
 * Serializes INI data back to string format.
 *
 * @param data - INI data to serialize
 * @returns Formatted INI string
 */
export function serializeIni<T extends IniSection>(data: T): string {
  const lines: string[] = [];
  _serializeSection(data, '', lines);
  let s = lines.join('\n');
  if (s !== '' && !s.endsWith('\n')) {
    s += '\n';
  }
  return s;
}

function _serializeSection(section: IniSection, sectionPrefix: string, lines: string[]): void {
  const append: string[] = [];
  for (const [key, value] of Object.entries(section)) {
    if (value !== void 0) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (entry !== void 0) {
            if (typeof entry === 'object') {
              append.push(`[${sectionPrefix}${key}]`);
              _serializeSection(entry, sectionPrefix, append);
              append.push('');
            } else {
              lines.push(`${key}=${entry}`);
            }
          }
        }
      } else if (typeof value === 'object') {
        append.push(`[${sectionPrefix}${key}]`);
        _serializeSection(value, sectionPrefix + key + '.', append);
        append.push('');
      } else {
        lines.push(`${key}=${value}`);
      }
    }
  }
  lines.push(...append);
}
