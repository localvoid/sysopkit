/**
 * @module op/users
 *
 * User and group management operations.
 *
 * @see useradd(8) - create a new user
 * @see userdel(8) - delete a user account
 * @see usermod(8) - modify a user account
 * @see passwd(5) - password file format
 * @see group(5) - group file format
 */

import { emitChanged, task } from '../core/context.js';
import { VERBOSITY_NORMAL } from '../core/reporter.js';
import { diffArrays } from '../utils/diff.js';
import { readFile } from './file.js';
import { $_, sh } from './sh.js';

/** Path to the passwd file. */
export const PASSWD_PATH = '/etc/passwd';
/** Path to the group file. */
export const GROUP_PATH = '/etc/group';

/** Group information for the current user. */
export interface CurrentUserGroupInfo {
  readonly name: string;
  readonly gid: number;
}

/** Current user information from `id` command. */
export interface CurrentUser {
  readonly name: string;
  readonly uid: number;
  readonly group: CurrentUserGroupInfo;
  readonly groups: CurrentUserGroupInfo[];
}

const UID_RE = /uid=(\d+)\(([^)]+)\)/;
const GID_RE = /gid=(\d+)\(([^)]+)\)/;
const GROUPS_RE = /groups=(.+)/;

/** Gets the current user information using the `id` command. */
export async function getCurrentUser(): Promise<CurrentUser> {
  const { stdout } = await sh('id');
  const t = stdout.trim();

  const uidMatch = UID_RE.exec(t);
  const gidMatch = GID_RE.exec(t);
  const groupsMatch = GROUPS_RE.exec(t);

  return {
    name: uidMatch?.[2] || 'unknown',
    uid: parseInt(uidMatch?.[1] || '0', 10),
    group: {
      name: gidMatch?.[2] || 'unknown',
      gid: parseInt(gidMatch?.[1] || '0', 10),
    },
    groups:
      groupsMatch?.[1]?.split(',').map((g) => {
        const m = /([0-9]+)\(([^)]+)\)/.exec(g);
        if (!m) {
          throw new Error(`failed to parse group '${g}'`);
        }
        return {
          name: m[2],
          gid: parseInt(m[1], 10),
        };
      }) || [],
  };
}

/** Options for getUserInfo operation. */
export interface GetUserInfoOptions {
  readonly user: string;
}

/** User information from /etc/passwd. */
export interface UserInfo {
  readonly user: string;
  readonly uid: number;
  readonly gid: number;
  readonly gecos: string;
  readonly home: string;
  readonly shell: string;
}

/** Parses /etc/passwd content into an array of user entries. */
export function parsePasswdFile(data: string): UserInfo[] {
  return data
    .trim()
    .split('\n')
    .map((line, i) => {
      const parts = line.split(':');
      if (parts.length < 7) {
        throw new Error(`invalid user entry on line ${i + 1}`);
      }
      return {
        user: parts[0],
        uid: parseInt(parts[2], 10),
        gid: parseInt(parts[3], 10),
        gecos: parts[4],
        home: parts[5],
        shell: parts[6],
      };
    });
}

/** Configuration for createUser operation. */
export interface CreateUserOptions {
  readonly user: string;
  readonly uid?: number;
  readonly gid?: number;
  readonly gecos?: string;
  readonly home?: string;
  readonly shell?: string;
  readonly system?: boolean;
}

/**
 * **[IDEMPOTENT]** Creates or modifies a user account.
 *
 * Creates a new user if it doesn't exist, or updates existing user
 * properties that differ from the desired state.
 *
 * @param options - User creation/modification options
 */
export async function createUser({
  user,
  uid,
  gid,
  gecos,
  home,
  shell,
  system,
}: CreateUserOptions): Promise<void> {
  return task(
    `create user ${user}`,
    async (ctx) => {
      const users = parsePasswdFile(await readFile(PASSWD_PATH));
      const prev = users.find((entry) => entry.user === user);
      if (prev !== void 0) {
        const changes = [];
        const args = [];
        if (uid !== void 0 && prev.uid !== uid) {
          args.push(`-u ${uid}`);
          changes.push({
            type: 'user',
            resource: user,
            property: 'uid',
            from: String(prev.uid),
            to: String(uid),
          });
        }
        if (gid !== void 0 && prev.gid !== gid) {
          args.push(`-g ${gid}`);
          changes.push({
            type: 'user',
            resource: user,
            property: 'gid',
            from: String(prev.gid),
            to: String(gid),
          });
        }
        if (gecos !== void 0 && prev.gecos !== gecos) {
          args.push(`-c ${$_(gecos)}`);
          changes.push({
            type: 'user',
            resource: user,
            property: 'gecos',
            from: prev.gecos,
            to: gecos,
          });
        }
        if (home !== void 0 && prev.home !== home) {
          args.push(`-d ${$_(home)}`);
          changes.push({
            type: 'user',
            resource: user,
            property: 'home',
            from: prev.home,
            to: home,
          });
        }
        if (shell !== void 0 && prev.shell !== shell) {
          args.push(`-s ${$_(shell)}`);
          changes.push({
            type: 'user',
            resource: user,
            property: 'shell',
            from: prev.shell,
            to: shell,
          });
        }

        if (changes.length > 0) {
          if (!ctx.dryRun) {
            await sh(`usermod ${args.join(' ')} ${$_(user)}`);
          }
          emitChanged(changes);
        }
      } else {
        if (!ctx.dryRun) {
          let cmd = 'useradd';
          if (uid !== void 0) cmd += ` -u ${uid}`;
          if (gid !== void 0) cmd += ` -g ${gid}`;
          if (gecos) cmd += ` -c ${$_(gecos)}`;
          if (home) cmd += ` -d ${$_(home)}`;
          if (shell) cmd += ` -s ${$_(shell)}`;
          if (system) cmd += ' --system';
          cmd += ` ${user}`;
          await sh(cmd);
        }
        emitChanged({ type: 'user', resource: user, property: 'created' });
      }
    },
    {
      details: () => ({
        uid,
        gid,
        gecos,
        home,
        shell,
      }),
      verbosity: VERBOSITY_NORMAL,
    },
  );
}

