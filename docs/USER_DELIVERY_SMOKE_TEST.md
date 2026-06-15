# Cognition OS User Delivery Smoke Test

This manual browser QA checklist verifies that the delivered features actually work from the user's perspective, without relying solely on unit tests.

## Prerequisites
- Local development server running (`npm run dev`)
- Clean test user account

## Checklist

### 1. Login / Onboarding
- [ ] User can sign up or log in.
- [ ] Onboarding flow completes successfully.

### 2. Dashboard First Load
- [ ] Dashboard loads without errors.
- [ ] Today's Session card is visible.
- [ ] Amaura Activity Feed is visible and shows initial "ready" state or empty state.
- [ ] Notification Feed icon (bell) is visible in the header.

### 3. Practice Flow
- [ ] Start a practice session or answer a single practice question.
- [ ] **Wrong Answer**:
  - [ ] Learner state updates (mastery drops or weakness registered).
  - [ ] Repair task is created and visible in Dashboard or Notifications.
  - [ ] Amaura Activity Feed shows the agent processed the mistake.
- [ ] **Correct Answer**:
  - [ ] Mastery updates successfully.
  - [ ] Amaura Activity Feed shows positive reinforcement or mastery update.

### 4. Repair Loop
- [ ] Navigate to "Mistakes to repair" on the Dashboard.
- [ ] Start immediate repair.
- [ ] Complete the repair question successfully.
- [ ] Repair status updates (delayed retest scheduled).
- [ ] Amaura Activity Feed reflects the completed repair.

### 5. Autopsy Flow
- [ ] Navigate to Autopsy and upload a test PDF or manually enter data.
- [ ] Autopsy report is generated.
- [ ] Approve the mistakes.
- [ ] Diagnoses enter the learner model (verify in Atlas/Weak Areas).
- [ ] Notifications appear indicating new repair tasks were created.

### 6. Revision & Notes
- [ ] Navigate to Notes.
- [ ] Create a new note successfully.
- [ ] Navigate to Revision/Flashcards.
- [ ] Ensure cards derived from practice mistakes or notes are present.

### 7. URL Ingestion
- [ ] Paste a URL into the material ingestion UI.
- [ ] Verify processing state.
- [ ] Confirm material is added to the Source Dashboard.

### 8. Infrastructure & Account
- [ ] Open Settings.
- [ ] Trigger "Export Data" and verify JSON downloads correctly.
- [ ] Trigger "Delete Account" and verify the confirmation modal appears and works.
- [ ] Verify Privacy Policy, Terms of Service, and Support links resolve correctly.

### 9. Admin Access Control
- [ ] Attempt to access `/admin` as a standard user -> Should be denied (403/Redirect).
- [ ] Login as an Admin and verify access to `/admin/amaura` cockpit.

---
**Sign-off:**
- Tested By: ___________
- Date: ___________
- Environment: ___________
