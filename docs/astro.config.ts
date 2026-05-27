import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.sysopkit.com',
  integrations: [
    starlight({
      title: 'SysopKit',
      favicon: '/favicon.png',
      description: 'TypeScript infrastructure automation toolkit.',
      social: [
        {
          label: 'GitHub',
          icon: 'github',
          href: 'https://github.com/localvoid/sysopkit',
        },
      ],
      head: [
        {
          tag: 'script',
          attrs: {
            async: true,
            src: 'https://www.googletagmanager.com/gtag/js?id=G-9PJZL1Z86M',
          },
        },
        {
          tag: 'script',
          content: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-9PJZL1Z86M');
          `,
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/localvoid/sysopkit/edit/main/docs/',
      },
      sidebar: [
        {
          label: 'Start Here',
          items: ['overview', 'getting-started', 'tutorial'],
        },
        {
          label: 'Concepts',
          items: [
            'concepts/architecture',
            'concepts/execution-model',
            'concepts/connectors',
            'concepts/inventory',
            'concepts/apply',
            'concepts/events-and-changes',
            'concepts/context-variables',
            'concepts/middleware',
            'concepts/error-handling',
            'concepts/idempotency',
            'concepts/dry-run-and-verbosity',
          ],
        },
        {
          label: 'Operations',
          collapsed: true,
          items: [
            {
              label: 'File Management',
              collapsed: true,
              items: [
                'operations/file-management/file',
                'operations/file-management/rsync',
                'operations/file-management/tar',
              ],
            },
            {
              label: 'Network',
              collapsed: true,
              items: [
                'operations/network/curl',
                'operations/network/net',
                'operations/network/netcat',
                'operations/network/ssh',
                'operations/network/wget',
              ],
            },
            {
              label: 'Shell & Process',
              collapsed: true,
              items: [
                'operations/shell-process/exec',
                'operations/shell-process/sh',
                'operations/shell-process/bash',
                'operations/shell-process/proc',
              ],
            },
            {
              label: 'System',
              collapsed: true,
              items: ['operations/system/mount', 'operations/system/users'],
            },
            {
              label: 'Configuration',
              collapsed: true,
              items: ['operations/configuration/ini'],
            },
          ],
        },
        {
          label: 'Linux Operations',
          collapsed: true,
          items: [
            'linux/system-information',
            'linux/system-configuration',
            'linux/package-management',
            {
              label: 'Systemd',
              collapsed: true,
              items: [
                'linux/systemd',
                'linux/systemd/journald',
                'linux/systemd/logind',
                'linux/systemd/resolved',
                'linux/systemd/timesyncd',
                'linux/systemd/sleep',
                'linux/systemd/coredump',
                'linux/systemd/sysusers',
                'linux/systemd/tmpfiles',
                'linux/systemd/networkd',
              ],
            },
            'linux/kernel',
            'linux/tuned',
          ],
        },
        {
          label: 'Reference',
          collapsed: true,
          items: [
            'reference/core-api',
            'reference/core-functions',
            'reference/utilities',
            'reference/error-classes',
          ],
        },
        'vs-ansible',
        'contributing',
      ],
    }),
  ],
});
