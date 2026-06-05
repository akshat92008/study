#!/bin/bash
set -e

# Fetch all branches
git fetch origin

# Find all remote codex branches
branches=$(git branch -r | grep 'origin/codex' | sed 's/origin\///' | tr -d ' ')

for branch in $branches; do
  echo "Merging $branch into main..."
  
  # Try to merge without opening editor, fast-forward if possible, no edit
  if ! git merge "origin/$branch" -m "chore: merge $branch into main"; then
    echo "MERGE CONFLICT on $branch!"
    git merge --abort
    exit 1
  fi
done

echo "All branches merged successfully. Pushing to main..."
git push origin main
