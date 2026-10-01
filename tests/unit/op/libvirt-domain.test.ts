import { describe, expect, test } from 'bun:test';
import {
  _snapshotDiskspec,
  _snapshotMemspec,
  domainConfigMatches,
  normalizeDomainState,
  parseDomainIfAddr,
  parseDomainInfo,
  parseDomainList,
  parseDomainXml,
  parseSnapshotList,
  serializeDomainXml,
  type DomainConf,
} from '@sysopkit/libvirt/domain';

const BASIC: DomainConf = {
  name: 'guest',
  memoryMiB: 2048,
  vcpus: 2,
  disks: [{ source: '/var/lib/libvirt/images/guest.qcow2' }],
  networks: [{ source: 'default' }],
};

describe('serializeDomainXml', () => {
  test('serializes a minimal config with explicit defaults', () => {
    expect(serializeDomainXml(BASIC)).toBe(
      '<domain type="kvm"><name>guest</name>' +
        '<memory unit="MiB">2048</memory><currentMemory unit="MiB">2048</currentMemory>' +
        '<vcpu placement="static">2</vcpu>' +
        '<os><type arch="x86_64">hvm</type><boot dev="hd"/></os>' +
        '<features><acpi/><apic/></features>' +
        '<devices>' +
        '<disk type="file" device="disk"><driver name="qemu" type="qcow2"/>' +
        '<source file="/var/lib/libvirt/images/guest.qcow2"/>' +
        '<target dev="vda" bus="virtio"/></disk>' +
        '<interface type="network"><source network="default"/><model type="virtio"/></interface>' +
        '<serial type="pty"><target port="0"/></serial>' +
        '<console type="pty"><target type="serial" port="0"/></console>' +
        '<graphics type="spice"><listen type="none"/></graphics>' +
        '</devices></domain>',
    );
  });

  test('assigns default disk targets in order and honors overrides', () => {
    const xml = serializeDomainXml({
      ...BASIC,
      disks: [
        { source: '/a.qcow2' },
        { source: '/b.qcow2', bus: 'scsi', target: 'sdz' },
        { source: '/c.qcow2' },
      ],
    });
    expect(xml).toContain('<target dev="vda" bus="virtio"/>');
    expect(xml).toContain('<target dev="sdz" bus="scsi"/>');
    expect(xml).toContain('<target dev="vdc" bus="virtio"/>');
  });

  test('serializes UEFI, agent, bridge, and disabled consoles', () => {
    const xml = serializeDomainXml({
      ...BASIC,
      firmware: { loader: '/usr/share/edk2/ovmf/OVMF_CODE.fd' },
      networks: [{ type: 'bridge', source: 'br0', mac: '52:54:00:aa:bb:cc' }],
      graphics: 'none',
      agent: true,
      consoles: false,
    });
    expect(xml).toContain(
      '<loader readonly="yes" type="pflash">/usr/share/edk2/ovmf/OVMF_CODE.fd</loader>' +
        '<nvram>/var/lib/libvirt/qemu/nvram/guest_VARS.fd</nvram>',
    );
    expect(xml).toContain(
      '<interface type="bridge"><source bridge="br0"/>' +
        '<model type="virtio"/><mac address="52:54:00:aa:bb:cc"/></interface>',
    );
    expect(xml).toContain(
      '<channel type="unix"><target type="virtio" name="org.qemu.guest_agent.0"/></channel>',
    );
    expect(xml).not.toContain('<serial');
    expect(xml).not.toContain('<graphics');
  });

  test('rejects invalid configs', () => {
    for (const bad of [
      { ...BASIC, name: '' },
      { ...BASIC, memoryMiB: 0 },
      { ...BASIC, vcpus: 0 },
    ]) {
      try {
        serializeDomainXml(bad);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  test('serializes cdrom devices for seed images', () => {
    const xml = serializeDomainXml({
      ...BASIC,
      disks: [
        { source: '/var/lib/libvirt/images/guest.qcow2' },
        {
          device: 'cdrom',
          source: '/var/lib/libvirt/images/seed.iso',
          target: 'sda',
          bus: 'sata',
          readonly: true,
        },
      ],
    });
    expect(xml).toContain(
      '<disk type="file" device="cdrom"><driver name="qemu" type="qcow2"/>' +
        '<source file="/var/lib/libvirt/images/seed.iso"/>' +
        '<target dev="sda" bus="sata"/><readonly/>',
    );
  });

  test('serializes direct kernel boot in schema order (BIOS)', () => {
    const xml = serializeDomainXml({
      ...BASIC,
      kernel: '/boot/vmlinuz',
      initrd: '/boot/initrd.img',
      cmdline: 'console=ttyS0',
    });
    expect(xml).toContain(
      '<kernel>/boot/vmlinuz</kernel><initrd>/boot/initrd.img</initrd>' +
        '<cmdline>console=ttyS0</cmdline>',
    );
    const typeIdx = xml.indexOf('<type arch=');
    const kernelIdx = xml.indexOf('<kernel>');
    const initrdIdx = xml.indexOf('<initrd>');
    const cmdlineIdx = xml.indexOf('<cmdline>');
    const bootIdx = xml.indexOf('<boot dev=');
    expect(typeIdx).toBeGreaterThanOrEqual(0);
    expect(kernelIdx).toBeGreaterThan(typeIdx);
    expect(initrdIdx).toBeGreaterThan(kernelIdx);
    expect(cmdlineIdx).toBeGreaterThan(initrdIdx);
    expect(bootIdx).toBeGreaterThan(cmdlineIdx);
  });

  test('serializes direct kernel boot after loader/nvram (UEFI)', () => {
    const xml = serializeDomainXml({
      ...BASIC,
      firmware: { loader: '/usr/share/edk2/ovmf/OVMF_CODE.fd' },
      kernel: '/boot/vmlinuz',
      initrd: '/boot/initrd.img',
      cmdline: 'console=ttyS0',
    });
    const loaderIdx = xml.indexOf('<loader');
    const nvramIdx = xml.indexOf('<nvram>');
    const kernelIdx = xml.indexOf('<kernel>');
    const bootIdx = xml.indexOf('<boot dev=');
    expect(loaderIdx).toBeGreaterThanOrEqual(0);
    expect(nvramIdx).toBeGreaterThan(loaderIdx);
    expect(kernelIdx).toBeGreaterThan(nvramIdx);
    expect(bootIdx).toBeGreaterThan(kernelIdx);
  });

  test('omits direct kernel boot elements when unset', () => {
    const xml = serializeDomainXml(BASIC);
    expect(xml).not.toContain('<kernel>');
    expect(xml).not.toContain('<initrd>');
    expect(xml).not.toContain('<cmdline>');
  });

  test('rejects initrd/cmdline without kernel', () => {
    for (const bad of [
      { ...BASIC, initrd: '/boot/initrd.img' },
      { ...BASIC, cmdline: 'console=ttyS0' },
    ]) {
      try {
        serializeDomainXml(bad);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  test('round-trips uuid and omits it when unset', () => {
    const xml = serializeDomainXml({
      ...BASIC,
      uuid: '9f8a1b2c-3d4e-5f60-7182-93a4b5c6d7e8',
    });
    expect(xml).toContain('<uuid>9f8a1b2c-3d4e-5f60-7182-93a4b5c6d7e8</uuid>');
    const nameIdx = xml.indexOf('<name>');
    const uuidIdx = xml.indexOf('<uuid>');
    const memoryIdx = xml.indexOf('<memory');
    expect(nameIdx).toBeGreaterThanOrEqual(0);
    expect(uuidIdx).toBeGreaterThan(nameIdx);
    expect(memoryIdx).toBeGreaterThan(uuidIdx);
    expect(parseDomainXml(xml).uuid).toBe('9f8a1b2c-3d4e-5f60-7182-93a4b5c6d7e8');
    expect(serializeDomainXml(BASIC)).not.toContain('<uuid>');
    expect(parseDomainXml(serializeDomainXml(BASIC)).uuid).toBeUndefined();
  });

  test('serializes the parsed uuid so redefines converge', () => {
    const parsed = parseDomainXml(DUMPXML);
    expect(serializeDomainXml(parsed)).toContain(
      '<uuid>9f8a1b2c-3d4e-5f60-7182-93a4b5c6d7e8</uuid>',
    );
  });

  test('rejects invalid uuids', () => {
    for (const uuid of [
      'not-a-uuid',
      '9f8a1b2c3d4e5f60718293a4b5c6d7e8',
      '9f8a1b2c-3d4e-5f60-7182-93a4b5c6d7e8f',
      '',
    ]) {
      try {
        serializeDomainXml({ ...BASIC, uuid });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });
});

const DUMPXML =
  '<domain type="kvm">' +
  '<name>guest</name><uuid>9f8a1b2c-3d4e-5f60-7182-93a4b5c6d7e8</uuid>' +
  '<title>My guest</title>' +
  '<memory unit="KiB">2097152</memory><currentMemory unit="KiB">2097152</currentMemory>' +
  '<vcpu placement="static">2</vcpu>' +
  '<os><type arch="x86_64" machine="q35">hvm</type>' +
  '<loader readonly="yes" type="pflash">/usr/share/edk2/ovmf/OVMF_CODE.fd</loader>' +
  '<nvram template="/usr/share/edk2/ovmf/OVMF_VARS.fd">/var/lib/libvirt/qemu/nvram/guest_VARS.fd</nvram>' +
  '<boot dev="hd"/></os>' +
  '<features><acpi/><apic/></features>' +
  '<cpu mode="host-passthrough"/>' +
  '<devices>' +
  '<emulator>/usr/bin/qemu-system-x86_64</emulator>' +
  '<disk type="file" device="disk"><driver name="qemu" type="qcow2"/>' +
  '<source file="/var/lib/libvirt/images/guest.qcow2"/>' +
  '<target dev="vda" bus="virtio"/></disk>' +
  '<interface type="network"><mac address="52:54:00:11:22:33"/>' +
  '<source network="default"/><model type="virtio"/></interface>' +
  '<serial type="pty"><target port="0"/></serial>' +
  '<console type="pty"><target type="serial" port="0"/></console>' +
  '<channel type="unix"><target type="virtio" name="org.qemu.guest_agent.0"/></channel>' +
  '<graphics type="spice"><listen type="none"/></graphics>' +
  '<video><model type="qxl"/></video>' +
  '<memballoon model="virtio"/>' +
  '</devices></domain>';

describe('parseDomainXml', () => {
  test('parses dumpxml output into the normalized model', () => {
    expect(parseDomainXml(DUMPXML)).toEqual({
      name: 'guest',
      uuid: '9f8a1b2c-3d4e-5f60-7182-93a4b5c6d7e8',
      title: 'My guest',
      memoryMiB: 2048,
      vcpus: 2,
      machine: 'q35',
      firmware: {
        loader: '/usr/share/edk2/ovmf/OVMF_CODE.fd',
        template: '/usr/share/edk2/ovmf/OVMF_VARS.fd',
        nvram: '/var/lib/libvirt/qemu/nvram/guest_VARS.fd',
      },
      cpuMode: 'host-passthrough',
      bootDevices: ['hd'],
      disks: [
        {
          source: '/var/lib/libvirt/images/guest.qcow2',
          target: 'vda',
          bus: 'virtio',
          format: 'qcow2',
        },
      ],
      networks: [{ source: 'default', model: 'virtio', mac: '52:54:00:11:22:33' }],
      graphics: { type: 'spice', listen: 'none' },
      agent: true,
      consoles: true,
    });
  });

  test('parses minimal XML with model defaults omitted', () => {
    expect(
      parseDomainXml('<domain><name>x</name><memory>512</memory><vcpu>1</vcpu></domain>'),
    ).toEqual({
      name: 'x',
      memoryMiB: 512,
      vcpus: 1,
      firmware: 'bios',
      graphics: 'none',
      consoles: false,
    });
  });

  test('round-trips serialize output', () => {
    const full: DomainConf = {
      name: 'guest',
      title: 't',
      description: 'd',
      memoryMiB: 4096,
      vcpus: 4,
      machine: 'q35',
      firmware: {
        loader: '/code.fd',
        template: '/vars.fd',
        nvram: '/var/lib/libvirt/qemu/nvram/guest_VARS.fd',
      },
      cpuMode: 'host-model',
      bootDevices: ['hd', 'cdrom'],
      disks: [
        { source: '/a.qcow2', target: 'vda', bus: 'virtio', format: 'qcow2', bootOrder: 1 },
        {
          device: 'cdrom',
          source: '/seed.iso',
          target: 'sda',
          bus: 'sata',
          format: 'qcow2',
          readonly: true,
        },
      ],
      networks: [{ type: 'bridge', source: 'br0', model: 'e1000', mac: '52:54:00:aa:bb:cc' }],
      graphics: { type: 'vnc', listen: 'localhost' },
      agent: true,
      consoles: true,
    };
    expect(parseDomainXml(serializeDomainXml(full))).toEqual(full);
  });

  test('round-trips direct kernel boot fields', () => {
    const conf: DomainConf = {
      ...BASIC,
      kernel: '/boot/vmlinuz',
      initrd: '/boot/initrd.img',
      cmdline: 'console=ttyS0 root=/dev/vda1',
    };
    const parsed = parseDomainXml(serializeDomainXml(conf));
    expect(parsed.kernel).toBe('/boot/vmlinuz');
    expect(parsed.initrd).toBe('/boot/initrd.img');
    expect(parsed.cmdline).toBe('console=ttyS0 root=/dev/vda1');
    expect(parsed).toEqual(parseDomainXml(serializeDomainXml(parsed)));
  });

  test('parses direct kernel boot fields from dumpxml order', () => {
    const conf = parseDomainXml(
      '<domain><name>x</name><memory>512</memory><vcpu>1</vcpu>' +
        '<os><type arch="x86_64">hvm</type>' +
        '<kernel>/boot/vmlinuz</kernel><initrd>/boot/initrd.img</initrd>' +
        '<cmdline>console=ttyS0</cmdline><boot dev="hd"/></os></domain>',
    );
    expect(conf.kernel).toBe('/boot/vmlinuz');
    expect(conf.initrd).toBe('/boot/initrd.img');
    expect(conf.cmdline).toBe('console=ttyS0');
  });

  test('parses ejected cdroms as sourceless entries', () => {
    const conf = parseDomainXml(
      '<domain><name>x</name><memory>512</memory><vcpu>1</vcpu><devices>' +
        '<disk type="file" device="cdrom"><target dev="sda" bus="sata"/><readonly/></disk>' +
        '</devices></domain>',
    );
    expect(conf.disks).toEqual([
      { device: 'cdrom', source: '', target: 'sda', bus: 'sata', readonly: true },
    ]);
  });

  test('rejects missing fields, bad arch, and unmodeled device types', () => {
    const cases = [
      '<domain><memory>512</memory><vcpu>1</vcpu></domain>',
      '<domain><name>x</name><vcpu>1</vcpu></domain>',
      '<domain><name>x</name><memory>512</memory></domain>',
      '<domain><name>x</name><memory>512</memory><vcpu>1</vcpu>' +
        '<os><type arch="riscv">hvm</type></os></domain>',
      '<domain><name>x</name><memory>512</memory><vcpu>1</vcpu><devices>' +
        '<disk type="network" device="disk"><source protocol="rbd" name="pool/img"/>' +
        '<target dev="vda" bus="virtio"/></disk></devices></domain>',
      '<domain><name>x</name><memory>512</memory><vcpu>1</vcpu><devices>' +
        '<disk type="file" device="floppy"><source file="/f.img"/>' +
        '<target dev="fda" bus="fdc"/></disk></devices></domain>',
    ];
    for (const xml of cases) {
      try {
        parseDomainXml(xml);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });
});

describe('domainConfigMatches', () => {
  test('matches identical configs', () => {
    const parsed = parseDomainXml(DUMPXML);
    expect(domainConfigMatches(parsed, parsed)).toBe(true);
  });

  test('treats undefined desired fields as wildcards', () => {
    const live = parseDomainXml(DUMPXML);
    expect(domainConfigMatches(live, { name: 'guest', memoryMiB: 2048, vcpus: 2 })).toBe(true);
  });

  test('detects drift in memory, disks, and autostart-adjacent fields', () => {
    const live = parseDomainXml(DUMPXML);
    expect(domainConfigMatches(live, { ...BASIC, memoryMiB: 4096 })).toBe(false);
    expect(domainConfigMatches(live, { ...BASIC, name: 'other' })).toBe(false);
    expect(
      domainConfigMatches(live, {
        ...BASIC,
        disks: [{ source: '/var/lib/libvirt/images/other.qcow2' }],
      }),
    ).toBe(false);
    expect(domainConfigMatches(live, { ...BASIC, graphics: 'none' })).toBe(false);
    expect(domainConfigMatches(live, { ...BASIC, agent: false })).toBe(false);
  });

  test('compares disk device classes', () => {
    const live = parseDomainXml(DUMPXML);
    expect(
      domainConfigMatches(live, {
        ...BASIC,
        disks: [{ source: '/var/lib/libvirt/images/guest.qcow2', device: 'cdrom' }],
      }),
    ).toBe(false);
    expect(
      domainConfigMatches(live, {
        ...BASIC,
        disks: [{ source: '/var/lib/libvirt/images/guest.qcow2', device: 'disk' }],
      }),
    ).toBe(true);
  });

  test('treats unset direct kernel boot fields as wildcards', () => {
    const live: DomainConf = {
      ...BASIC,
      kernel: '/boot/vmlinuz',
      initrd: '/boot/initrd.img',
      cmdline: 'console=ttyS0',
    };
    expect(domainConfigMatches(live, { ...BASIC })).toBe(true);
    expect(domainConfigMatches(live, { ...live })).toBe(true);
  });

  test('detects drift in direct kernel boot fields', () => {
    const live: DomainConf = {
      ...BASIC,
      kernel: '/boot/vmlinuz',
      initrd: '/boot/initrd.img',
      cmdline: 'console=ttyS0',
    };
    expect(domainConfigMatches(live, { ...live, kernel: '/boot/other' })).toBe(false);
    expect(domainConfigMatches(live, { ...live, initrd: '/boot/other.img' })).toBe(false);
    expect(domainConfigMatches(live, { ...live, cmdline: 'console=ttyS1' })).toBe(false);
    expect(domainConfigMatches({ ...BASIC }, { ...live, kernel: '/boot/vmlinuz' })).toBe(false);
  });

  test('treats unset desired uuid as wildcard and differing uuids as drift', () => {
    const live = parseDomainXml(DUMPXML);
    expect(live.uuid).toBe('9f8a1b2c-3d4e-5f60-7182-93a4b5c6d7e8');
    expect(domainConfigMatches(live, { ...BASIC })).toBe(true);
    expect(domainConfigMatches(live, { ...BASIC, uuid: live.uuid })).toBe(true);
    expect(
      domainConfigMatches(live, {
        ...BASIC,
        uuid: '11111111-2222-3333-4444-555555555555',
      }),
    ).toBe(false);
    expect(domainConfigMatches({ ...BASIC }, { ...BASIC, uuid: live.uuid })).toBe(false);
  });
});

describe('normalizeDomainState', () => {
  test('normalizes virsh states', () => {
    expect(normalizeDomainState('running\n')).toBe('running');
    expect(normalizeDomainState('shut off')).toBe('shutoff');
    expect(normalizeDomainState('paused')).toBe('paused');
    expect(normalizeDomainState('bogus')).toBe('unknown');
  });
});

describe('parseDomainList', () => {
  test('parses virsh list table with multi-word states', () => {
    expect(
      parseDomainList(
        ' Id   Name    State\n----------------------\n 1    vm1     running\n -    vm2     shut off\n',
      ),
    ).toEqual([
      { name: 'vm1', state: 'running' },
      { name: 'vm2', state: 'shutoff' },
    ]);
  });
});

describe('parseDomainInfo', () => {
  test('parses virsh dominfo output', () => {
    const info = parseDomainInfo(
      'Id:             5\nName:           guest\nUUID:           9f8a\nOS Type:        hvm\n' +
        'State:          running\nCPU(s):         2\nCPU time:       10.0s\n' +
        'Max memory:     2097152 KiB\nUsed memory:    2097152 KiB\n' +
        'Persistent:     yes\nAutostart:      enable\nManaged save:   no\n',
    );
    expect(info).toEqual({
      id: 5,
      name: 'guest',
      state: 'running',
      vcpus: 2,
      maxMemoryMiB: 2048,
      memoryMiB: 2048,
      persistent: true,
      autostart: true,
    });
  });

  test('parses inactive domains with dash id', () => {
    const info = parseDomainInfo(
      'Id:             -\nName:           guest\nState:          shut off\nCPU(s):         1\n' +
        'Max memory:     524288 KiB\nUsed memory:    524288 KiB\n' +
        'Persistent:     yes\nAutostart:      disable\n',
    );
    expect(info.id).toBeUndefined();
    expect(info.state).toBe('shutoff');
    expect(info.autostart).toBe(false);
  });
});

describe('_snapshotMemspec', () => {
  test('serializes file/snapshot combinations', () => {
    expect(_snapshotMemspec({ file: '/snap/mem.img' })).toBe('file=/snap/mem.img');
    expect(_snapshotMemspec({ snapshot: 'external' })).toBe('snapshot=external');
    expect(_snapshotMemspec({ file: '/snap/mem.img', snapshot: 'internal' })).toBe(
      'file=/snap/mem.img,snapshot=internal',
    );
    try {
      _snapshotMemspec({});
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });
});

describe('_snapshotDiskspec', () => {
  test('serializes disk specs with optional parts', () => {
    expect(_snapshotDiskspec({ disk: 'vda' })).toBe('vda');
    expect(_snapshotDiskspec({ disk: 'vda', snapshot: 'external', file: '/snap/vda.qcow2' })).toBe(
      'vda,snapshot=external,file=/snap/vda.qcow2',
    );
    expect(_snapshotDiskspec({ disk: 'vdb', snapshot: 'no', driver: 'qcow2', stype: 'file' })).toBe(
      'vdb,snapshot=no,driver=qcow2,stype=file',
    );
  });
});

describe('parseSnapshotList', () => {
  test('parses snapshot-list with spaced timestamps', () => {
    expect(
      parseSnapshotList(
        ' Name                 Creation Time             State\n' +
          '------------------------------------------------------------\n' +
          ' clean                2026-09-30 12:00:00 +0000 shutoff\n' +
          ' before-upgrade       2026-09-30 13:30:10 +0000 running\n',
      ),
    ).toEqual([
      { name: 'clean', creationTime: '2026-09-30 12:00:00 +0000', state: 'shutoff' },
      { name: 'before-upgrade', creationTime: '2026-09-30 13:30:10 +0000', state: 'running' },
    ]);
  });

  test('returns empty for no snapshots', () => {
    expect(
      parseSnapshotList(' Name   Creation Time   State\n--------------------------------\n'),
    ).toEqual([]);
  });
});

describe('parseDomainIfAddr', () => {
  test('parses domifaddr table with lease and agent rows', () => {
    expect(
      parseDomainIfAddr(
        ' Name       MAC address          Protocol     Address\n' +
          ' -------------------------------------------------------------------\n' +
          ' vnet0      52:54:00:11:22:33    ipv4         192.168.122.5/24\n' +
          ' vnet0      52:54:00:11:22:33    ipv6         fe80::5054:ff:fe11:2233/64\n' +
          ' vnet1      52:54:00:aa:bb:cc    ipv4         -\n',
      ),
    ).toEqual([
      {
        interface: 'vnet0',
        mac: '52:54:00:11:22:33',
        protocol: 'ipv4',
        address: '192.168.122.5/24',
      },
      {
        interface: 'vnet0',
        mac: '52:54:00:11:22:33',
        protocol: 'ipv6',
        address: 'fe80::5054:ff:fe11:2233/64',
      },
      { interface: 'vnet1', mac: '52:54:00:aa:bb:cc', protocol: 'ipv4', address: undefined },
    ]);
  });
});
