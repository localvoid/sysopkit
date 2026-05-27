import { describe, expect, test } from 'bun:test';
import { serializeIni } from 'sysopkit/op/ini';

describe('serializeIni', () => {
  test('outputs sections', () => {
    const input = { section1: { key: 'value' } };

    const result = serializeIni(input);

    expect(result).toContain('[section1]');
    expect(result).toContain('key=value');
  });

  test('adds blank line between sections', () => {
    const input = {
      section1: { key1: 'value1' },
      section2: { key2: 'value2' },
    };

    const result = serializeIni(input);

    expect(result).toContain('[section1]\nkey1=value1\n\n[section2]');
  });

  test('serializes arrays as multiple lines with same key', () => {
    const input = { Network: { Address: ['entry1', 'entry2'] } };

    const result = serializeIni(input);

    expect(result).toContain('[Network]');
    expect(result).toContain('Address=entry1');
    expect(result).toContain('Address=entry2');
  });

  test('handles array elements with newlines', () => {
    const input = { test: { key: ['line1\nline2', 'single'] } };

    const result = serializeIni(input);

    expect(result).toContain('key=line1');
    expect(result).toContain('line2');
    expect(result).toContain('key=single');
  });
});
