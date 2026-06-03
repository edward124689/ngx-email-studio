#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="gh-pages"
BUILD_DIR="$ROOT/dist/demo/browser"
WORKTREE="${TMPDIR:-/tmp}/ngx-email-studio-gh-pages"
BASE_HREF="/ngx-email-studio/"

cleanup() {
  git -C "$ROOT" worktree remove "$WORKTREE" --force >/dev/null 2>&1 || true
  rm -rf "$WORKTREE"
}
trap cleanup EXIT

cd "$ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree has uncommitted changes. Commit/push main before deploying demo." >&2
  git status --short >&2
  exit 1
fi

echo "Building demo for GitHub Pages (${BASE_HREF})..."
npm run build:lib
npx ng build demo --base-href "$BASE_HREF"

echo "Preparing ${BRANCH} worktree..."
rm -rf "$WORKTREE"
if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  git fetch origin "$BRANCH":"refs/remotes/origin/$BRANCH"
  git worktree add "$WORKTREE" "origin/$BRANCH"
else
  git branch -D "$BRANCH" >/dev/null 2>&1 || true
  git worktree add --detach "$WORKTREE" HEAD
  git -C "$WORKTREE" switch --orphan "$BRANCH"
  git -C "$WORKTREE" rm -rf . >/dev/null 2>&1 || true
fi

echo "Copying demo build..."
find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$BUILD_DIR"/. "$WORKTREE"/
touch "$WORKTREE/.nojekyll"

cd "$WORKTREE"
git add .
if git diff --cached --quiet; then
  echo "No demo changes to deploy."
else
  git commit -m "deploy: update demo pages"
  git push origin HEAD:"$BRANCH"
fi

git worktree remove "$WORKTREE" --force

echo "Demo deployed to branch ${BRANCH}."
