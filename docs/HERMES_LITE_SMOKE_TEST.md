# Hermes Lite Smoke Test (Phase 1)

This checklist ensures that Hermes Lite is functioning safely within its bounded parameters.

## Pre-requisites
- `.env.local` contains:
  ```env
  HERMES_ENABLED=true
  HERMES_MODE=lite
  HERMES_AUTOPSY_V3_MODE=lite
  ```

## 1. Autopsy Memory Extraction
- [ ] Complete a mock test or upload a mistake image via the Autopsy v3 interface.
- [ ] Verify that the report generation finishes.
- [ ] Inspect the Autopsy report page: The "Learning Memory" panel should appear, summarizing weak areas.
- [ ] Check the DB `hermes_learning_memories` table: Ensure rows are created with severity, pattern, and action_type.

## 2. MEMORY Cards Integration
- [ ] Go to the Revision / Flashcards page.
- [ ] Look for new cards generated from the Autopsy report.
- [ ] Verify in the DB `revision_cards` table that the new cards have `source = 'hermes_autopsy_memory'`.

## 3. MIND Chat Integration
- [ ] Go to the Chat interface.
- [ ] Ask a question related to the topic of your recent mistake.
- [ ] Verify that the AI Tutor brings up the mistake naturally (e.g., "I know you struggled with this recently...").
- [ ] (Admin) Check the server logs or `getRelevantHermesReminders` call to ensure the memories were retrieved and injected into the prompt.

## 4. Daily Session Adaptation
- [ ] Go to the Dashboard.
- [ ] The Daily Session Card should prioritize your recent mistake (Priority P2.5) if it has a high severity memory.
- [ ] Ensure the rationale text on the card explicitly mentions the memory pattern.

## 5. Admin Dashboard
- [ ] Visit `/admin/hermes`.
- [ ] Verify that the configuration panel correctly displays the Phase 1 settings.
- [ ] Check that recent memories are listed clearly.

## 6. Safety Checks
- [ ] Verify that `HERMES_AGENT_LOOP_ENABLED` and `HERMES_CODING_SANDBOX_ENABLED` are false in the admin panel.
- [ ] Ensure the daily memory write limits are enforced (max 30 per user).
