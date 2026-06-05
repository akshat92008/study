# Manual Beta Launch Runbook

This runbook outlines the operational steps required to manage the Cognition OS manual beta, including granting access, monitoring health, handling failures, and scaling up limits.

## 1. Granting Manual Beta Access
To assign manual beta access to a user, use the admin API route:
\`\`\`bash
curl -X POST https://your-domain.com/api/admin/users/grant-beta \\
  -H "Authorization: Bearer <ADMIN_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "<user-uuid>"}'
\`\`\`
This uses \`lib/admin/user-management.ts\` to give the user the \`beta_access\` flag and insert a \`manual_beta_granted\` audit event.

## 2. Granting Access to Founders
To ensure founders bypass standard limits, you can assign them the unlimited flag (or appropriate role) via the Supabase Dashboard:
1. Go to **Authentication -> Users** in Supabase.
2. Update the user metadata or profiles table to grant the \`admin\` or \`founder\` role depending on your configuration.
3. Alternatively, if there is a specific route or script for founders, use that to bypass standard \`DAILY_BUDGET_USD\` restrictions. 

## 3. Checking Queue Health and Dead Letter Queue (DLQ)
Monitor the health of background tasks and event processing:
\`\`\`bash
curl -H "x-internal-worker-secret: $INTERNAL_WORKER_SECRET" \\
     https://your-domain.com/api/internal/workers/process-events
\`\`\`
(A GET request returns the health summary).
The health endpoint provides metrics for \`pendingEvents\`, \`dlqCount\`, and \`processingLocks\`. 
Additionally, you can use the admin UI endpoint at \`/api/admin/queue/status\` to view the event queue.

## 4. Retrying Failed Events
If events end up in the \`event_dlq\` or fail to process, they can be retried using the admin API:
\`\`\`bash
curl -X POST https://your-domain.com/api/admin/queue/retry \\
  -H "Authorization: Bearer <ADMIN_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"eventId": "<event-uuid>"}'
\`\`\`
This will move the event back to \`PENDING\` status to be picked up by the next worker run.

## 5. Safely Bumping the Rate Limit (Scaling to 30 Users)
Currently, the daily budget limit is \`0.25\` USD per user. To safely bump this limit once the beta scales:
1. Open \`lib/ai/cost-guard.ts\`.
2. Locate the \`DAILY_BUDGET_USD()\` function.
3. Adjust the default fallback or update your environment variable:
   \`\`\`
   AI_PER_USER_DAILY_BUDGET_USD=0.50
   \`\`\`
4. Deploy the environment variable changes to your Vercel (or hosting) project to take effect immediately without a redeploy.

## 6. Verifying the Autopsy Pipeline
To quickly verify that the autopsy pipeline and core loops are functioning properly in production without running the full integration test suite, run the beta100 smoke test:
\`\`\`bash
npm run smoke:beta100
\`\`\`
This lightweight test runs a complete cycle (creating an autopsy, simulating events) and ensures the end-to-end functionality is intact in the live environment.
