---
title: Contributing
description: How to contribute to SysopKit development.
---

Thank you for your interest in SysopKit!

## Bug Reports

Report bugs by [opening an issue](https://github.com/localvoid/sysopkit/issues). Include:

- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Runtime environment (Node version, OS, etc.)

## Feature Requests

Open an issue with the "enhancement" label. Describe the feature, its use case, and how it fits into SysopKit's design.

## Pull Requests

1. Fork the repository and branch from `main`
2. Make logically grouped commits with clear messages
3. Run tests and type checking:
   ```bash
   bun run test
   bun run check
   ```
4. Rebase onto the latest `main` (no merge commits)
5. Open a PR against `main`

## License

SysopKit is dual-licensed under MIT or Apache-2.0. By contributing, you agree to license your contributions under both.
