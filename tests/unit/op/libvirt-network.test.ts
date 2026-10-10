import { describe, expect, test } from 'bun:test';
import {
  networkConfigMatches,
  parseNetworkDhcpHosts,
  parseNetworkInfo,
  parseNetworkList,
  parseNetworkXml,
  serializeNetworkXml,
  type NetworkConf,
} from '@sysopkit/libvirt/network';

describe('serializeNetworkXml', () => {
  test('serializes a nat network with dhcp', () => {
    expect(
      serializeNetworkXml({
        name: 'default',
        ip: '192.168.122.1',
        netmask: '255.255.255.0',
        dhcpRanges: [{ start: '192.168.122.2', end: '192.168.122.254' }],
      }),
    ).toBe(
      '<network><name>default</name><forward mode="nat"/>' +
        '<ip address="192.168.122.1" netmask="255.255.255.0">' +
        '<dhcp><range start="192.168.122.2" end="192.168.122.254"/></dhcp>' +
        '</ip></network>',
    );
  });

  test('serializes isolated and bridge networks', () => {
    expect(serializeNetworkXml({ name: 'isolated', mode: 'isolated' })).toBe(
      '<network><name>isolated</name></network>',
    );
    expect(serializeNetworkXml({ name: 'br', mode: 'bridge', bridge: 'br0' })).toBe(
      '<network><name>br</name><bridge name="br0"/><forward mode="bridge"/></network>',
    );
  });

  test('rejects empty names and nat without ip', () => {
    for (const bad of [{ name: '' }, { name: 'n', mode: 'nat' as const }]) {
      try {
        serializeNetworkXml(bad);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });
});

const NET_DUMPXML =
  '<network><name>default</name><uuid>9f8a1b2c-3d4e-5f60-7182-93a4b5c6d7e8f</uuid>' +
  '<bridge name="virbr0"/>' +
  '<forward mode="nat"/>' +
  '<ip address="192.168.122.1" netmask="255.255.255.0">' +
  '<dhcp><range start="192.168.122.2" end="192.168.122.254"/></dhcp>' +
  '</ip></network>';

describe('parseNetworkXml', () => {
  test('parses net-dumpxml output', () => {
    expect(parseNetworkXml(NET_DUMPXML)).toEqual({
      name: 'default',
      bridge: 'virbr0',
      ip: '192.168.122.1',
      netmask: '255.255.255.0',
      dhcpRanges: [{ start: '192.168.122.2', end: '192.168.122.254' }],
    });
  });

  test('parses isolated networks and maps unknown forward modes', () => {
    expect(parseNetworkXml('<network><name>i</name></network>')).toEqual({
      name: 'i',
      mode: 'isolated',
    });
    expect(
      parseNetworkXml('<network><name>r</name><forward mode="route" dev="eth0"/></network>'),
    ).toEqual({
      name: 'r',
      mode: 'isolated',
    });
  });

  test('round-trips serialize output', () => {
    const conf: NetworkConf = {
      name: 'mynet',
      bridge: 'virbr1',
      ip: '10.0.0.1',
      netmask: '255.255.255.0',
      dhcpRanges: [{ start: '10.0.0.2', end: '10.0.0.100' }],
    };
    expect(parseNetworkXml(serializeNetworkXml(conf))).toEqual(conf);
  });

  test('rejects missing names', () => {
    try {
      parseNetworkXml('<network><bridge name="virbr0"/></network>');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });
});

describe('parseNetworkDhcpHosts', () => {
  test('parses dhcp hosts and ignores dns hosts', () => {
    expect(
      parseNetworkDhcpHosts(
        '<network><name>default</name>' +
          '<ip address="192.168.122.1" netmask="255.255.255.0">' +
          '<dhcp>' +
          '<range start="192.168.122.2" end="192.168.122.254"/>' +
          "<host mac='52:54:00:aa:bb:cc' name='alice' ip='192.168.122.10'/>" +
          "<host mac='52:54:00:dd:ee:ff' ip='192.168.122.11'/>" +
          '</dhcp></ip>' +
          '<dns>' +
          "<host ip='192.168.122.10'><hostname>alice</hostname></host>" +
          '</dns></network>',
      ),
    ).toEqual([
      { mac: '52:54:00:aa:bb:cc', name: 'alice', ip: '192.168.122.10' },
      { mac: '52:54:00:dd:ee:ff', ip: '192.168.122.11' },
    ]);
  });

  test('collects hosts across multiple ip elements and skips incomplete entries', () => {
    expect(
      parseNetworkDhcpHosts(
        '<network><name>m</name>' +
          '<ip address="10.0.0.1" netmask="255.255.255.0">' +
          '<dhcp>' +
          "<host mac='52:54:00:00:00:01' name='a' ip='10.0.0.2'/>" +
          "<host mac='52:54:00:00:00:02' name='no-ip'/>" +
          '</dhcp></ip>' +
          '<ip address="10.0.1.1" netmask="255.255.255.0">' +
          '<dhcp>' +
          "<host mac='52:54:00:00:01:01' name='b' ip='10.0.1.2'/>" +
          '</dhcp></ip>' +
          '<ip address="10.0.2.1" netmask="255.255.255.0"/>' +
          '</network>',
      ),
    ).toEqual([
      { mac: '52:54:00:00:00:01', name: 'a', ip: '10.0.0.2' },
      { mac: '52:54:00:00:01:01', name: 'b', ip: '10.0.1.2' },
    ]);
  });

  test('returns empty when no dhcp hosts exist and rejects malformed xml', () => {
    expect(parseNetworkDhcpHosts(NET_DUMPXML)).toEqual([]);
    expect(parseNetworkDhcpHosts('<network><name>n</name></network>')).toEqual([]);
    try {
      parseNetworkDhcpHosts('<network><name>broken</name>');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });
});

describe('networkConfigMatches', () => {
  test('matches with bridge wildcard and detects drift', () => {
    const live = parseNetworkXml(NET_DUMPXML);
    expect(
      networkConfigMatches(live, {
        name: 'default',
        ip: '192.168.122.1',
        netmask: '255.255.255.0',
        dhcpRanges: [{ start: '192.168.122.2', end: '192.168.122.254' }],
      }),
    ).toBe(true);
    expect(networkConfigMatches(live, { name: 'default', mode: 'isolated' })).toBe(false);
    expect(networkConfigMatches(live, { name: 'default', bridge: 'virbr9' })).toBe(false);
    expect(networkConfigMatches(live, { name: 'other' })).toBe(false);
  });
});

describe('parseNetworkList', () => {
  test('parses virsh net-list table', () => {
    expect(
      parseNetworkList(
        ' Name      State    Autostart   Persistent\n' +
          '------------------------------------------------\n' +
          ' default   active   yes         yes\n' +
          ' br        inactive no          yes\n',
      ),
    ).toEqual([
      { name: 'default', active: true, autostart: true, persistent: true },
      { name: 'br', active: false, autostart: false, persistent: true },
    ]);
  });
});

describe('parseNetworkInfo', () => {
  test('parses virsh net-info output', () => {
    expect(
      parseNetworkInfo(
        'Name:           default\nUUID:           9f8a\nActive:         yes\n' +
          'Persistent:     yes\nAutostart:      yes\nDurable:        no\nBridge:         virbr0\n',
      ),
    ).toEqual({
      name: 'default',
      active: true,
      autostart: true,
      persistent: true,
      bridge: 'virbr0',
    });
  });
});
