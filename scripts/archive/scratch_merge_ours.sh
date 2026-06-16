#!/bin/bash
set -e

# Fetch all branches
git fetch origin

# Find all remote codex branches
branches=$(git branch -r | grep 'origin/codex' | sed 's/origin\///' | tr -d ' ')

for branch in $branches; do
  echo "Merging $branch into main favoring main (-X ours)..."
  
  if ! git merge "origin/$branch" -m "chore: merge $branch into main favoring main" -s recursive -X ours; then
    echo "MERGE FAILED on $branch even with -X ours!"
    git merge --abort
    exit 1
  fi
done

echo "All branches merged successfully."
