import { describe, expect, test } from 'bun:test';
import {
  parsePoolInfo,
  parsePoolList,
  parsePoolXml,
  parseVolumeInfo,
  parseVolumeList,
  poolConfigMatches,
  serializePoolXml,
  serializeVolumeXml,
  type PoolConf,
  type VolumeConf,
} from '@sysopkit/libvirt/storage';

describe('serializePoolXml', () => {
  test('serializes a dir pool', () => {
    expect(serializePoolXml({ name: 'default', path: '/var/lib/libvirt/images' })).toBe(
      '<pool type="dir"><name>default</name>' +
        '<target><path>/var/lib/libvirt/images</path></target></pool>',
    );
  });

  test('rejects empty names/paths and non-dir types', () => {
    const badPools = [
      { name: '', path: '/x' },
      { name: 'p', path: '' },
      { name: 'p', path: '/x', type: 'fs' },
    ] as PoolConf[];
    for (const bad of badPools) {
      try {
        serializePoolXml(bad);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });
});

describe('parsePoolXml', () => {
  test('parses pool-dumpxml output', () => {
    expect(
      parsePoolXml(
        '<pool type="dir"><name>default</name><uuid>9f8a</uuid>' +
          '<target><path>/var/lib/libvirt/images</path></target></pool>',
      ),
    ).toEqual({ name: 'default', path: '/var/lib/libvirt/images' });
  });

  test('round-trips serialize output', () => {
    const conf: PoolConf = { name: 'p', path: '/data/pools/p' };
    expect(parsePoolXml(serializePoolXml(conf))).toEqual(conf);
  });

  test('rejects non-dir pools and missing fields', () => {
    for (const xml of [
      '<pool type="fs"><name>p</name><target><path>/x</path></target></pool>',
      '<pool type="dir"><target><path>/x</path></target></pool>',
      '<pool type="dir"><name>p</name></pool>',
    ]) {
      try {
        parsePoolXml(xml);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });
});

describe('poolConfigMatches', () => {
  test('compares name, type, and path', () => {
    const live: PoolConf = { name: 'p', path: '/data' };
    expect(poolConfigMatches(live, { name: 'p', path: '/data' })).toBe(true);
    expect(poolConfigMatches(live, { name: 'p', path: '/other' })).toBe(false);
    expect(poolConfigMatches(live, { name: 'q', path: '/data' })).toBe(false);
  });
});

describe('serializeVolumeXml', () => {
  test('serializes volumes with and without backing stores', () => {
    expect(serializeVolumeXml({ name: 'guest.qcow2', capacityMiB: 20480 })).toBe(
      '<volume><name>guest.qcow2</name><capacity unit="MiB">20480</capacity>' +
        '<target><format type="qcow2"/></target></volume>',
    );
    expect(
      serializeVolumeXml({
        name: 'overlay.qcow2',
        capacityMiB: 10240,
        backingPath: '/var/lib/libvirt/images/base.qcow2',
      }),
    ).toContain(
      '<backingStore><path>/var/lib/libvirt/images/base.qcow2</path>' +
        '<format type="qcow2"/></backingStore>',
    );
  });

  test('rejects invalid volumes', () => {
    for (const bad of [
      { name: '', capacityMiB: 100 },
      { name: 'v', capacityMiB: 0 },
    ]) {
      try {
        serializeVolumeXml(bad as VolumeConf);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });
});

describe('parseVolumeInfo', () => {
  test('parses vol-dumpxml output with unit conversion', () => {
    expect(
      parseVolumeInfo(
        '<volume type="file"><name>guest.qcow2</name>' +
          '<capacity unit="bytes">21474836480</capacity>' +
          '<target><format type="qcow2"/><path>/var/lib/libvirt/images/guest.qcow2</path></target>' +
          '</volume>',
      ),
    ).toEqual({
      name: 'guest.qcow2',
      capacityMiB: 20480,
      format: 'qcow2',
      path: '/var/lib/libvirt/images/guest.qcow2',
    });
  });
});

describe('parsePoolList', () => {
  test('parses virsh pool-list table', () => {
    expect(
      parsePoolList(
        ' Name      State    Autostart\n' +
          '--------------------------------\n' +
          ' default   active   yes\n' +
          ' iso       inactive no\n',
      ),
    ).toEqual([
      { name: 'default', active: true, autostart: true },
      { name: 'iso', active: false, autostart: false },
    ]);
  });
});

describe('parsePoolInfo', () => {
  test('parses virsh pool-info output', () => {
    expect(
      parsePoolInfo(
        'Name:           default\nUUID:           9f8a\nState:          running\n' +
          'Persistent:     yes\nAutostart:      yes\nCapacity:       99.99 GiB\n',
      ),
    ).toEqual({ name: 'default', active: true, autostart: true, persistent: true });
  });
});

describe('parseVolumeList', () => {
  test('parses virsh vol-list table into names', () => {
    expect(
      parseVolumeList(
        ' Name                 Path\n' +
          '------------------------------------------------------------------------------\n' +
          ' a.qcow2              /var/lib/libvirt/images/a.qcow2\n' +
          ' b.qcow2              /var/lib/libvirt/images/b.qcow2\n',
      ),
    ).toEqual(['a.qcow2', 'b.qcow2']);
  });
});
