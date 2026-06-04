# Autopsy V3

Autopsy V3 is the structured assessment and mistake-memory layer for Cognition OS. It supports manual assessments first, safe selectable-text PDF extraction, deterministic reports without AI, and optional Hermes-style memory writes.

## Supported Input Pathways

- Full assessments and tests
- Worksheets, assignments, quizzes, and past papers
- Manual multi-question mistake sets
- Answer key text such as `1 A`, `Q2: C`, or CSV-like lines
- Self-reflection signals such as repeated confusion or self-reported weakness
- Existing source upload, chat confusion, practice, and revision review pathways through `learning_signals`

## PDF Limitations

- Launch support is selectable-text PDF extraction only.
- OCR is disabled by default with `AUTOPSY_EXPERIMENTAL_OCR_ENABLED=false`.
- If extraction confidence is low, the route marks the assessment `manual_entry_required` and the UI continues with manual entry.
- Scanned PDFs are not promised to parse reliably.

## Report Structure

- Overview and score counts
- Subject breakdown
- Topic breakdown
- Mistake type breakdown
- Repeated patterns
- High-risk topics
- Recoverable marks estimate
- 7-day recovery protocol
- Revision actions
- Hermes memory candidates
- Summary text

## Hermes Memory Behavior

When `HERMES_AUTOPSY_V3_ENABLED=true`, report generation writes capped deterministic memory rows to `hermes_learning_memories`. Dashboard and reminders read stored rows only; they do not call AI or Hermes on page load.

## Cost Controls

- Deterministic report generation runs first and is always available.
- No per-question AI calls are made by default.
- PDF size is capped by `AUTOPSY_MAX_PDF_MB`.
- Questions per assessment are capped by `AUTOPSY_MAX_QUESTIONS_PER_ASSESSMENT`.
- Daily assessment, PDF upload, and report limits are route-enforced.
- Memory writes are capped by `HERMES_AUTOPSY_MAX_MEMORY_WRITES_PER_REPORT`.

## Env Vars

```env
AUTOPSY_V3_ENABLED=true
AUTOPSY_MAX_PDF_MB=5
AUTOPSY_MAX_QUESTIONS_PER_ASSESSMENT=200
AUTOPSY_MAX_AI_MISTAKES_PER_BATCH=25
AUTOPSY_MAX_REPORT_TOKENS=1200
AUTOPSY_DAILY_ASSESSMENTS_PER_USER=3
AUTOPSY_DAILY_PDF_UPLOADS_PER_USER=2
AUTOPSY_DAILY_REPORTS_PER_USER=3
AUTOPSY_EXPERIMENTAL_OCR_ENABLED=false
HERMES_AUTOPSY_V3_ENABLED=true
HERMES_AUTOPSY_V3_MODE=lite
HERMES_AUTOPSY_MAX_MEMORY_WRITES_PER_REPORT=10
HERMES_AUTOPSY_MAX_REMINDERS=3
```

## Manual Test Script

1. Sign in.
2. Open `/autopsy/deep`.
3. Create a custom assessment.
4. Paste 10 questions using CSV/manual table.
5. Add correct answers and user answers.
6. Save.
7. Confirm incorrect/skipped detection.
8. Add user reasons.
9. Generate report with AI disabled.
10. Confirm report sections.
11. Confirm Hermes Memory candidates written or skipped safely.
12. Enable Hermes Lite and regenerate another assessment.
13. Confirm fallback works if Hermes fails.
14. Upload invalid file and confirm rejection.
15. Upload PDF that cannot be parsed and confirm manual fallback.
16. Open dashboard and confirm Deep Autopsy card works.
17. Submit self-reflection and confirm learning signal.
18. Run tests, typecheck, and build.

## Final Verdict

AUTOPSY V3 PARTIALLY READY: the launch foundation is implemented for manual structured assessments, deterministic reporting, safe PDF fallback, memory rows, reminders, and multi-pathway signals. AI/Hermes report rewriting and OCR remain intentionally out of launch scope.
