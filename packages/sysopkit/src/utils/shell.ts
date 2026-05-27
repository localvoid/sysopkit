/**
 * @module shell
 *
 * Shell command utilities for common shell operations.
 */

import { type ExecResult } from './process.js';

/**
 * Escapes a string for safe use as a shell argument.
 *
 * Uses single-quote escaping which is safe against all shell expansions.
 * If the argument contains only safe characters (alphanumeric, underscore,
 * hyphen, dot, forward slash), it is returned unchanged.
 *
 * @param arg - String to escape
 * @returns Shell-safe argument
 */
export function $_(arg: string): string {
  if (arg.length === 0) return "''";
  if (/^[a-zA-Z0-9_\-,.+:@%/]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Maps one exit code to another in a shell command.
 *
 * Transforms the exit code of a command: if the original exit code equals
 * `from`, the command will exit with `to` instead. Otherwise, it preserves
 * the original exit code. Useful for remapping error conditions.
 *
 * @param cmd - Shell command to wrap
 * @param from - Original exit code to match
 * @param to - New exit code to use when from is matched
 * @returns Wrapped command that remaps exit codes
 */
export function shMapExitCode(cmd: string, from: number, to: number): string {
  return `${cmd};[ $? -eq ${from} ]&&exit ${to}||exit $?`;
}

/** Mapping of exit code(s) to a replacement value. */
export interface ExitCodeRange {
  /** Exit code(s) to match (single value or array). */
  readonly from: number | number[];
  /** Replacement exit code. */
  readonly to: number;
}

/**
 * Maps multiple exit codes in a shell command using a case statement.
 *
 * Wraps the command with shell logic to remap specified exit codes.
 */
export function shMapExitCodeRange(cmd: string, map: ExitCodeRange[]): string {
  const cases = map
    .map(({ from, to }) => {
      const pattern = Array.isArray(from) ? from.join('|') : from;
      return `${pattern})e=${to};;`;
    })
    .join('');

  return `${cmd};o=$?;e=$o;case $o in ${cases}esac;exit $e`;
}

/**
 * Hides a password from command line arguments by using SYSOPKIT_ASKPASS
 *
 * Creates a temporary askpass script that outputs the password when invoked.
 * This prevents the password from appearing in process listings.
 *
 * @param cmd - Command to wrap with password
 * @param password - Password to pass to the command
 * @param env - Environment variable with a path to askpass script
 * @returns Shell command that uses askpass for password delivery
 */
export const shAskPass = (
  cmd: string,
  password: string,
  env: string = 'SYSOPKIT_ASKPASS',
): string =>
  [
    `${env}=$(mktemp)`,
    `trap 'rm -f "$${env}"' EXIT`,
    `printf "#!/bin/sh\\necho %s" ${$_(password)} > "$${env}"`,
    `chmod 700 "$${env}"`,
    `${cmd}`,
  ].join(';');

/**
 * Throws an error for non-zero exit codes, with special handling for
 * shell built-in errors and command-not-found scenarios.
 *
 * Exit codes >= 126 indicate system-level errors (command not found,
 * permission denied, invalid exit argument, signal termination).
 */
export function handleExitCode({ exitCode, stderr }: ExecResult): void {
  if (exitCode === 0) {
    return;
  }
  if (exitCode === 2) {
    // Incorrect use of shell built-in commands or syntax errors.
    throw new Error(stderr);
  }
  if (exitCode >= 126) {
    // 126   - Command found but is not executable (e.g., permission denied).
    // 127   - The executable was not found in the system's $PATH.
    // 128   - Invalid exit argument.
    // 129.. - Terminated by signal.
    throw new Error(stderr);
  }
}

/**
 * Parses shell-style configuration files (e.g., /etc/locale.conf).
 *
 * Handles KEY=VALUE format with optional quoting. Ignores comments and
 * blank lines.
 */
export function parseShellConf(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Regex matches: optional whitespace, key, '=', then value (handles basic quotes)

  content.split('\n').forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    const match = SHELL_CONF_LINE_RE.exec(line);
    if (match) {
      let [_, key, value] = match;

      // Remove surrounding single or double quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }
  });

  return result;
}

const SHELL_CONF_LINE_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/;
