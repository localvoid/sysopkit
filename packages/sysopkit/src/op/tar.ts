import { emitChanged, task, VERBOSITY_NORMAL } from 'sysopkit';
import { $_, sh } from 'sysopkit/op/sh';

export interface TarOptions {
  readonly src: string;
  readonly dst: string;
  readonly exclude?: string[];
}

export async function tar({ src, dst, exclude = [] }: TarOptions): Promise<void> {
  return task(
    `tar ${src} → ${dst}`,
    async (ctx) => {
      if (!ctx.dryRun) {
        let cmd = `tar -ac`;
        if (exclude.length > 0) {
          for (const excl of exclude) {
            cmd += ' ' + $_(`--exclude=${excl}`);
          }
        }
        cmd += ` -f ${$_(dst)} -C ${$_(src)} .`;
        await sh(cmd);
      }
      emitChanged({ type: 'tar', resource: dst, property: 'packed' });
    },
    { verbosity: VERBOSITY_NORMAL },
  );
}

export interface UntarOptions {
  readonly src: string;
  readonly dst: string;
  readonly exclude?: string[];
}

export async function untar({ src, dst, exclude = [] }: UntarOptions): Promise<void> {
  return task(
    `tar extract ${src} → ${dst}`,
    async (ctx) => {
      if (!ctx.dryRun) {
        let cmd = `tar -ax`;
        if (exclude.length > 0) {
          for (const excl of exclude) {
            cmd += ' ' + $_(`--exclude=${excl}`);
          }
        }
        cmd += ` -f ${$_(src)} -C ${$_(dst)}`;
        await sh(cmd);
      }
      emitChanged({ type: 'untar', resource: dst, property: 'extracted' });
    },
    { verbosity: VERBOSITY_NORMAL },
  );
}
