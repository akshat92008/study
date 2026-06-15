# User Delivery Gaps

This document tracks features where the underlying code exists but the user currently cannot experience it naturally, or it is explicitly hidden due to being incomplete.

## Known Gaps

### 1. Billing Portal
- **State**: Code exists, but not wired to Stripe or fully tested.
- **Action Taken**: Explicitly hidden via `deliveryStatus.billing = 'hidden'`.
- **Resolution**: Need to complete Stripe webhook integration and thoroughly test the paid beta flow before exposing the UI.

### 2. Atlas Direct Mastery Update
- **State**: Code exists to directly manipulate mastery (`/api/atlas/mastery/*`).
- **Action Taken**: Marked as `PARTIALLY_DELIVERED`. It is not prominently exposed in the UI as the primary method for updating mastery is through the core loop (practice, chat, autopsy).
- **Resolution**: Expose a safe, traced direct-update UI component inside the Atlas Concept view if manual overrides are desired.

### 3. Agent Tool: `upsert_atlas_concept`
- **State**: Tool code exists in the registry but bypasses the canonical loop.
- **Action Taken**: Disabled (`compatibility_disabled`) in the registry. 
- **Resolution**: No action needed. This was an architectural gap that is now closed. Concept resolution belongs to the canonical projector.

### 4. Background Loops (Memory Consolidation)
- **State**: Event worker exists and trigger paths are wired.
- **Action Taken**: Ensured they do not duplicate mutations.
- **Resolution**: Fully integrate UI notifications when a background loop consolidates memory successfully so the user is aware.
