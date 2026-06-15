# Cognition OS Feature Delivery Matrix

This document audits the delivery status of major claimed features within Cognition OS to ensure no "fake" or unreachable features are presented to the user.

## Classification Legend

- **DELIVERED**: Feature exists, works end-to-end, integrates with the core loop, and is discoverable by users.
- **PARTIALLY_DELIVERED**: Works partially but lacks key pieces (e.g., UI, tests, or core loop integration).
- **CODE_ONLY**: Code exists but it is not wired to the UI or user flows.
- **BROKEN**: Feature exists and is reachable but fails during execution.
- **DUPLICATE_OR_LEGACY**: Superseded by a newer path or duplicate logic.
- **REMOVE_OR_HIDE**: Feature does not work and should be hidden from the product until fixed.

---

## Matrix

| Feature | Code Exists? | API Exists? | DB Schema? | Auth/RLS? | UI Entry? | Core Loop? | Automated Test? | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Core Learning Loop** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (Canonical) | ✅ | **DELIVERED** |
| **Amaura Agent Runtime** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **DELIVERED** |
| **Practice Sets & Scoring** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **DELIVERED** |
| **Autopsy (Mistake Diagnosis)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **DELIVERED** |
| **Repair Loop** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **DELIVERED** |
| **Revision / Flashcards** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **DELIVERED** |
| **Agent Activity Feed** | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | **DELIVERED** |
| **Notification Feed** | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | **DELIVERED** |
| **Notes API & UI** | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | **DELIVERED** |
| **URL Ingestion** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **DELIVERED** |
| **Account Export** | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | **DELIVERED** |
| **Account Deletion** | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | **DELIVERED** |
| **Admin Cockpit** | ✅ | ✅ | ✅ | ✅ | ✅ (Protected) | N/A | ✅ | **DELIVERED (BETA)** |
| **Billing Portal** | ✅ | ❌ | ❌ | ❌ | ❌ | N/A | ❌ | **HIDE (CODE_ONLY)** |
| **Atlas Direct Mastery Update** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | **PARTIALLY_DELIVERED** |

## Notes
- All `DELIVERED` features use the canonical core loop for state mutation. No agent tool fakes success.
- `billing` is correctly hidden in `deliveryStatus.ts`.
- Agent tools that bypassed the core loop (`upsert_atlas_concept`, `update_concept_mastery`, `create_memory_card`) have been marked as `compatibility_disabled` and routing is correctly pushed through `write_learning_event` and canonical projection.
