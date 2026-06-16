#!/bin/bash
set -e
echo "Running CI pipeline locally..."
npm ci
npm run typecheck
npm run lint
npm run build
echo "CI pipeline completed successfully!"
