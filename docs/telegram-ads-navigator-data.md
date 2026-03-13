# Data Architecture

## 1. callback_data scheme

Telegram callback data should be treated as a compact routing envelope, not as a place to store business data. The button payload should only carry enough information to identify the screen, the action, and the minimum context needed to rebuild the next view from server-side state.

### Design goals

- Keep payloads short and deterministic
- Avoid embedding account names, metrics, filters, or user-visible text
- Make every callback idempotent
- Allow validation against stored session state
- Prevent cross-account or cross-user execution
- Distinguish safe navigation from write actions

### Recommended structure

Each callback payload should contain these logical parts:

1. Version
2. Product surface
3. Action type
4. Target entity type
5. Target entity identifier
6. Cursor or page token reference when relevant
7. Short state reference
8. Integrity or nonce reference for write actions

### Field meanings

- **Version**: Supports future evolution of the format without breaking existing buttons
- **Product surface**: Identifies the navigator area such as accounts, campaigns, ad groups, ads, keywords, audiences, or reports
- **Action type**: Examples include open, back, next, prev, refresh, filter, select, approve, pause, enable, archive, duplicate
- **Target entity type**: Account, campaign, ad set, ad group, ad, keyword, creative, audience, insight row
- **Target entity identifier**: Internal canonical ID, not platform-specific raw payload
- **Cursor or page token reference**: Points to a stored pagination object instead of carrying the full cursor
- **Short state reference**: Links to the server-side session snapshot for the user and chat
- **Integrity or nonce reference**: Required for write actions so stale or replayed buttons can be rejected

### Operational rules

- All buttons should resolve through a server-side callback parser
- The parser should reject malformed, expired, or cross-user payloads
- Raw Google Ads page tokens and Meta cursors should not be stored directly in callback payloads
- Filters and sort settings should be referenced via state ID, not duplicated on every button
- Buttons that trigger writes should include a confirmation step with a new callback payload and a short expiration window
- Every callback should be traceable in logs with user ID, chat ID, account ID, action type, and outcome

### Callback classes

#### Navigation callbacks
Used for opening screens, moving across lists, drilling into entities, and returning to previous views.

Properties:
- Safe to retry
- No confirmation required
- Can use longer session TTL
- May reuse the same state reference across multiple steps

#### Refresh callbacks
Used to rebuild the same screen with fresh data.

Properties:
- Safe to retry
- Should preserve filters, sort, and pagination intent where possible
- Should invalidate stale cache entries only for the active slice, not the whole account

#### Selection callbacks
Used to switch account, date range, metric preset, or filter scope.

Properties:
- Should write updated session state
- Should reset downstream pagination because the result set changed
- Should preserve breadcrumb navigation history where useful

#### Write-intent callbacks
Used for pause, enable, budget change, status change, audience inclusion, or other mutations.

Properties:
- Must be separated from read-only navigation
- Must require explicit confirmation
- Must carry or reference a one-time action token
- Must expire quickly
- Must be rejected if underlying entity state changed since the action was prepared

## 2. State model

The state model should be server-side and session-centric. Telegram messages and buttons are only a thin interaction layer. The actual source of truth for what the user is viewing must live in persistent session state.

### Core principles

- One active navigator session per user per chat context
- State is durable across message edits and callback retries
- UI rendering is derived from state plus cached platform data
- Any platform fetch should be reproducible from saved state
- State should be explicit, not inferred from message text

### Session state layers

#### A. Identity and scope layer
Defines who is interacting and what they are allowed to access.

Fields:
- Internal user ID
- Telegram user ID
- Chat ID
- Workspace or tenant ID
- Connected platform identities
- Allowed account IDs by platform
- Current selected platform
- Current selected account
- Current role and permission level

#### B. View layer
Defines the current UI location.

Fields:
- Current screen key
- Parent screen key
- Breadcrumb stack
- Selected entity type
- Selected entity ID
- Date range preset or custom range
- Metric preset
- Current comparison mode if any

#### C. Query layer
Defines how the current list or report was produced.

Fields:
- Active filters
- Search term
- Sort field
- Sort direction
- Grouping mode
- Pagination mode
- Page size
- Active cursor reference
- Result snapshot ID

#### D. Data freshness layer
Tracks whether the rendered view is backed by fresh enough data.

Fields:
- Last fetch timestamp
- Cache key set used for render
- Freshness status
- Stale-after timestamp
- Hard-expiry timestamp
- Last platform sync status
- Last platform error summary

#### E. Action safety layer
Tracks pending write operations.

Fields:
- Pending action ID
- Pending action type
- Pending target entity
- Prepared at timestamp
- Expires at timestamp
- Confirmation status
- Idempotency key
- Expected precondition snapshot

