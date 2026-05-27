---
title: SysopKit vs Ansible
description: How SysopKit's TypeScript-first approach differs from Ansible's YAML DSL.
---

SysopKit takes a fundamentally different approach than Ansible. Instead of a YAML-based DSL with its own control flow constructs, SysopKit leverages TypeScript as a full programming language. This eliminates the need for many Ansible-specific features.

## Loops and Conditionals

Handled by standard TypeScript constructs. Where Ansible requires `loop:` directives and `when:` conditions, SysopKit uses `for` loops, `map()`, `filter()`, and `if/else` statements. This means you have the full expressiveness of a programming language rather than being limited to what the YAML DSL supports.

## Variable Assignment

Replaces Ansible's `register` directive. The result of any operation is simply returned as a value that you can store in a variable and use later. There's no special syntax — just normal TypeScript variables.

## Typed Configs

Replace string templates with structured data. Instead of generating config files through string interpolation, operations accept typed objects that are serialized correctly.

This eliminates template syntax errors, provides IDE autocomplete, and catches type mismatches at compile time rather than at deployment.

## Templates

Use TypeScript template literals or any templating library you prefer.

## Error Handling

Uses standard `try/catch/finally` blocks instead of Ansible's `block/rescue/always` construct. This gives you more fine-grained control over error handling and cleanup logic.

## Dynamic Inventory

Is just code. Instead of configuring plugins in YAML, you can fetch data from any API, parse JSON or YAML, transform it with TypeScript, and build your inventory programmatically. This works with any cloud provider, database, or custom source.

## Roles and Reuse

Work through npm packages and ES modules. Instead of Ansible's role directory structure, you can publish reusable automation as npm packages and import them with standard `import` statements. Version management comes from npm, and you can use any package in the TypeScript ecosystem.

## LSP and IDE Support

Leverages the full TypeScript tooling ecosystem. You get inline documentation from JSDoc comments, type-aware autocompletion, and refactoring tools out of the box. No need to install separate language servers or extensions — your editor already understands the code.
