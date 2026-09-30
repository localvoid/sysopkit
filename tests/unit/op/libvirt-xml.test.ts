import { describe, expect, test } from 'bun:test';
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

describe('parseXmlDocument', () => {
  test('parses attributes, text, and nested elements', () => {
    expect(parseXmlDocument('<domain type="kvm"><name>test</name></domain>')).toEqual({
      domain: { '@type': 'kvm', 'name': 'test' },
    });
  });

  test('parses attributed text elements via #text', () => {
    expect(parseXmlDocument('<domain><memory unit="MiB">2048</memory></domain>')).toEqual({
      domain: { memory: { '@unit': 'MiB', '#text': '2048' } },
    });
  });

  test('collects repeated elements into arrays', () => {
    expect(parseXmlDocument('<a><b>1</b><b>2</b></a>')).toEqual({ a: { b: ['1', '2'] } });
  });

  test('parses empty elements as empty strings', () => {
    expect(parseXmlDocument('<a><readonly/><b></b></a>')).toEqual({ a: { readonly: '', b: '' } });
  });

  test('throws SyntaxError on malformed XML', () => {
    try {
      parseXmlDocument('<a><b></a>');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(SyntaxError);
    }
  });
});

describe('stringifyXmlDocument', () => {
  test('serializes attributes and text', () => {
    expect(stringifyXmlDocument({ domain: { '@type': 'kvm', 'name': 'test' } })).toBe(
      '<domain type="kvm"><name>test</name></domain>',
    );
  });

  test('round-trips parse output', () => {
    const xml =
      '<domain type="kvm"><name>test</name><memory unit="MiB">2048</memory>' +
      '<devices><disk type="file" device="disk"><source file="/img.qcow2"/>' +
      '<target dev="vda" bus="virtio"/></disk></devices></domain>';
    expect(stringifyXmlDocument(parseXmlDocument(xml))).toBe(xml);
  });
});

describe('asArray', () => {
  test('wraps single values and passes arrays through', () => {
    expect(asArray(undefined)).toEqual([]);
    expect(asArray(null)).toEqual([]);
    expect(asArray('a')).toEqual(['a']);
    expect(asArray(['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('xml helpers', () => {
  test('isXmlElement distinguishes text from elements', () => {
    expect(isXmlElement('text')).toBe(false);
    expect(isXmlElement(['a'])).toBe(false);
    expect(isXmlElement(undefined)).toBe(false);
    expect(isXmlElement({ name: 'x' })).toBe(true);
  });

  test('childElement returns single children and rejects repeats', () => {
    expect(childElement(undefined, 'a')).toBeUndefined();
    expect(childElement({ a: 'x' }, 'a')).toBe('x');
    expect(childElement({ a: 'x' }, 'b')).toBeUndefined();
    try {
      childElement({ a: ['1', '2'] }, 'a');
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain('<a>');
    }
  });

  test('childText reads bare and attributed text', () => {
    expect(childText(undefined, 'a')).toBeUndefined();
    expect(childText({ a: 'x' }, 'a')).toBe('x');
    expect(childText({ a: '' }, 'a')).toBeUndefined();
    expect(childText({ a: { '@unit': 'MiB', '#text': '2048' } }, 'a')).toBe('2048');
    expect(childText({ a: { '@unit': 'MiB' } }, 'a')).toBeUndefined();
  });

  test('xmlAttr and xmlText read attributes and text', () => {
    expect(xmlAttr(undefined, 't')).toBeUndefined();
    expect(xmlAttr({ '@t': 'kvm' }, 't')).toBe('kvm');
    expect(xmlAttr({ name: 'x' }, 't')).toBeUndefined();
    expect(xmlText('hi')).toBe('hi');
    expect(xmlText('')).toBeUndefined();
    expect(xmlText({ '#text': 'hi' })).toBe('hi');
    expect(xmlText({ name: 'x' })).toBeUndefined();
    expect(xmlText(undefined)).toBeUndefined();
  });
});