### Navigation state transitions

- Selecting a platform resets account selection and downstream view state
- Selecting an account resets entity focus, filters, and pagination to account defaults
- Changing date range invalidates report slices and pagination snapshots tied to metrics
- Changing filters creates a new result snapshot and resets page position
- Opening an entity detail view appends a breadcrumb entry and stores the parent query snapshot
- Returning back should restore the exact prior list state where possible

### Message rendering model

Each rendered Telegram message should reference:
- The session state ID
- The render version
- The result snapshot ID
- The message purpose such as primary navigator, confirmation, or error recovery

This allows safe message edits and recovery if Telegram callbacks arrive out of order.

## 3. Normalized data schema for Google Ads and Meta Ads

A normalized schema is necessary so the Telegram layer can render one common navigation model across both ad platforms. The normalization layer should preserve important platform-specific fields but expose a shared canonical shape for navigation, metrics, filters, permissions, and write safety.

## 3.1 Shared entity model

Every entity stored for navigator use should have:

- Internal canonical ID
- Platform name
- Platform account ID
- Platform raw entity ID
- Parent canonical ID where relevant
- Entity type
- Display name
- Status
- Delivery status or serving status if available
- Objective or subtype if available
- Currency
- Timezone
- Created time if available
- Updated time if available
- Last synced time
- Raw payload reference
- Normalization version

### Shared entity types

- Account
- Campaign
- Ad set
- Ad group
- Ad
- Keyword
- Creative
- Audience
- Search term
- Insight row
- Conversion action

## 3.2 Account schema

### Canonical account fields
- Canonical account ID
- Platform
- Platform account ID
- Display name
- Account status
- Currency
- Timezone
- Business or manager ID if applicable
- Permissions scope
- Last sync timestamp

### Google Ads mapping
- Customer ID
- Descriptive name
- Currency code
- Time zone
- Manager relationship when relevant
- Account status

### Meta Ads mapping
- Ad account ID
- Account name
- Currency
- Timezone name and offset if needed
- Business ID when available
- Account status

## 3.3 Campaign schema

### Canonical campaign fields
- Canonical campaign ID
- Canonical account ID
- Platform campaign ID
- Name
- Status
- Effective status
- Objective
- Buying type or campaign subtype
- Budget model reference
- Start date
- End date
- Last sync timestamp

### Google Ads campaign specifics
- Advertising channel type
- Advertising channel subtype
- Bidding strategy type
- Campaign budget ID
- Network targeting flags

### Meta Ads campaign specifics
- Objective
- Special ad categories if any
- Buying type
- Bid strategy when available
- Daily or lifetime budget if defined at campaign level

## 3.4 Mid-level delivery group schema

A common model should represent the delivery layer beneath campaign and above ad or creative. The canonical name can be **delivery group**, with platform-specific labels retained for display where needed.

### Canonical delivery group fields
- Canonical delivery group ID
- Canonical campaign ID
- Platform entity ID
- Platform entity type
- Name
- Status
- Effective status
- Budget if controlled at this layer
- Bid strategy summary
- Audience summary
- Placement summary
- Schedule summary
- Last sync timestamp

### Google Ads mapping
The delivery group maps to **ad group**.

Additional useful fields:
- Ad group type
- CPC bid or target settings when available
- Keyword count

### Meta Ads mapping
The delivery group maps to **ad set**.

Additional useful fields:
- Optimization goal
- Billing event
- Attribution setting if available
- Daily or lifetime budget
- Start and end time

## 3.5 Ad schema

### Canonical ad fields
- Canonical ad ID
- Canonical delivery group ID
- Canonical campaign ID
- Platform ad ID
- Name or generated label
- Status
- Effective status
- Creative reference
- Preview reference if available
- Last sync timestamp

### Google Ads mapping
- Ad ID
- Ad type
- Final URL summary
- Headline summary
- Description summary
- Policy summary if available

### Meta Ads mapping
- Ad ID
- Ad name
- Creative ID
- Tracking spec summary
- Effective status
- Preview reference if available

## 3.6 Keyword schema

Keywords are native to Google Ads and not a direct Meta entity, so the normalized model should allow platform-specific optionality.

### Canonical keyword fields
- Canonical keyword ID
- Canonical delivery group ID
- Platform keyword ID
- Text
- Match type
- Status
- Approval or review summary if available
- Bid amount if available
- Last sync timestamp

### Google Ads mapping
- Ad group criterion ID
- Keyword text
- Match type
- Criterion status
- CPC bid if present
- Quality indicators when available for reporting views

### Meta Ads mapping
- Not applicable

## 3.7 Audience schema

