---
title: XML Helpers
description: Bun-native XML helpers for libvirt documents.
---

Thin wrappers over `Bun.XML.parse` / `Bun.XML.stringify` plus helpers for the compact shape they use (attributes as `@name` keys, character data as `#text` or a bare string, repeated elements as arrays). Used internally by the domain, network, and storage modules; useful when handling raw XML from `*-dumpxml` yourself.

```ts
import {
  asArray,
  childElement,
  childText,
  isXmlElement,
  parseXmlDocument,
  stringifyXmlDocument,
  xmlAttr,
  xmlText,
} from '@sysopkit/libvirt/xml';
```

## parseXmlDocument()

Parses an XML 1.0 document into the compact shape. Throws `SyntaxError` when the document is not well-formed.

```ts
const doc = parseXmlDocument('<domain type="kvm"><name>guest</name></domain>');
// { domain: { '@type': 'kvm', name: 'guest' } }
```

## stringifyXmlDocument()

Serializes a single-root document to XML markup (no XML declaration). Throws when the value cannot be represented as well-formed XML.

```ts
stringifyXmlDocument({ domain: { '@type': 'kvm', 'name': 'guest' } });
// '<domain type="kvm"><name>guest</name></domain>'
```

## Helpers

- `asArray(value)` — normalizes a one-or-many value into an array (`undefined`/`null` become `[]`).
- `isXmlElement(value)` — type guard distinguishing elements from bare text.
- `childElement(el, name)` — returns the named child (throws on repeats; use `asArray` for those).
- `childText(el, name)` — character data of the named child, handling both bare-string and attributed elements.
- `xmlAttr(el, name)` — attribute value lookup.
- `xmlText(value)` — character data of an element value.

## Configuration types

```ts
import type { XmlDocument, XmlElement, XmlValue, MutableXmlElement } from '@sysopkit/libvirt/xml';
```

- `XmlDocument` — parsed document (exactly one root key); `XmlElement` — compact-shape element; `XmlValue` — text, element, or array of values.
- `MutableXmlElement` — builder variant with a writable index signature for constructing documents.
