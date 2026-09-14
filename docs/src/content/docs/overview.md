---
title: Overview
description: What SysopKit is and why you'd use it.
---

SysopKit is a TypeScript-first infrastructure automation framework — a programmatic alternative to YAML-driven tools like Ansible.

Instead of learning a DSL, you write plain TypeScript with compile-time validation, IDE autocompletion, standard `try/catch` error handling, and npm packages for sharing reusable modules.

## Mental Model in 60 Seconds

Every script follows the same shape: `start()` opens a root execution context, `apply()` connects to your hosts and runs your function on each one, and inside that function you compose operations (`sh`, `createFile`, `installPackages`) with middleware (`sudo`, `trace`) and grouping (`task`). State you care about — the active connector, variables, dry-run mode — flows through the context tree automatically, so operations never take connection parameters.

## Why SysopKit?

- **No DSLs** — Full power of the TypeScript language.
- **Type-safe** — Catch configuration errors at compile time.
- **No agents** — Runs over SSH. Nothing to install on target hosts.
- **Idempotent** — Re-running a script converges to the same state instead of repeating side effects.
- **Zero NPM dependencies** — No external dependencies, fewer security risks.

## Next Steps

- [Getting Started](/getting-started/) — Install and run your first script.
- [Tutorial](/tutorial/) — Step-by-step provisioning walkthrough.
- [Architecture](/concepts/architecture/) — Deep dive into how SysopKit works.
