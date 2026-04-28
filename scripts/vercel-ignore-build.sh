#!/bin/bash

echo "VERCEL_GIT_COMMIT_REF: $VERCEL_GIT_COMMIT_REF"

# Always build main and staging branches
if [[ "$VERCEL_GIT_COMMIT_REF" == "main" || "$VERCEL_GIT_COMMIT_REF" == "staging"  ]] ; then
  echo "✅ - Build can proceed (protected branch)"
  exit 1;
fi

# For PRs and other branches, check if frontend changed
# If git diff returns 0, no changes were found -> skip build (exit 0)
# If git diff returns 1, changes were found -> proceed with build (exit 1)
git diff --quiet HEAD^ HEAD ./packages/frontend

if [[ $? -eq 1 ]] ; then
  echo "✅ - Build can proceed (changes in packages/frontend)"
  exit 1;
else
  echo "🛑 - Build cancelled (no changes in packages/frontend)"
  exit 0;
fi
