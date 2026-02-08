#!/usr/bin/env sh

set -eu

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not in a git repository, skipping hook install."
  exit 0
fi

git config core.hooksPath .githooks
chmod +x .githooks/commit-msg
echo "Installed git hooks from .githooks/"
