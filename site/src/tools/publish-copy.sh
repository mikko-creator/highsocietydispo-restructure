#!/bin/sh
# publish-copy.sh — refresh the repo copy of this project (a WHITELIST: the site, its source, the build's
# images and the handoff docs). The crawl evidence (audit/, home/), the option boards (labs/), the earlier versions
# (versions/) and the original downloads (assets/source/) stay in the working project. Re-run for every update; it fails closed if the
# copy names another client or does not rebuild dist/ byte for byte.
#
#   sh src/tools/publish-copy.sh <repo-dir>      then: node src/tools/make-preview.mjs --out <repo-dir>/preview
set -eu
P=$(cd "$(dirname "$0")/../.." && pwd)
D=${1:?usage: sh src/tools/publish-copy.sh <repo-dir>}
for d in dist src docs assets/optimized; do
  mkdir -p "$D/$d"
  rsync -a --delete --exclude '.DS_Store' "$P/$d/" "$D/$d/"
done
cp "$P/docs/README.md" "$D/README.md"
printf 'preview/\ndist-*/\n.DS_Store\nnode_modules/\n' > "$D/.gitignore"
# a client's repo names no other client (tool comments and docs included). The names live in a local file
# (audit/publish-guard.txt, never published) so this script names nobody either.
G="$P/audit/publish-guard.txt"; [ -s "$G" ] || { echo "STOP: $G is missing"; exit 1; }
if grep -rliE "$(cat "$G")" "$D" --exclude-dir=.git --exclude-dir=preview; then
  echo "STOP: the copy names another client (files above)"; exit 1
fi
# the copy must rebuild the site exactly
(cd "$D" && node src/tools/build.mjs --out dist-verify >/dev/null)
if ! diff -rq "$D/dist" "$D/dist-verify" >/dev/null; then diff -rq "$D/dist" "$D/dist-verify" | head; echo "STOP: the copy does not rebuild dist/ byte for byte"; rm -rf "$D/dist-verify"; exit 1; fi
rm -rf "$D/dist-verify"
echo "repo copy refreshed: $D (no other client named; rebuilds dist/ byte for byte)"