### Canonical audience fields
- Canonical audience ID
- Platform
- Platform account ID
- Platform audience ID
- Name
- Audience type
- Source type
- Status
- Size summary if available
- Last sync timestamp

### Google Ads mapping
- User list or audience resource identifiers where exposed
- Type and size ranges where available

### Meta Ads mapping
- Custom audience ID
- Lookalike audience ID if relevant
- Subtype
- Approximate count when available
- Retention days when relevant

## 3.8 Metrics schema

Metrics should be normalized into a separate fact model instead of being stored directly on entities. This prevents stale entity rows and supports multiple date windows.

### Canonical metric dimensions
- Platform
- Canonical account ID
- Canonical entity type
- Canonical entity ID
- Date range key
- Time grain
- Attribution mode if relevant
- Breakdown key if relevant

### Canonical metric values
- Impressions
- Clicks
- Spend
- Conversions
- Conversion value
- CTR
- CPC
- CPM
- CPA
- ROAS
- Reach when available
- Frequency when available
- Video views when available
- Result count with platform-specific label retained

### Metric normalization rules
- Store money values in minor units plus currency for precision and consistency
- Preserve both raw platform values and normalized derived values when calculations matter
- Mark unavailable metrics as null, not zero
- Attach metric provenance such as source report type and sync timestamp

## 3.9 Raw payload preservation

Normalization should never discard the original platform payload. Each canonical row should reference a raw payload record or blob so the system can:

- Rebuild missing fields without another API call
- Diagnose mapping bugs
- Display platform-specific detail on demand
- Safely support future schema extensions

## 4. Caching strategy

Caching should optimize for fast Telegram interactions while preserving freshness where the user expects live data. The right model is layered cache with explicit TTLs by data class.

### Cache layers

#### A. Session cache
Stores active navigator session state and current result snapshots.

Use for:
- Current screen context
- Filters and sort settings
- Breadcrumbs
- Pending action tokens
- Current page references

Characteristics:
- Short to medium TTL
- Strong consistency for the active user session
- Fast read and update path

#### B. Entity cache
Stores normalized account, campaign, delivery group, ad, keyword, and audience records.

Use for:
- List rendering
- Detail view basics
- Cross-platform navigation
- Name lookup for breadcrumbs and confirmations

Characteristics:
- Medium TTL
- Can be refreshed incrementally by account and entity type
- Supports stale-while-revalidate behavior for read-only screens

#### C. Metrics cache
Stores result sets for common date ranges and filters.

Use for:
- Dashboard summaries
- Campaign lists with KPIs
- Ad set or ad group performance views
- Detail performance cards

Characteristics:
- Shorter TTL than entity cache
- Keyed by account, entity type, date range, filter signature, sort signature, and page window or cursor snapshot
- Should record query cost and fetch latency for tuning

#### D. Raw response cache
Stores recent raw API responses for debugging and recovery.

Characteristics:
- Short TTL
- Access controlled tightly
- Not used directly for rendering except fallback diagnostics

### Freshness policy by data type

- **Account and structural entities**: longer TTL because names and hierarchy change less often
- **Status fields**: shorter TTL because users expect pause or enable states to reflect quickly
- **Metrics and spend**: shortest TTL because users use Telegram for near-live checks
- **Audiences and estimated sizes**: medium TTL because values are slower moving and sometimes approximate anyway

### Cache key design

Every cache key should include:
- Tenant or workspace scope
- User or permission scope when needed
- Platform
- Account
- Entity type
- Query signature
- Date range or reporting window
- Schema version

This prevents cross-user leakage and makes invalidation predictable.

### Invalidation rules

- Account switch invalidates active result snapshots for the previous account
- Filter or sort change creates a new metrics cache key, not an in-place overwrite
- Manual refresh should invalidate only the relevant account and entity slice
- Successful write actions should invalidate affected entity cache, parent list cache, and relevant metrics cache
- Platform sync failures should not wipe good cached data. They should mark it stale with error metadata

### Recommended behavior for Telegram UX

- Render quickly from cache if fresh enough
- If cache is slightly stale, render cached data with an updated timestamp and trigger background refresh for the next interaction
- If cache is too stale for a write confirmation or safety-critical status check, force a live fetch before allowing the action

## 5. Pagination data model

Pagination must be server-side, snapshot-based, and independent from Telegram button text. The user experience should feel simple, but the backend should treat pagination as a reproducible query artifact.

### Core pagination record

Each paginated result set should create a pagination snapshot containing:

- Pagination snapshot ID
- Session state ID
- Platform
- Account ID
- Entity type
- Query signature
- Sort signature
- Date range key if metrics are involved
- Page size
- Current page index when using offset pagination
- Cursor before reference when available
- Cursor after reference when available
- Total count if available
- Has next page
- Has previous page
- Result item IDs for the current page
- Created at timestamp
- Expires at timestamp

