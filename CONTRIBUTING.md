# Contributing to SysopKit

Please take a moment to review this document in order to make the contribution process easy and effective for everyone involved!

## Using the issue tracker

You can use the issues tracker for:

- [bug reports](#bug-reports)
- [feature requests](#feature requests)
- [submitting pull requests](#pull-requests)

## Bug reports

A bug is a _demonstrable problem_ that is caused by the code in the repository. Good bug reports are extremely helpful - thank you!

Guidelines for bug reports:

1. **Use the GitHub issue search** — check if the issue has already been reported.
2. **Check if the issue has been fixed** — try to reproduce it using the `main` branch in the repository.
3. **Isolate and report the problem** — ideally create a reduced test case.

Please try to be as detailed as possible in your report. Include information about your operating system, Bun version, and target system details. Please provide steps to reproduce the bug as well as the outcome you were expecting! All these details will help developers to fix any potential bugs.

Example:

> Short and descriptive example bug report title
>
> A summary of the issue and the environment in which it occurs. If suitable, include the steps required to reproduce the bug.
>
> 1. This is the first step
> 2. This is the second step
> 3. Further steps, etc.
>
> Any other information you want to share that is relevant to the issue being reported. This might include the lines of code that you have identified as causing the bug, and potential solutions (and your opinions on their merits).

## Feature requests

Feature requests are welcome. But take a moment to find out whether your idea fits with the scope and aims of the project. It's up to _you_ to make a strong case to convince the community of the merits of this feature. Please provide as much detail and context as possible.

## Contributing Documentation

Code documentation has a special convention: it uses TSDoc formatting and the first paragraph is considered to be a short summary.

For functions say what it will do. For example write something like:

```ts
/**
 * Reverses the contents of a string or buffer.
 *
 * @param contents - The contents to reverse.
 * @returns The contents reversed lexically.
 */
function reverse(contents: string | Buffer): string {
  const text = Buffer.isBuffer(contents) ? contents.toString() : contents;
  return text.split('').reverse().join('');
}
```

For interfaces say what it represents. For example write something like:

```ts
/**
 * Abstracts command transport to a target system.
 */
interface Connector {
  connect(): Promise<void>;
  spawn(cmd: string[], signal?: AbortSignal): Promise<ExecResult>;
}
```

Keep in mind that the documentation notes might show up in a summary somewhere, long texts in the documentation notes create very ugly summaries. As a rule of thumb anything longer than 80 characters is too long.

Try to keep unnecessary details out of the first paragraph, it's only there to give a user a quick idea of what the documented "thing" does/is. The rest of the documentation notes can contain the details, for example parameters and what is returned.

If possible include examples. For example:

```ts
/**
 * Executes a command on the target system.
 *
 * @example
 *   await connector.spawn(["ls", "-la"]);
 *   await connector.spawn(["uname", "-a"], signal);
 *
 * @param cmd - The command and arguments to execute.
 * @param signal - Optional abort signal.
 * @returns The execution result with stdout, stderr, and exit code.
 */
```

This makes it easy to test the examples so that they don't go stale and examples are often a great help in explaining what a function does.

## Pull requests

Good pull requests - patches, improvements, new features - are a fantastic help. They should remain focused in scope and avoid containing unrelated commits.

**IMPORTANT**: By submitting a patch, you agree that your work will be licensed under the license used by the project (MIT or Apache-2.0).

If you have any large pull request in mind (e.g. implementing features, refactoring code, etc), **please ask first** otherwise you risk spending a lot of time working on something that the project's developers might not want to merge into the project.

Please adhere to the coding conventions in the project (indentation, accurate comments, etc.) and don't forget to add your own tests and documentation. When working with git, we recommend the following process in order to craft an excellent pull request:

1. [Fork](https://help.github.com/articles/fork-a-repo/) the project, clone your fork, and configure the remotes:

```sh
# Clone your fork of the repo into the current directory
git clone https://github.com/<your-username>/sysopkit
# Navigate to the newly cloned directory
cd sysopkit
# Assign the original repo to a remote called "upstream"
git remote add upstream https://github.com/<original-owner>/sysopkit
```

2. If you cloned a while ago, get the latest changes from upstream:

```sh
git checkout main
git pull upstream main
```

3. Create a new topic branch (off of `main`) to contain your feature, change, or fix.

**IMPORTANT**: Making changes in `main` is discouraged. You should always keep your local `main` in sync with upstream `main` and make your changes in topic branches.

```sh
git checkout -b <topic-branch-name>
```

4. Commit your changes in logical chunks. Keep your commit messages organized, with a short description in the first line and more detailed information on the following lines. Feel free to use Git's [interactive rebase](https://help.github.com/articles/about-git-rebase/) feature to tidy up your commits before making them public.

5. Make sure all the tests are still passing.

```sh
bun run test
```

6. Make sure you comply with the style guide. You can run the linter using

```sh
bun run check
```

7. Push your topic branch up to your fork:

```sh
git push origin <topic-branch-name>
```

8. [Open a Pull Request](https://help.github.com/articles/using-pull-requests/) with a clear title and description.

9. If you haven't updated your pull request for a while, you should consider rebasing on main and resolving any conflicts.

**IMPORTANT**: _Never ever_ merge upstream `main` into your branches. You should always `git rebase` on `main` to bring your changes up to date when necessary.

```sh
git checkout main
git pull upstream main
git checkout <your-topic-branch>
git rebase main
```

Thank you for your contributions!
