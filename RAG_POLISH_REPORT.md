# RAG Polish Report

## Audit Current State

**Current Upload Routing:**
- Located in `app/api/ai/chat/route.ts`. Uses regex like `STUDY_MATERIAL_UPLOAD_RE` and `EXPLICIT_READ`. 
- Handles `shouldRouteUploadToAutopsy` checking if the file goes to autopsy.
- Highly coupled in the chat route.
- Needs the clean separation provided by `classifyChatUploadIntent`.

**Current Ingestion Path:**
- `await ingestStudyMaterial(...)` is called directly in `app/api/ai/chat/route.ts`.
- This is a synchronous call within the request lifecycle, which risks timing out on Vercel for larger documents.

**Current Source Panel Status:**
- `StudyMaterialPanel.tsx` exists and is imported in `CommandCenter.tsx`.
- UI looks basic and needs polish for material status, source selection, etc.

**Current Citation Display Status:**
- Citations are currently generated as plain text by the LLM in the prompt (`prompt-level`).
- They need to be extracted and rendered nicely in the UI.

**Files Changed:**
*(Will be updated as work progresses)*

**Tests Added:**
*(Will be updated as work progresses)*

**Validation Results:**
*(Will be updated as work progresses)*