/** Configuration for deleteUser operation. */
export interface DeleteUserOptions {
  readonly user: string;
}

/**
 * **[IDEMPOTENT]** Deletes a user account.
 *
 * Does nothing if the user doesn't exist.
 */
export async function deleteUser({ user }: DeleteUserOptions): Promise<void> {
  return task(
    `delete user ${user}`,
    async (ctx) => {
      const users = parsePasswdFile(await readFile(PASSWD_PATH));
      if (users.some((entry) => entry.user === user)) {
        if (!ctx.dryRun) {
          await sh(`userdel ${$_(user)}`);
        }
        emitChanged({ type: 'user', resource: user, property: 'deleted' });
      }
    },
    { verbosity: VERBOSITY_NORMAL },
  );
}

/** Group information from /etc/group. */
export interface GroupInfo {
  readonly name: string;
  readonly gid: number;
  readonly members: string[];
}

/** Parses /etc/group content into an array of group entries. */
export function parseGroupFile(data: string): GroupInfo[] {
  return data.split('\n').map((line, i) => {
    const parts = line.split(':');
    if (parts.length < 4) {
      throw new Error(`invalid group entry on line ${i + 1}`);
    }
    return {
      name: parts[0],
      gid: parseInt(parts[2], 10),
      members: parts[3].split(',').filter(Boolean),
    };
  });
}

/** Configuration for createGroup operation. */
export interface GroupOptions {
  readonly name: string;
  readonly gid?: number;
  readonly members?: string[];
  readonly system?: boolean;
}

/**
 * **[IDEMPOTENT]** Creates or modifies a group.
 *
 * Creates a new group if it doesn't exist, or updates existing group
 * properties (gid, members) that differ from the desired state.
 *
 * @param options - Group creation/modification options
 */
export async function createGroup({ name, gid, members, system }: GroupOptions): Promise<void> {
  return task(
    `create group ${name}`,
    async (ctx) => {
      const groups = parseGroupFile(await readFile(GROUP_PATH));
      const prev = groups.find((g) => g.name === name);
      if (prev !== void 0) {
        if (gid !== void 0 && prev.gid !== gid) {
          if (!ctx.dryRun) await sh(`groupmod -g ${gid} ${$_(name)}`);

          emitChanged({
            type: 'group',
            resource: name,
            property: 'id',
            from: String(prev.gid),
            to: String(gid),
          });
        }

        if (members !== void 0) {
          if (members.length > 0) {
            const diffMembers = diffArrays(prev.members, members, (a, b) => a.localeCompare(b));
            if (diffMembers !== null) {
              if (!ctx.dryRun) await sh(`gpasswd -M ${$_(members.join(','))} ${$_(name)}`);
              emitChanged([
                ...diffMembers.removed.map((m) => ({
                  type: 'group',
                  resource: name,
                  property: 'members',
                  from: m,
                })),
                ...diffMembers.added.map((m) => ({
                  type: 'group',
                  resource: name,
                  property: 'members',
                  to: m,
                })),
              ]);
            }
          } else if (prev.members.length !== 0) {
            if (!ctx.dryRun) await sh(`gpasswd -M '' ${$_(name)}`);
            emitChanged(
              prev.members.map((m) => ({
                type: 'group',
                resource: name,
                property: 'members',
                from: m,
              })),
            );
          }
        }
      } else {
        if (!ctx.dryRun) {
          let cmd = 'groupadd';
          if (gid !== void 0) cmd += ` -g ${gid}`;
          if (system) cmd += ` --system`;
          cmd += ` ${$_(name)}`;
          await sh(cmd);
        }
        emitChanged({ type: 'group', resource: name, property: 'created' });

        if (members && members.length > 0) {
          if (!ctx.dryRun) await sh(`gpasswd -M ${$_(members.join(','))} ${$_(name)}`);
          emitChanged(
            members.map((m) => ({
              type: 'group',
              resource: name,
              property: 'member',
              to: m,
            })),
          );
        }
      }
    },
    {
      details: () => ({
        gid,
        members: members !== void 0 ? members.join(',') : void 0,
      }),
      verbosity: VERBOSITY_NORMAL,
    },
  );
}

/** Configuration for deleteGroup operation. */
export interface DeleteGroupOptions {
  readonly name: string;
}

/**
 * **[IDEMPOTENT]** Deletes a group.
 *
 * Does nothing if the group doesn't exist.
 */
export async function deleteGroup({ name }: DeleteGroupOptions): Promise<void> {
  return task(
    `delete group ${name}`,
    async (ctx) => {
      const groups = parseGroupFile(await readFile(GROUP_PATH));
      if (groups.some((g) => g.name === name)) {
        if (!ctx.dryRun) await sh(`groupdel ${$_(name)}`);
        emitChanged({ type: 'group', resource: name, property: 'deleted' });
      }
    },
    { verbosity: VERBOSITY_NORMAL },
  );
}
