# Document Export — Manual Acceptance Test

Last updated: 2026-06-03

## Setup

1. Run `npm run dev` to start the development server.
2. Log in as a test user with an active session.
3. Navigate to the chat interface.

---

## Test Suite

### Test 1: Generate a NEET Mock Test with Status Labels

**Prompt to send in chat:**
```
Generate a 10-question NEET mock test on Electric Charges and Fields. 
Show each question with correct/incorrect status in front of the question number.
```

**Expected Results:**

- [ ] The response renders as a `GeneratedDocumentCard` (NOT plain text)
- [ ] The card header shows the test title, exam badge, question count
- [ ] Subject chips (Physics / Chemistry / Biology) appear in the header
- [ ] Each question has a status badge **before** the question text:
  - `[✓ Correct]` in green for correct answers
  - `[✗ Incorrect]` in red for incorrect answers
- [ ] Correct answer option is highlighted in green
- [ ] "Download PDF" button is visible at top-right of the card
- [ ] "Copy" button is visible at top-right of the card
- [ ] "Answer Key" button appears at the bottom of the card

---

### Test 2: PDF Download

**Steps:**
1. With the mock test card visible, click **PDF** button.
2. Wait for download to complete (button shows "Generating…" then downloads).

**Expected Results:**

- [ ] PDF file downloads (filename ends in `.pdf`)
- [ ] PDF opens in a PDF viewer
- [ ] Text in the PDF is **selectable** (not an image)
- [ ] You can copy-paste a question from the PDF and it preserves the text correctly
- [ ] OCR/extraction tools (e.g. `pdftotext`, Adobe Acrobat "Extract Text") detect question numbers and answers
- [ ] Status appears in front of question: `Q1. [✓ Correct] Physics · Electric Charges`
- [ ] Correct options are marked differently from incorrect ones
- [ ] **Answer Key table** appears at the end of the PDF with columns: Q No | Subject | Chapter | Answer | Status

---

### Test 3: Copy Text

**Steps:**
1. Click the **Copy** button on the mock test card.
2. Paste into a text editor.

**Expected Results:**

- [ ] Copied text contains all questions in readable format
- [ ] Status labels appear: `[Correct]`, `[Incorrect]`
- [ ] Options are clearly labelled: `A. ...`, `B. ...`, `C. ...`, `D. ...`
- [ ] Correct answers are present: `Correct Answer: B`
- [ ] Answer key table is at the bottom of the pasted text

---

### Test 4: Normal Chat Messages Are Unaffected

**Prompt to send:**
```
What is Coulomb's law?
```

**Expected Results:**

- [ ] Response renders as normal chat text (NOT as a document card)
- [ ] Markdown formatting is preserved (bold, lists, etc.)
- [ ] No PDF download button appears

---

### Test 5: Large Mock Test (20 Questions)

**Prompt:**
```
Generate a full 20-question NEET mock test covering Physics, Chemistry, and Biology.
Include correct answers. Mark 5 questions as correct and 3 as incorrect.
```

**Expected Results:**

- [ ] 20 questions render in the card
- [ ] Status summary in header: `✓ 5 correct  ✗ 3 incorrect`
- [ ] PDF downloads successfully with all 20 questions
- [ ] Answer key table has 20 rows

---

### Test 6: Unauthenticated PDF Export Rejection

**Steps:**
1. Log out of the app.
2. Send a `POST` request directly to `/api/documents/export-pdf` with a valid document payload (use DevTools or curl).

**Expected Result:**

- [ ] Response is `401 Unauthorized` with JSON body: `{ "error": "unauthorized" }`
- [ ] No PDF is returned

---

### Test 7: Rate Limit on PDF Export

**Steps:**
1. Log in.
2. Rapidly click the **PDF** button 6 times in a row within 60 seconds.

**Expected Result:**

- [ ] First 5 requests succeed and PDF downloads
- [ ] 6th request shows a rate limit error (button shows "Failed" briefly)

---

## Troubleshooting

| Symptom | Likely Cause |
|---------|-------------|
| Card renders as plain text instead of document card | AI returned plain text instead of `<artifact type="mock-test">` — check prompt instructions in `lib/ai/prompts/mind-prompt.ts` |
| PDF button shows "Failed" | Check browser DevTools Network tab for the `/api/documents/export-pdf` response |
| PDF text is not selectable | The wrong PDF generator is being used — ensure `html2canvas` is NOT being called; only `jspdf` text methods should run |
| Status badges not visible | The JSON from AI is missing `status` field — ask the AI explicitly for "correct/incorrect status on each question" |
| Answer key missing | The `MockTestDocument` might not have enough questions — verify the `questions` array is populated |