### Strategy by platform and use case

#### Offset-based pagination
Use when the data source is already normalized in internal storage and total counts are cheap.

Best for:
- Cached entity lists
- Search results from internal tables
- Stable result sets where sort order is deterministic

#### Cursor-based pagination
Use when the underlying platform API is cursor-first or when the result set is too large for reliable offset access.

Best for:
- Meta API list endpoints
- Large live result sets
- API-backed report pages

### Snapshot rule

Telegram buttons should reference a pagination snapshot ID, not raw page numbers alone. This avoids broken navigation when filters or sort order change between clicks.

### Page window model

For each rendered list page, store:
- The ordered canonical entity IDs displayed
- The first item sort value
- The last item sort value
- The source cache keys used to build the page
- The cursor references needed to go next or previous

This allows consistent back navigation and message re-rendering.

### Total count handling

Not every platform query returns a cheap total count. The model should support:
- Exact total count
- Estimated total count
- Unknown total count

The UI should not depend on exact totals to function.

### Pagination reset rules

Reset pagination when:
- Account changes
- Entity type changes
- Filters change
- Search term changes
- Sort field or direction changes
- Date range changes for metric-based lists

Do not reset pagination when:
- User opens a detail view and comes back to the same query snapshot
- The same page is refreshed without query changes

## 6. Read-only vs write-action safety model

The navigator should default to read-only behavior. Mutations should be treated as a separate capability layer with stricter permissions, fresher data requirements, and explicit confirmation.

### Safety tiers

#### Tier 1: Read-only navigation
Examples:
- List accounts
- View campaigns
- Open ad detail
- Change date range
- Search and filter
- Refresh data

Requirements:
- Standard authenticated session
- Account access permission
- Cached data allowed within freshness policy
- Safe to retry

#### Tier 2: Low-risk write intents
Examples:
- Pause or enable campaign, ad set, ad group, or ad
- Rename an entity if supported later

Requirements:
- Elevated permission for the platform account
- Live pre-action state check
- Explicit confirmation step
- Idempotency key
- Audit log record
- Immediate cache invalidation after success

#### Tier 3: High-risk write intents
Examples:
- Budget changes
- Bid strategy changes
- Audience edits
- Creation or deletion of entities

Requirements:
- Stronger role permission
- Fresh live data check
- Confirmation with clear summary of impact
- Short-lived one-time action token
- Optional secondary approval depending on workspace policy
- Strict audit logging with before and after state

### Permission model

Permissions should be evaluated on:
- User identity
- Workspace role
- Connected platform role
- Account-level access
- Action type
- Entity type

A user may be allowed to read an account but not mutate it. This separation should exist in both UI and backend enforcement.

### Confirmation model

For any write action, the system should generate a confirmation view containing:
- Human-readable action summary
- Platform
- Account name
- Entity name and type
- Current status or current value
- Requested new status or value
- Prepared timestamp
- Expiration timestamp

The confirmation button should not reuse the original navigation callback. It should use a dedicated one-time action reference.

### Precondition checks

Before executing a write, the system should verify:
- The action token is valid and unexpired
- The requester is the same user who prepared the action
- The account and entity still match the prepared action
- The current platform state still satisfies expected preconditions
- No more recent write has already changed the entity

If any check fails, the action should be rejected and the user should be guided back to a fresh detail view.

### Idempotency and replay protection

Every write should carry an idempotency key scoped to:
- User
- Platform
- Account
- Entity
- Action type
- Requested value

If Telegram retries the callback or the user taps twice, the backend should return the already-known result instead of executing again.

### Audit model

Every write attempt should log:
- Action ID
- User ID
- Telegram user ID
- Chat ID
- Platform and account
- Entity type and ID
- Requested change
- Before snapshot reference
- After snapshot reference when successful
- Outcome status
- Failure reason if any
- Timestamps for prepare, confirm, execute, and complete

### Default product posture

The first production version should ship with:
- Full read-only navigation for both Google Ads and Meta Ads
- Write actions behind a feature flag
- Pause and enable as the first supported mutations
- Budget and structural edits disabled until audit, confirmation, and rollback behavior are proven reliable

## 7. Recommended implementation sequence

1. Implement canonical IDs, session state, and callback routing
2. Build normalized account, campaign, delivery group, ad, keyword, and audience stores
3. Add metrics cache and pagination snapshots
4. Ship read-only navigator flows first
5. Add write-intent preparation, confirmation, and audit logging
6. Enable only low-risk mutations after live validation is stable

This architecture keeps Telegram interactions fast, keeps platform data organized, and makes write actions safe enough for production use.