import { type FileStat } from 'sysopkit/op/file';
import { $_ } from 'sysopkit/op/sh';

import { type MockSpawnSpec } from './mock.js';

export function mockReadFile(path: string, content: string): MockSpawnSpec {
  return {
    cmd: ['sh', '-c', `cat ${$_(path)}`],
    stdout: content,
    exitCode: 0,
  };
}

export function mockTryReadFile(path: string, content: string): MockSpawnSpec {
  return {
    cmd: ['sh', '-c', `p=${$_(path)};[ -f "$p" ]||exit 64;cat "$p"`],
    stdout: content,
    exitCode: 0,
  };
}

export function mockReadFileMissing(path: string): MockSpawnSpec {
  return {
    cmd: ['sh', '-c', `cat ${$_(path)}`],
    stderr: `cat: ${path}: No such file or directory`,
    exitCode: 1,
  };
}

export function mockTryReadFileMissing(path: string): MockSpawnSpec {
  return {
    cmd: ['sh', '-c', `p=${$_(path)};[ -f "$p" ]||exit 64;cat "$p"`],
    exitCode: 64,
  };
}

export function mockWriteFile(path: string, content?: string): MockSpawnSpec {
  return {
    cmd: ['sh', '-c', `cat > ${$_(path)}`],
    stdin: content,
    exitCode: 0,
  };
}

export function mockFileExists(path: string): MockSpawnSpec {
  return {
    cmd: ['sh', '-c', `[ -e '${$_(path)}' ]||exit 64`],
    exitCode: 0,
  };
}

export function mockFileNotExists(path: string): MockSpawnSpec {
  return {
    cmd: ['sh', '-c', `[ -e '${$_(path)}' ]||exit 64`],
    exitCode: 64,
  };
}

export function mockRm(path: string): MockSpawnSpec {
  return {
    cmd: ['sh', '-c', `rm -f ${$_(path)}`],
    exitCode: 0,
  };
}

export function mockMkdir(path: string): MockSpawnSpec {
  return {
    cmd: ['sh', '-c', `mkdir -p ${$_(path)}`],
    exitCode: 0,
  };
}

export function mockChmod(path: string, mode: number): MockSpawnSpec {
  return {
    cmd: ['sh', '-c', `chmod ${mode.toString(8)} ${$_(path)}`],
    exitCode: 0,
  };
}

export function mockStat(path: string, status: FileStat): MockSpawnSpec {
  return {
    cmd: ['sh', '-c', `stat -c '%F\\n%U\\n%G\\n%a\\n%X\\n%Y\\n%Z\\n%s' ${$_(path)}`],
    stdout: `${status.type}\n${status.user}\n${status.group}\n${status.mode.toString(8)}\n${status.atime}\n${status.mtime}\n${status.ctime}\n${status.size}\n`,
    exitCode: 0,
  };
}

export function mockAwk(path: string, pattern: string, output: string): MockSpawnSpec {
  return {
    cmd: ['sh', '-c', `awk -F : ${$_(pattern)} ${$_(path)}`],
    stdout: output,
    exitCode: 0,
  };
}

export function mockRsync(src: string, dst: string, output: string, exitCode = 0): MockSpawnSpec {
  return {
    cmd: ['sh', '-c', `rsync -ivz -a --delete ${$_(src)} ${$_(dst)}`],
    stdout: output,
    stderr: '',
    exitCode,
  };
}
