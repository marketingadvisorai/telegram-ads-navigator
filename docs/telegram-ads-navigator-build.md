# Engineering Implementation Plan

## Suggested File and Module Structure

The Telegram Ads Navigator should ship as a focused feature slice inside Atmos, with a thin OpenClaw bridge for message delivery and task execution.

### Atmos web app

**Frontend**

- `src/routes/telegram-ads-navigator/`
  - Main internal page for operators
  - Session list, account state, review queue, execution history
- `src/lib/features/telegram-ads-navigator/components/`
  - ChatThreadView
  - RecommendationCard
  - ApprovalQueue
  - AccountSelector
  - ExecutionLogPanel
- `src/lib/features/telegram-ads-navigator/stores/`
  - Session store
  - Recommendation store
  - Approval state store
- `src/lib/features/telegram-ads-navigator/types/`
  - Shared domain types for session, message, recommendation, action, approval, execution result
- `src/lib/features/telegram-ads-navigator/utils/`
  - Message formatting
  - Diff summarization
  - Validation helpers

**Backend API**

- `src/routes/api/v1/telegram-ads/`
  - `sessions`
  - `messages`
  - `recommendations`
  - `approvals`
  - `actions`
  - `webhook` or `ingest`
- `src/lib/server/telegram-ads/`
  - `controller.ts` for request coordination
  - `service.ts` for core orchestration
  - `parser.ts` for turning agent output into structured items
  - `normalizer.ts` for account, campaign, and metric normalization
  - `formatter.ts` for Telegram safe rendering
  - `policy.ts` for approval and action gating
  - `audit.ts` for event logging
  - `errors.ts` for feature specific error handling

**Integrations**

- `src/lib/server/integrations/openclaw/telegram-ads-bridge.ts`
  - Receives OpenClaw event payloads
  - Maps Telegram thread and user metadata into Atmos session records
- `src/lib/server/integrations/google-ads/`
  - Read only account summary adapter for MVP
  - Future write adapter for approved actions
- `src/lib/server/integrations/claude/`
  - Prompt assembly and response normalization if Atmos directly participates in analysis

**Persistence**

- `db/schema/telegram_ads_sessions`
- `db/schema/telegram_ads_messages`
- `db/schema/telegram_ads_recommendations`
- `db/schema/telegram_ads_approvals`
- `db/schema/telegram_ads_actions`
- `db/schema/telegram_ads_audit_log`
- `db/schema/telegram_ads_account_links`

### OpenClaw side

OpenClaw should stay lightweight and event driven.

- `skills/telegram-ads-navigator/`
  - Prompt and behavior instructions for the Telegram agent
  - Response shape rules so Atmos can parse outputs reliably
- `scripts/telegram-ads/`
  - Small wrapper entrypoints for structured handoff if needed
- `tmp/` or runtime cache
  - Short lived correlation IDs and delivery receipts only

OpenClaw should not become the system of record. Atmos should own state, approvals, and audit history.

## OpenClaw and Atmos Integration Approach

### Responsibility split

**OpenClaw responsibilities**

- Receive Telegram messages
- Maintain conversational continuity in chat
- Invoke analysis workflows
- Return human readable recommendations
- Collect approval intent from the operator
- Forward structured event payloads to Atmos

**Atmos responsibilities**

- Persist sessions and recommendations
- Link Telegram users to ad accounts and workspaces
- Enforce approval policy
- Store audit logs and execution history
- Render internal operator UI
- Trigger downstream Google Ads actions after approval

### Integration pattern

Use an event handoff model instead of tight request coupling.

1. Telegram message arrives in OpenClaw
2. OpenClaw identifies this as a Telegram Ads Navigator conversation
3. OpenClaw sends a structured event to Atmos with message metadata, parsed intent, and any generated recommendation blocks
4. Atmos stores the event and updates the session state
5. Atmos responds with acknowledgment and any required policy decision
6. OpenClaw uses that response to decide whether to continue chat, request approval, or hold execution

### Event types for MVP

- `session.started`
- `message.received`
- `analysis.completed`
- `recommendation.created`
- `approval.requested`
- `approval.received`
- `action.blocked`
- `action.executed`
- `action.failed`

### Structured payload requirements

Each payload should include:

- Correlation ID
- Telegram chat ID and message ID
- User identifier
- Atmos workspace or tenant identifier
- Linked ad account identifier if known
- Session status
- Recommendation list with severity and confidence
- Whether approval is required
- Raw natural language summary for display

### Auth and trust model

- OpenClaw authenticates to Atmos with a dedicated internal API key
- Atmos validates signature, timestamp, and workspace mapping
- Only Atmos may authorize write actions
- OpenClaw may suggest actions but must not directly mutate ad accounts in MVP

## Phased MVP Implementation Plan

### Phase 1: Session capture and recommendation logging

Goal: capture Telegram conversations and persist structured recommendations in Atmos.

Scope:

