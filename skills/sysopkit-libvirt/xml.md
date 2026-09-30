# XML helpers: `@sysopkit/libvirt/xml`

Thin wrappers over `Bun.XML.parse` / `Bun.XML.stringify` plus helpers for the compact shape: attributes are `@name` keys, character data is `#text` (or a bare string when the element has neither attributes nor children), and a child name occurring more than once holds an **array** in document order.

```typescript
import {
  parseXmlDocument,
  stringifyXmlDocument,
  asArray,
  isXmlElement,
  childElement,
  childText,
  xmlAttr,
  xmlText,
} from '@sysopkit/libvirt/xml';
```

- `parseXmlDocument(xml)` → `{ [rootName]: XmlValue }`; throws `SyntaxError` on malformed XML.
- `stringifyXmlDocument(doc)` → markup without declaration; throws on unrepresentable values.
- `asArray(oneOrMany)` — normalize the single-vs-array ambiguity before iterating.
- `childElement(el, name)` — single child (throws on repeats); `childText(el, name)` — handles bare and attributed (`<memory unit="MiB">2048</memory>`) text, `''`/missing → `undefined`.
- `xmlAttr(el, name)`, `xmlText(value)`, `isXmlElement` guard.
- Types: `XmlDocument`, `XmlElement` (readonly index), `MutableXmlElement` (writable index for builders), `XmlValue`.

**Pitfall:** a present-but-unknown value (unmodeled bus/format/model, `route` forwarding) is **dropped** by the parsers, not preserved — `parse(serialize(x))` round-trips only inside the model. The `*ConfigMatches` comparators treat `undefined` desired fields as wildcards, so dropped live values never read as drift.
