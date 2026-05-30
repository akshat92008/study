# Cognition OS MVP - Manual Browser QA Checklist

This checklist is for founders and non-technical team members to verify the core MVP loop manually.

## 1. Authentication & Onboarding
- [ ] Open the app locally (`http://localhost:3000`)
- [ ] Sign up with a new test account (or login to an existing one)
- [ ] Complete onboarding if prompted
- [ ] Verify Dashboard opens successfully

## 2. Daily Session & Core Loop
- [ ] Verify exactly **one daily session card** appears on the dashboard
- [ ] Click the session card to start a study session
- [ ] Verify chat interface loads correctly
- [ ] Send a chat message (e.g., "Explain Newton's second law")
- [ ] Wait for AI response
- [ ] Refresh the page -> Verify chat history persists
- [ ] Complete the session by clicking "End Session" or similar
- [ ] Return to dashboard -> Verify current streak has updated (+1)

## 3. ATLAS & MEMORY
- [ ] Check if revision cards appear on the dashboard after the session
- [ ] Verify ATLAS concepts updated (e.g., Newton's second law mastery should be registered)
- [ ] Start a new chat session -> Verify chat knows about updated weak areas (MEMORY)

## 4. Mock Autopsies (Async Events)
- [ ] Upload a mock test autopsy (image or text format)
- [ ] Verify it shows as "pending" or "processing"
- [ ] Wait or manually trigger event cron (`npm run debug:events` can help verify status)
- [ ] Verify the autopsy completes and extracts mistakes
- [ ] Verify ATLAS updates with mistakes
- [ ] Verify Dashboard session card adapts based on the autopsy mistakes

## 5. Daily Reset
- [ ] (Optional) Simulate a new day or wait for next day
- [ ] Verify a new session card appears with adapted content

## Done!
If all above pass, the core MVP loop is functioning correctly.