- Ingest Telegram conversation events from OpenClaw
- Create and update sessions in Atmos
- Save parsed recommendations with status `proposed`
- Show sessions and recommendations in an internal Atmos page
- Support read only account context and performance snapshots

Done when:

- A Telegram discussion creates a traceable session in Atmos
- Recommendations appear in the operator UI
- Every recommendation has source message linkage and timestamp

### Phase 2: Approval workflow inside Atmos

Goal: separate suggestion from execution with explicit operator control.

Scope:

- Add approval queue and reviewer state
- Let operator mark recommendation as approved, rejected, or needs revision
- Send approval outcome back to OpenClaw for conversational follow up
- Add complete audit entries for every approval decision

Done when:

- No recommendation can move toward execution without recorded approval
- Telegram conversation reflects the current approval state clearly
- Audit history shows who approved what and when

### Phase 3: Controlled action execution

Goal: execute a small set of safe Google Ads changes after approval.

Scope:

- Restrict action catalog to low risk, reversible operations
- Start with examples such as pause keyword, add negative keyword, or adjust budget within a guardrail
- Add pre execution validation
- Add post execution result logging and failure handling
- Display before and after state in Atmos

Done when:

- Approved actions execute through Atmos only
- Execution results are written back to both Atmos and Telegram
- Failed actions are visible with clear retry or rollback guidance

### Phase 4: Production hardening

Goal: make the system reliable enough for daily operator use.

Scope:

- Retry handling for transient integration failures
- Idempotency protection on webhook and action processing
- Better parsing resilience for agent outputs
- Permissions by workspace and role
- Monitoring dashboards and alerting

Done when:

- Duplicate Telegram events do not create duplicate actions
- Operators can diagnose errors without reading logs directly
- Core flows are stable under normal production traffic

## Future Extensions for Approvals and Actions

### Approval extensions

- Multi step approvals for higher risk actions
- Approval thresholds based on spend level or account type
- Expiring approvals that require fresh confirmation
- Delegated approvers by workspace or client brand
- Approval bundles for batched low risk changes

### Action extensions

- Create and edit campaigns, ad groups, and ads
- Bulk keyword mining and negative list application
- Budget pacing adjustments based on guardrails
- Search term review workflow
- Asset recommendations for sitelinks, callouts, and headlines
- Scheduled actions with delayed execution windows

### Operator experience extensions

- Diff previews before approval
- Suggested rollback plans for each action
- Confidence scoring with evidence links
- Session summaries by account and date range
- Escalation to a human strategist when confidence is low

### Intelligence extensions

- Pattern detection across accounts
- Recommendation prioritization by estimated impact
- Automatic grouping of related suggestions into action plans
- Learning loop from approved versus rejected recommendations

## Risks and Rollout Strategy

### Key risks

**Parsing risk**

Agent responses may vary in shape and make structured extraction unreliable.

Mitigation:

- Enforce a strict response contract for Telegram Ads Navigator outputs
- Store both raw text and normalized records
- Fail safely to `review required` instead of guessing

**Authorization risk**

A Telegram reply could be mistaken for valid approval.

Mitigation:

- Treat Telegram approval as intent only in early phases
- Require approval confirmation in Atmos before execution
- Add role checks and action scope checks

**Execution risk**

An approved change may still be unsafe or invalid at run time.

Mitigation:

- Validate current account state before execution
- Restrict MVP actions to reversible changes
- Log full before and after snapshots where possible

**State drift risk**

Telegram, Atmos, and ad platform state can fall out of sync.

Mitigation:

- Make Atmos the source of truth for session and approval state
- Use correlation IDs across all systems
- Reconcile action results back into session history

**User trust risk**

If recommendations feel opaque or inconsistent, adoption will stall.

Mitigation:

- Show concise rationale and evidence for each recommendation
- Start with read only insights and human approval
- Keep action scope narrow until trust is earned

### Rollout strategy

**Stage 1: Internal shadow mode**

- OpenClaw sends events to Atmos
- Atmos stores recommendations only
- No approvals and no execution
- Team validates data quality and session flow

**Stage 2: Internal approval mode**

- Operators review and approve inside Atmos
- Approval outcomes are recorded but actions are still manual outside the system
- Team validates approval UX and policy rules

**Stage 3: Limited execution pilot**

- Enable a short list of low risk actions for one or two internal accounts
- Require Atmos approval for every action
- Review logs after every execution day

**Stage 4: Controlled client rollout**

- Expand to selected client accounts with explicit consent
- Apply workspace level feature flags
- Monitor error rates, approval latency, and action reversal rate

**Stage 5: General availability**

- Release once auditability, permissions, and failure handling are proven
- Keep high risk actions behind separate feature flags
- Continue measuring recommendation quality versus operator acceptance

## Recommended MVP boundary

To ship fast and safely, the first release should do four things well:

- capture Telegram sessions
- persist structured recommendations in Atmos
- support explicit approval workflow
- prepare for execution without performing broad autonomous changes

That boundary keeps the product useful on day one while preserving operator trust and lowering implementation risk.
