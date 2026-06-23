# Study Room Simplification Audit

## Visible Routes
- Current normal-user routes include `/dashboard`, `/knowledge`, `/chat`, `/tutor`, `/revision`, `/mistakes`, `/autopsy`, `/planner`, `/mentor`, `/analytics`, `/cognition`, and `/settings`.
- Target normal-user routes are `/dashboard` (Home), `/materials`, `/study-room`, `/review`, and `/settings`.
- Legacy module routes should redirect to the new simplified sections instead of being linked from normal navigation.

## Current Navigation
- Sidebar exposes Dashboard, Knowledge Base, Tutor, Mistake Review, Learning Goals, and Recent Chats.
- It also uses product language such as Cognition OS, Mission Loop, Core Loop, and Learning Goals.
- Target navigation should expose only Home, Materials, Study Room, Review, and Settings.

## Dashboard Complexity
- `/dashboard` currently centers goals, missions, agent activity, seeded topics, profile metrics, drawers, and mistake review.
- Target Home should answer what to continue studying with compact sections: Continue studying, Materials ready, Weak areas to review, and Quick actions.

## Material Upload Flow
- Existing `/knowledge` page and `/api/materials/upload` already support upload, processing status, RAG chunks, source classification, and selected material IDs.
- Target Materials page should rename Sources to Materials and show extraction intelligence: status, source type, topics, question-like blocks, examples, formulas, chunks, and honest processing messages.

## Study Room Flow
- Existing `GlobalChat` and `/api/ai/chat` already accept `selectedMaterialIds` and build RAG context.
- Target Study Room should wrap chat with selected materials, extracted topic hints, source snippets, weak areas, and suggested user-led actions.

## Review / Weak Areas
- Existing `weak_area_events`, `mistake_diagnoses`, and revision cards can power the Review page.
- Target Review should be a simple weak-area and due-review list, not Autopsy, Memory, or analytics.

## User-Facing Name Cleanup
- Hide normal-user references to Mind, Command, Atlas, Autopsy, Agent, Daily Mission, Mission Loop, Learning OS, and Goals/Targets.
- Keep backend module names where changing them would increase risk.

## NEET-Specific Exposure
- NEET-specific templates and backend support can remain.
- General UI should default to uploaded materials, college notes, slides, question banks, assignments, and self-study.
