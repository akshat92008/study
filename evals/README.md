# Cognition OS Evals

`npm run evals` runs a small deterministic seed harness for no-PULSE learning behavior:

- autopsy missing-evidence safety
- Socratic tutor quality
- daily plan specificity
- revision card quality

CI uses mocked answers so the harness is stable. Live AI evaluation can be added behind `LIVE_AI_EVALS=true` without making normal build or test depend on provider availability.
