/**
 * @module xml
 *
 * Bun-native XML helpers for libvirt document handling.
 *
 * Parsing and serialization delegate to `Bun.XML.parse` /
 * `Bun.XML.stringify`, so this module (and the whole package) only runs on
 * the Bun runtime.
 *
 * `Bun.XML` uses the compact shape by default: attributes are `@name` keys,
 * character data is the `#text` key (or a bare string when the element has
 * neither attributes nor child elements), and a child element name occurring
 * more than once holds an array in document order.
 */

import { XML } from 'bun';

/** Compact-shape XML value: character data, an element, or repeated elements. */
export type XmlValue = string | XmlElement | XmlValue[];

/**
 * Compact-shape XML element.
 *
 * - `"@name"` — one key per attribute, holding its value.
 * - `"#text"` — the element's own character data.
 * - any other key — a child element name.
 */
export interface XmlElement {
  readonly [key: string]: XmlValue | undefined;
}

/**
 * Mutable compact-shape XML element for building documents.
 *
 * `XmlElement` is read-only through its index signature; use this alias
 * while constructing nodes, then pass the result where `XmlElement` or
 * `XmlDocument` is expected.
 */
export type MutableXmlElement = { [key: string]: XmlValue | undefined };

/** Parsed document: exactly one key naming the root element. */
export interface XmlDocument {
  readonly [rootName: string]: XmlValue | undefined;
}

/**
 * Parses an XML 1.0 document into the compact shape.
 *
 * Throws `SyntaxError` when the document is not well-formed.
 */
export function parseXmlDocument(content: string): XmlDocument {
  return XML.parse(content) as unknown as XmlDocument;
}

/**
 * Serializes a single-root document to XML markup (no XML declaration).
 *
 * Throws when the value cannot be represented as well-formed XML.
 */
export function stringifyXmlDocument(doc: XmlDocument): string {
  const result = XML.stringify(doc);
  if (result === undefined) {
    throw new Error('failed to serialize XML document');
  }
  return result;
}

/**
 * Normalizes a one-or-many value into an array.
 *
 * `Bun.XML` returns a single value when a child element name occurs once and
 * an array when it occurs more than once; use this whenever iterating.
 */
export function asArray<T>(value: T | readonly T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }
  const single = value as T | T[];
  return Array.isArray(single) ? [...single] : [single];
}

/** Type guard for compact-shape elements (as opposed to bare text). */
export function isXmlElement(value: XmlValue | undefined): value is XmlElement {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns the named child element, or undefined when absent.
 *
 * Throws when the child occurs more than once; use `asArray` for repeats.
 */
export function childElement(
  el: XmlElement | undefined,
  name: string,
): XmlElement | string | undefined {
  if (el === undefined) {
    return undefined;
  }
  const value = el[name];
  if (Array.isArray(value)) {
    throw new Error(`expected a single <${name}> element`);
  }
  return value;
}

/**
 * Returns the character data of the named child element.
 *
 * Handles both bare-string elements (`<name>text</name>`) and attributed
 * elements (`<memory unit="MiB">2048</memory>`). Returns undefined when the
 * child is absent or has no text.
 */
export function childText(el: XmlElement | undefined, name: string): string | undefined {
  const child = childElement(el, name);
  if (child === undefined) {
    return undefined;
  }
  if (typeof child === 'string') {
    return child === '' ? undefined : child;
  }
  const text = child['#text'];
  if (typeof text !== 'string' || text === '') {
    return undefined;
  }
  return text;
}

/** Returns the named attribute of an element, or undefined when absent. */
export function xmlAttr(el: XmlElement | undefined, name: string): string | undefined {
  if (el === undefined) {
    return undefined;
  }
  const value = el[`@${name}`];
  return typeof value === 'string' ? value : undefined;
}

/** Returns the character data of an element value (bare or `#text`). */
export function xmlText(value: XmlValue | undefined): string | undefined {
  if (typeof value === 'string') {
    return value === '' ? undefined : value;
  }
  if (isXmlElement(value)) {
    const text = value['#text'];
    if (typeof text === 'string' && text !== '') {
      return text;
    }
  }
  return undefined;
}
