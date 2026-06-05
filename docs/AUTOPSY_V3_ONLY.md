# Autopsy V3 Only

## Legacy Route Disabled
The legacy Autopsy routes (`/api/autopsy/*`) have been disabled to remove runtime split-brain between legacy Autopsy and Autopsy V3. Any requests to legacy endpoints will now return an HTTP `410 Gone` with a message instructing callers to use Autopsy V3.

## V3 Route Map
Autopsy V3 routes are active and should be used exclusively:
- `POST /api/autopsy/v3/upload` - Upload PDF assessments
- `POST /api/autopsy/v3/assessments` - Create assessments
- `GET /api/autopsy/v3/assessments` - List assessments
- `GET /api/autopsy/v3/assessments/[id]` - Retrieve assessment
- `PATCH /api/autopsy/v3/assessments/[id]` - Update assessment
- `POST /api/autopsy/v3/assessments/[id]/questions` - Add answers
- `POST /api/autopsy/v3/assessments/[id]/reasons` - Add reasons
- `POST /api/autopsy/v3/assessments/[id]/generate-report` - Generate mistake report
- `POST /api/autopsy/v3/answer-key` - Generate answer keys
- `POST /api/autopsy/v3/extract` - Extract text from images
- `POST /api/autopsy/v3/reflection` - Generate reflections
- `GET /api/autopsy/v3/reminders` - Get reminders

## Active Tables
- `assessments` (V3 base table)
- `assessment_questions`
- `assessment_attempts`
- `mistake_records`

## Deprecated Tables
- `mock_autopsies` (legacy)
- `autopsy_questions` (legacy)

## Migration Note for Future Cleanup
The files for the legacy routes have been kept momentarily but truncated to serve the `410 Gone` error. Once we are absolutely certain that no stray frontend clients, mobile clients, or background queues attempt to call the legacy routes, we can completely remove the `app/api/autopsy/ingest`, `app/api/autopsy/manual`, `app/api/autopsy/jobs` directories and corresponding legacy database tables.
