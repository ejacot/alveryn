#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
canonical_version="$(tr -d '[:space:]' < "$repository_root/VERSION")"
frontend_version="$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$repository_root/frontend/package.json" | head -n 1)"
lockfile_version="$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$repository_root/frontend/package-lock.json" | head -n 1)"
backend_version="$(sed -n '/<artifactId>alveryn-api<\/artifactId>/{n;s/^[[:space:]]*<version>\([^<]*\)<\/version>.*/\1/p;q;}' "$repository_root/backend/pom.xml")"

if [[ -z "$canonical_version" || -z "$frontend_version" || -z "$lockfile_version" || -z "$backend_version" ]]; then
  echo "Unable to read every application version." >&2
  exit 1
fi

if [[ "$canonical_version" != "$frontend_version" ||
      "$canonical_version" != "$lockfile_version" ||
      "$canonical_version" != "$backend_version" ]]; then
  echo "Application versions are inconsistent:" >&2
  echo "  VERSION:                $canonical_version" >&2
  echo "  frontend/package.json:  $frontend_version" >&2
  echo "  frontend/package-lock:  $lockfile_version" >&2
  echo "  backend/pom.xml:         $backend_version" >&2
  exit 1
fi

echo "Alveryn version $canonical_version is consistent."
