#!/usr/bin/env bash

set -euo pipefail

cd packages/sysopkit/

current_version=$(jq -r .version package.json)
package_name=$(jq -r .name package.json)
published_version=$(npm --no-workspaces view "$package_name" version 2>/dev/null || echo "")

if [[ "$published_version" == "$current_version" ]]; then
  echo "Version $current_version already published"
  exit 0
fi

filename="${PWD}/archive.tgz"
bun pm pack --filename "$filename"
npm --no-workspaces publish "$filename" --access public "$@"
rm -rf "$filename"
