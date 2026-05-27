/**
 * Creates a remote trap that will be executed after connection is closed.
 */
export function remoteTrap(script: string): string {
  return `( while kill -0 $$ 2>/dev/null; do sleep 5; done; ${script} ) & disown`;
}
