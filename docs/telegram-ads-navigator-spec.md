# Telegram Ads Navigator MVP Spec

## Purpose

Build a Telegram-native read-first navigation layer for ad account monitoring inside OpenClaw and Atmos. The goal is to let Tariqul browse account health, campaigns, search terms, conversions, alerts, and Meta summaries through clean message cards with inline buttons instead of long text dumps.

This spec covers the MVP only. It does not include implementation code.

## Product Summary

Telegram Ads Navigator is a conversational dashboard that lives inside Telegram chat. Each screen is a formatted message card plus an inline keyboard. The system should support fast drill-down from account level to campaign detail, then into supporting diagnostic views like search terms and conversion actions.

The MVP is read-only. It should feel fast, visual, and safe.

## UX Goals

1. Make account inspection feel like tapping through a compact mobile app inside Telegram.
2. Show the most decision-relevant metrics first.
3. Keep every screen scannable in under 5 seconds.
4. Support one-thumb navigation with predictable back behavior.
5. Minimize message spam by editing existing cards whenever possible.
6. Keep callback payloads stable and versioned.
7. Hide raw API complexity behind normalized internal data.
8. Make the UI beautiful enough that Tariqul prefers it over plain reports for quick checks.
9. Stay read-only by default so browsing cannot accidentally mutate ad accounts.
10. Degrade gracefully when data is stale, partial, or unavailable.

## Core UX Principles

### 1. One message = one screen
Each logical screen should map to one Telegram message card. Navigating within the same flow should usually edit the existing message instead of sending a new message.

### 2. Summary first, detail on tap
Do not overload the first screen. Show high-signal numbers, then allow drill-down.

### 3. Fixed button positions
Users should learn where actions live. For example:
- Top rows = primary navigation
- Middle rows = filtering and pagination
- Bottom row = Back and Refresh

### 4. Readability over density
Telegram is not a spreadsheet. Avoid trying to fit full reporting tables into chat. Prioritize top 5 to 10 items and use pagination.

### 5. Explicit freshness
Every card should show when the data was last fetched or served from cache.

## Supported MVP Screens

1. Account summary screen
2. Campaign list screen
3. Campaign detail screen
4. Search terms screen
5. Conversion actions screen
6. Alerts screen
7. Meta Ads overview screen

## Shared Message Card Pattern

Every screen should follow this pattern:

1. Header line with account or screen name
2. Time range line
3. 4 to 8 key metrics
4. Insight or warning block if relevant
5. Footer with freshness and page info
6. Inline keyboard

### Shared Footer Format

`Updated: 12m ago | Source: cache | Page 1/3`

### Shared Status Icons
Use consistent lightweight symbols that render well in Telegram:
- Green circle for healthy
- Yellow circle for caution
- Red circle for urgent
- Up arrow for improving trends
- Down arrow for worsening trends
- Dot for neutral sections

Avoid emoji overload. Use at most one status marker per line.

## Navigation Model

## Navigation Goals

The user should be able to:
- Start from an account overview
- Move to campaigns
- Open a campaign detail
- Jump from campaign detail to search terms or conversions
- Jump to alerts or Meta overview without losing context
- Go back one level consistently

## State Model

Represent navigation with a compact view state object.

### View State Fields

```json
{
  "version": 1,
  "platform": "google|meta|hybrid",
  "screen": "account|campaigns|campaign|search_terms|conversions|alerts|meta_overview",
  "account_id": "2910561991",
  "campaign_id": "123456789",
  "date_range": "LAST_30_DAYS",
  "page": 1,
  "page_size": 5,
  "sort": "spend_desc",
  "filter": "active",
  "message_id": 123,
  "chat_id": 5351778248,
  "parent": {
    "screen": "campaigns",
    "page": 2
  }
}
```

### State Storage Strategy

Use two layers:

1. Stateless callback_data for short routing metadata
2. Server-side ephemeral session state keyed by `chat_id + message_id + short_state_id`

Reason:
- Telegram callback_data is limited to 64 bytes
- Rich filters and breadcrumb context should live server-side

### Recommended Session Store

Use Redis if available. Fallback to database table if Redis is not available.

Suggested key:
`tg_nav:{chat_id}:{message_id}:{state_id}`

Suggested TTL:
- 30 minutes for active navigation sessions
- Extend TTL on every interaction

## Callback Data Scheme

## Design Constraints

Telegram `callback_data` max length is 64 bytes. Keep it short, versioned, and machine-safe.

## Proposed Format

`an:v1:{action}:{state}:{arg}`

Where:
- `an` = ads navigator
- `v1` = callback schema version
- `action` = route intent
- `state` = short state token, usually 6 to 10 chars
- `arg` = optional compact argument

### Examples
- `an:v1:open:s8fd2a:camp`
- `an:v1:page:s8fd2a:n2`
- `an:v1:camp:s8fd2a:c123`
- `an:v1:back:s8fd2a:1`
- `an:v1:refresh:s8fd2a:x`
- `an:v1:filter:s8fd2a:act`
- `an:v1:sort:s8fd2a:cpa`

### Action Dictionary
- `open` = open a named screen
- `page` = paginate
- `camp` = open campaign detail
- `term` = open search term detail or page
- `conv` = open conversions screen
- `meta` = open Meta overview
- `alert` = open alerts screen
- `back` = navigate to prior state
- `refresh` = force refresh
- `filter` = apply a named filter
- `sort` = apply sort mode
- `range` = switch date range

### Compact Argument Dictionary
- `acct` = account summary
- `camp` = campaigns list
- `meta` = Meta overview
- `alts` = alerts
- `st` = search terms
- `cv` = conversions
- `act` = active only
- `all` = all statuses
- `n1`, `n2`, `p1` = pagination tokens
- `7d`, `30d`, `90d` = date range tokens

## Screen-by-Screen Design

---

## 1. Account Summary Screen

### Purpose
Provide the fastest possible health snapshot for a Google Ads account, with optional cross-link to Meta overview.

### Primary Questions Answered
- How much did we spend and what did we get?
- Which campaigns need attention?
- Are there obvious alerts?
- Is Meta performing better or worse than Google?

### Card Layout

```text
ScreamWorks | Google Ads
Last 30 days

Spend: £3,547
Clicks: 7,340
Conversions: 96
CPA: £36.95
CTR: 8.1%
Top Campaign: Escape Rooms MOF
Worst CPA: £517.00

Alerts
🔴 Escape Rooms MOF has high spend and weak conversion efficiency
🟡 2 campaigns have zero conversions

Quick View
Active campaigns: 6
Paused campaigns: 22
Conversion actions: 16 enabled

Updated: 8m ago | Source: cache
```

### Inline Button Layout

Row 1:
- `Campaigns`
- `Alerts`

Row 2:
- `Conversions`
- `Meta Overview`

Row 3:
- `7D`
- `30D`
- `90D`

Row 4:
- `Refresh`

### Button Behavior
- `Campaigns` opens campaign list screen for this account
- `Alerts` opens alerts screen
- `Conversions` opens conversion actions screen
- `Meta Overview` opens Meta screen using normalized account mapping
- date buttons rerender same card with new range
- `Refresh` bypasses cache where safe

### Required Data Schema

```json
{
  "account": {
    "platform": "google",
    "account_id": "2910561991",
    "account_name": "ScreamWorks",
    "currency": "GBP",
    "timezone": "Europe/London"
  },
  "date_range": "LAST_30_DAYS",
  "summary": {
    "spend": 3547.00,
    "clicks": 7340,
    "impressions": 90555,
    "ctr": 0.081,
    "conversions": 96.0,
    "cpa": 36.95,
    "roas": null
  },
  "campaign_counts": {
    "active": 6,
    "paused": 22
  },
  "highlights": {
    "top_campaign_name": "Escape Rooms MOF",
    "top_campaign_id": "123456789",
    "worst_cpa_campaign_name": "Escape Rooms MOF",
    "worst_cpa": 517.00
  },
  "alerts": [
    {
      "severity": "high",
      "code": "HIGH_SPEND_LOW_RETURN",
      "message": "Escape Rooms MOF has high spend and weak conversion efficiency"
    }
  ],
  "freshness": {
    "fetched_at": "2026-03-13T00:30:00Z",
    "cache_age_seconds": 480,
    "source": "cache"
  }
}
```

---

## 2. Campaign List Screen

### Purpose
Show top campaigns in a compact ranked list with drill-down buttons.

### Primary Questions Answered
- Which campaigns are active?
- Which campaigns are spending the most?
- Which ones are efficient or broken?

### Default List Rules
- default page size: 5 campaigns
- default sort: spend descending
- default filter: active campaigns only

### Card Layout

```text
ScreamWorks | Campaigns
Last 30 days | Active only | Sort: Spend

1. Escape Rooms MOF
Spend £1,035 | Conv 2 | CPA £517

2. Corporate Team Building
Spend £48 | Conv 3 | CPA £16

3. Events Campaign
Spend £32 | Conv 1 | CPA £32

4. Brand Search
Spend £410 | Conv 22 | CPA £18.64

5. Generic Escape Room
Spend £629 | Conv 14 | CPA £44.93

Updated: 8m ago | Source: cache | Page 1/2
```

### Inline Button Layout

Row 1:
- `1`
- `2`
- `3`
- `4`
- `5`

These map to the visible campaigns on the current page.

Row 2:
- `Active`
- `All`
- `Sort Spend`
- `Sort CPA`

Row 3:
- `Prev`
- `Next`

Row 4:
- `Back`
- `Refresh`

### Alternative Button Labeling
If numeric buttons feel too abstract, use compact names:
- `MOF`
- `Corporate`
- `Events`
- `Brand`
- `Generic`

For MVP, numeric buttons are safer because they are consistent even when names are long.

### Required Data Schema

```json
{
  "account_id": "2910561991",
  "account_name": "ScreamWorks",
  "date_range": "LAST_30_DAYS",
  "filter": "active",
  "sort": "spend_desc",
  "page": 1,
  "page_size": 5,
  "total": 6,
  "items": [
    {
      "campaign_id": "123",
      "platform": "google",
      "name": "Escape Rooms MOF",
      "status": "ENABLED",
      "spend": 1035.00,
      "clicks": 1880,
      "conversions": 2.0,
      "cpa": 517.50,
      "ctr": 0.073,
      "impressions": 25700,
      "alerts": ["high_spend_low_return"]
    }
  ],
  "freshness": {
    "fetched_at": "2026-03-13T00:30:00Z",
    "cache_age_seconds": 480,
    "source": "cache"
  }
}
```

---

## 3. Campaign Detail Screen

### Purpose
Give a focused view for one campaign and act as the branching hub into search terms and conversion actions.

### Primary Questions Answered
- Is this campaign healthy?
- Where is spend going?
- Which downstream diagnostics should I inspect next?

### Card Layout

```text
Campaign | Escape Rooms MOF
Google Ads | Last 30 days

Status: Enabled
Spend: £1,035
Clicks: 1,880
Conversions: 2
CPA: £517.50
CTR: 7.3%
Avg CPC: £0.55

Health
🔴 High spend, low conversion output
🟡 Check search terms for waste
🟡 Confirm conversion tracking quality

Top Notes
Type: Search
Bidding: Max Conversions
Budget: £35/day

Updated: 8m ago | Source: live
```

### Inline Button Layout

Row 1:
- `Search Terms`
- `Conversions`

Row 2:
- `Prev Campaign`
- `Next Campaign`

Row 3:
- `Back to Campaigns`
- `Refresh`

### Optional MVP Enhancement
If enough room remains, include a fourth row:
- `Meta Compare`

This is optional. Not required for MVP.

### Required Data Schema

```json
{
  "account_id": "2910561991",
  "campaign": {
    "campaign_id": "123",
    "platform": "google",
    "name": "Escape Rooms MOF",
    "status": "ENABLED",
    "channel_type": "SEARCH",
    "bidding_strategy": "MAXIMIZE_CONVERSIONS",
    "daily_budget": 35.00,
    "currency": "GBP"
  },
  "date_range": "LAST_30_DAYS",
  "metrics": {
    "spend": 1035.00,
    "clicks": 1880,
    "impressions": 25700,
    "ctr": 0.073,
    "avg_cpc": 0.55,
    "conversions": 2.0,
    "cpa": 517.50
  },
  "health": {
    "score": 32,
    "status": "critical",
    "reasons": [
      "high_spend_low_return",
      "conversion_tracking_mismatch_possible"
    ]
  },
  "freshness": {
    "fetched_at": "2026-03-13T00:35:00Z",
    "cache_age_seconds": 0,
    "source": "live"
  }
}
```

---

## 4. Search Terms Screen

### Purpose
Surface waste and winners from actual search queries without forcing raw report exports.

### Primary Questions Answered
- What are users actually searching?
- Which queries spend without converting?
- Which terms deserve keyword expansion or negatives?

### Default Rules
- page size: 5 search terms
- default sort: spend descending
- default mode: all terms with spend > 0

### Card Layout

```text
Search Terms | Escape Rooms MOF
Last 30 days | Sort: Spend

1. escape room near me
Spend £148 | Clicks 210 | Conv 0

2. scary escape room london
Spend £76 | Clicks 84 | Conv 3

3. horror escape experience
Spend £64 | Clicks 51 | Conv 1

4. best team building london
Spend £53 | Clicks 72 | Conv 0

5. escape room birthday party
Spend £49 | Clicks 61 | Conv 2

Watchouts
🔴 2 high-spend queries with zero conversions

Updated: 10m ago | Source: cache | Page 1/4
```

### Inline Button Layout

Row 1:
- `Waste`
- `Winners`
- `All`

Row 2:
- `Prev`
- `Next`

Row 3:
- `Back to Campaign`
- `Refresh`

### Filter Semantics
- `Waste` = spend > threshold and conversions = 0
- `Winners` = conversions > 0 sorted by CPA or conversions desc
- `All` = default comprehensive list

### Required Data Schema

```json
{
  "account_id": "2910561991",
  "campaign_id": "123",
  "campaign_name": "Escape Rooms MOF",
  "date_range": "LAST_30_DAYS",
  "filter": "all|waste|winners",
  "sort": "spend_desc",
  "page": 1,
  "page_size": 5,
  "total": 17,
  "items": [
    {
      "search_term": "escape room near me",
      "match_context": "broad",
      "spend": 148.00,
      "clicks": 210,
      "impressions": 4300,
      "conversions": 0.0,
      "ctr": 0.0488,
      "cpa": null,
      "flag": "waste"
    }
  ],
  "summary": {
    "zero_conversion_spend": 312.00,
    "winner_count": 5
  },
  "freshness": {
    "fetched_at": "2026-03-13T00:28:00Z",
    "cache_age_seconds": 600,
    "source": "cache"
  }
}
```

---

## 5. Conversion Actions Screen

### Purpose
Let the user inspect which conversion actions exist and whether they are primary, secondary, enabled, or suspicious.

### Primary Questions Answered
- Are too many actions marked primary?
- Which actions are actually driving reported conversions?
- Are there noisy micro-conversions polluting optimization?

### Card Layout

```text
Conversion Actions | ScreamWorks
Last 30 days

1. Purchase GADS
Primary | Enabled | Conv 21

2. Purchase GA4
Primary | Enabled | Conv 18

3. Begin Checkout
Primary | Enabled | Conv 29

4. Contact Form
Primary | Enabled | Conv 8

5. Page View
Secondary | Enabled | Conv 412

Audit Signals
🟡 10 of 16 actions are primary
🟡 Review low-value actions marked primary

Updated: 14m ago | Source: cache | Page 1/4
```

### Inline Button Layout

Row 1:
- `Primary`
- `Secondary`
- `All`

Row 2:
- `Prev`
- `Next`

Row 3:
- `Back`
- `Refresh`

### MVP Scope Note
This screen is read-only. Do not include mutation actions like changing primary status in the MVP.

### Required Data Schema

```json
{
  "account_id": "2910561991",
  "account_name": "ScreamWorks",
  "date_range": "LAST_30_DAYS",
  "filter": "all|primary|secondary",
  "page": 1,
  "page_size": 5,
  "total": 16,
  "items": [
    {
      "conversion_action_id": "987",
      "name": "Purchase GADS",
      "category": "PURCHASE",
      "source": "WEBSITE",
      "status": "ENABLED",
      "primary": true,
      "conversions": 21.0,
      "value": null,
      "last_seen_at": "2026-03-12T21:00:00Z"
    }
  ],
  "audit": {
    "enabled_count": 16,
    "primary_count": 10,
    "recommended_primary_max": 5,
    "flags": [
      "too_many_primary_actions"
    ]
  },
  "freshness": {
    "fetched_at": "2026-03-13T00:20:00Z",
    "cache_age_seconds": 840,
    "source": "cache"
  }
}
```

---

## 6. Alerts Screen

### Purpose
Aggregate actionable warnings across the account into one compact triage view.

### Alert Categories for MVP
- High spend low conversions
- Campaign zero conversions
- Too many primary conversion actions
- Stale campaign with no impressions
- Meta campaign ended but historically strong
- Data freshness issue

### Card Layout

```text
Alerts | ScreamWorks
Open issues: 4

🔴 Escape Rooms MOF
High spend with only 2 conversions

🟡 2 campaigns
Active but zero conversions in selected range

🟡 Conversion setup
10 primary actions may be too many

🟡 Meta Team Building
Strong past performer ended on Mar 7

Updated: 5m ago | Source: computed
```

### Inline Button Layout

Row 1:
- `Critical`
- `All`

Row 2:
- `Open Campaign`
- `Open Meta`

Row 3:
- `Back`
- `Refresh`

### Interaction Rules
- `Open Campaign` should open the highest-severity related campaign alert target
- `Open Meta` should open the Meta overview when a Meta alert is present
- If no Meta alert exists, hide or disable `Open Meta`

### Required Data Schema

```json
{
  "account_id": "2910561991",
  "account_name": "ScreamWorks",
  "date_range": "LAST_30_DAYS",
  "filter": "all|critical",
  "items": [
    {
      "alert_id": "a1",
      "severity": "critical",
      "platform": "google",
      "entity_type": "campaign",
      "entity_id": "123",
      "entity_name": "Escape Rooms MOF",
      "code": "HIGH_SPEND_LOW_RETURN",
      "message": "High spend with only 2 conversions",
      "cta": "open_campaign"
    },
    {
      "alert_id": "a2",
      "severity": "warning",
      "platform": "meta",
      "entity_type": "campaign",
      "entity_id": "act_1042551150662411:tb1",
      "entity_name": "Team Building",
      "code": "ENDED_WINNER",
      "message": "Strong past performer ended on Mar 7",
      "cta": "open_meta"
    }
  ],
  "freshness": {
    "fetched_at": "2026-03-13T00:37:00Z",
    "cache_age_seconds": 300,
    "source": "computed"
  }
}
```

---

## 7. Meta Ads Overview Screen

### Purpose
Provide a single-screen Meta summary mapped to the same client, so Telegram feels cross-platform instead of Google-only.

### Primary Questions Answered
- How is Meta doing overall?
- Which Meta campaign is the winner?
- Are there obvious paused or ended opportunities?

### Card Layout

```text
ScreamWorks | Meta Ads
Last 30 days

Spend: £700
Purchases: 33
CPA: £21.21
Active campaigns: 0
Paused campaigns: 10
Ended winner: Team Building
Winner CPA: £18.07

Highlights
🟢 Team Building drove 25 purchases before ending
🟡 Escape Room Bookings spent £119 with 0 purchases

Updated: 11m ago | Source: cache
```

### Inline Button Layout

Row 1:
- `Top Campaigns`
- `Alerts`

Row 2:
- `Google Summary`
- `Refresh`

Row 3:
- `7D`
- `30D`
- `90D`

### MVP Scope Note
This screen is summary-only. No Meta campaign detail drill-down is required in MVP, but the data model should support it later.

### Required Data Schema

```json
{
  "account": {
    "platform": "meta",
    "account_id": "act_1042551150662411",
    "account_name": "ScreamWorks",
    "currency": "GBP",
    "timezone": "Europe/London"
  },
  "date_range": "LAST_30_DAYS",
  "summary": {
    "spend": 700.00,
    "purchases": 33,
    "cpa": 21.21,
    "active_campaigns": 0,
    "paused_campaigns": 10,
    "ended_campaigns": 2
  },
  "highlights": {
    "winner_campaign_name": "Team Building",
    "winner_campaign_id": "tb1",
    "winner_spend": 452.00,
    "winner_purchases": 25,
    "winner_cpa": 18.07,
    "wasted_campaign_name": "Escape Room Bookings",
    "wasted_spend": 119.00,
    "wasted_purchases": 0
  },
  "freshness": {
    "fetched_at": "2026-03-13T00:26:00Z",
    "cache_age_seconds": 660,
    "source": "cache"
  }
}
```

## Example Fully Rendered Telegram Card for ScreamWorks

This is a concrete example of what the account summary card should look like in Telegram.

```text
ScreamWorks | Google Ads
Last 30 days

Spend: £3,547
Clicks: 7,340
Conversions: 96
CPA: £36.95
CTR: 8.1%

Top Campaign: Escape Rooms MOF
Worst CPA: £517.00
Active: 6 | Paused: 22

Alerts
🔴 Escape Rooms MOF spent £1,035 for only 2 conversions
🟡 10 of 16 conversion actions are primary
🟡 Meta Team Building campaign ended after 25 purchases

Updated: 8m ago | Source: cache
```

Suggested inline keyboard under this exact card:

Row 1: `Campaigns` | `Alerts`
Row 2: `Conversions` | `Meta Overview`
Row 3: `7D` | `30D` | `90D`
Row 4: `Refresh`

## Pagination Approach

## General Rules

1. Use page size 5 for list-heavy screens.
2. Always show current page in footer.
3. Use inline `Prev` and `Next` buttons.
4. Disable or replace with dot placeholders at edges if needed.
5. Reuse the same message and edit in place.

## Why page size 5
- Fits comfortably in Telegram without wall-of-text fatigue
- Leaves room for status lines and footer
- Works well on mobile screens

## Pagination State
Maintain `page`, `page_size`, `sort`, and `filter` in server session state.

## Stable Ranking Rule
Within a given date range and sort mode, keep ranking deterministic to avoid button confusion between refreshes. Tie-break using campaign ID or name.

## Caching Approach

## Goals
- Make navigation feel instant
- Avoid hitting ad APIs on every button tap
- Keep freshness obvious
- Allow manual refresh when needed

## Cache Layers

### Layer 1: Normalized query cache
Cache normalized datasets by platform, account, screen, and date range.

Suggested key examples:
- `adsnav:google:acct:2910561991:summary:30d`
- `adsnav:google:acct:2910561991:campaigns:30d:active:spend_desc:p1`
- `adsnav:google:acct:2910561991:campaign:123:30d`
- `adsnav:meta:acct:act_1042551150662411:summary:30d`

### Layer 2: Render cache
Optional. Cache rendered message text plus button layout for a short TTL if rendering logic becomes expensive.

## Recommended TTLs
- Account summary: 5 min
- Campaign list: 5 min
- Campaign detail: 5 min
- Search terms: 10 min
- Conversion actions: 15 min
- Alerts: 5 min
- Meta overview: 10 min

## Refresh Rules
- Default navigation reads from cache if valid
- `Refresh` forces live fetch and rewrites cache
- If live fetch fails, serve stale cache with explicit `Source: stale-cache`

## Freshness Label Rules
Show one of:
- `Source: live`
- `Source: cache`
- `Source: stale-cache`
- `Source: computed`

## Data Normalization Between Google Ads and Meta Ads

## Why Normalization Matters
Telegram UI should not care about raw source field names. Both platforms should map into a common internal model so cards and alerts can be built consistently.

## Normalized Account Schema

```json
{
  "platform": "google|meta",
  "account_id": "string",
  "account_name": "string",
  "currency": "GBP",
  "timezone": "Europe/London",
  "status": "active|paused|unknown"
}
```

## Normalized Campaign Schema

```json
{
  "platform": "google|meta",
  "account_id": "string",
  "campaign_id": "string",
  "campaign_name": "string",
  "status": "enabled|paused|removed|ended|unknown",
  "objective": "search|sales|leads|traffic|awareness|unknown",
  "channel": "search|pmax|display|video|social|unknown",
  "budget_type": "daily|lifetime|unknown",
  "budget_amount": 35.0,
  "currency": "GBP"
}
```

## Normalized Metrics Schema

```json
{
  "spend": 0.0,
  "clicks": 0,
  "impressions": 0,
  "ctr": 0.0,
  "conversions": 0.0,
  "primary_conversions": 0.0,
  "purchases": 0.0,
  "leads": 0.0,
  "cpa": null,
  "cpc": null,
  "roas": null
}
```

## Platform Mapping Rules

### Google Ads Mapping
- conversions = `metrics.conversions`
- primary_conversions = derived if available from selected conversion actions or omitted in MVP
- purchases = map from purchase conversion actions if classified
- status: ENABLED -> enabled, PAUSED -> paused, REMOVED -> removed
- channel from `advertising_channel_type`

### Meta Ads Mapping
- conversions for summary cards should generally map to the primary business outcome for that account, usually purchases or leads
- purchases = action count where action type indicates purchase
- leads = action count where action type indicates lead or submit
- clicks = link clicks if available, otherwise outbound clicks
- status: ACTIVE -> enabled, PAUSED -> paused, ARCHIVED -> removed, deleted or completed -> ended where relevant
- objective from campaign objective
- channel should normalize to `social`

## Alert Normalization Schema

```json
{
  "alert_id": "string",
  "platform": "google|meta|hybrid",
  "severity": "info|warning|critical",
  "entity_type": "account|campaign|conversion_action|search_term",
  "entity_id": "string",
  "entity_name": "string",
  "code": "string",
  "message": "string",
  "cta": "open_campaign|open_meta|open_conversions|none"
}
```

## Normalization Opinion
Do not chase perfect semantic parity in MVP. Normalize enough to make the UI coherent. Google and Meta are fundamentally different. Force common shapes only where the UI truly needs them.

## Suggested File and Module Structure

This should fit OpenClaw plus Atmos conventions without overengineering.

```text
/opt/openclaw/workspace/
  clients/atmos/
    docs/
      telegram-ads-navigator-spec.md

  atmos/
    src/
      lib/
        telegram/
          ads-navigator/
            index.ts
            router.ts
            callbacks.ts
            state-store.ts
            renderers/
              account-summary.ts
              campaign-list.ts
              campaign-detail.ts
              search-terms.ts
              conversion-actions.ts
              alerts.ts
              meta-overview.ts
              shared.ts
            keyboards/
              account-summary.ts
              campaign-list.ts
              campaign-detail.ts
              search-terms.ts
              conversion-actions.ts
              alerts.ts
              meta-overview.ts
              shared.ts
            services/
              google-ads-service.ts
              meta-ads-service.ts
              alerts-service.ts
              normalization-service.ts
              cache-service.ts
            schemas/
              account.ts
              campaign.ts
              metrics.ts
              alert.ts
              view-state.ts
            mappers/
              google-account-mapper.ts
              google-campaign-mapper.ts
              meta-account-mapper.ts
              meta-campaign-mapper.ts
            repositories/
              google-ads-repository.ts
              meta-ads-repository.ts
            constants/
              callback-actions.ts
              date-ranges.ts
              limits.ts
```

## Module Responsibilities

### `router.ts`
Routes button callbacks to screen handlers.

### `callbacks.ts`
Parses and validates callback_data.

### `state-store.ts`
Persists and reads ephemeral view state from Redis or DB.

### `renderers/*`
Takes normalized view models and returns Telegram message text.

### `keyboards/*`
Builds inline keyboard layouts.

### `services/google-ads-service.ts`
Fetches Google Ads raw data needed by the navigator.

### `services/meta-ads-service.ts`
Fetches Meta Ads raw data for summary cards and alerts.

### `services/alerts-service.ts`
Computes alerts from normalized data.

### `services/normalization-service.ts`
Transforms raw source responses into platform-neutral internal models.

### `repositories/*`
Encapsulates low-level API calling and query logic.

## Implementation Boundaries

Keep Telegram-specific presentation separate from ads data access. This allows the same normalized data to later power web dashboards.

## Safety Constraints

## MVP Safety Position
The navigator should be read-only for MVP.

## Read-Only Allowed Actions
- fetch account data
- fetch campaign data
- fetch search terms
- fetch conversion action metadata
- compute alerts
- edit Telegram messages
- refresh cache

## Disallowed in MVP
- pause campaign
- enable campaign
- edit budget
- create negative keywords
- change conversion action primary status
- update bidding strategy
- mutate Meta campaign state

## UI Safety Rules
1. Do not show destructive action buttons in MVP.
2. Do not reuse callback action namespaces later for writes without explicit version bump.
3. Every future write action must require a confirmation screen.
4. Future write confirmation should include account name, object name, object ID, and proposed change.
5. Log all future write intents and approvals.

## Access Safety
- Only approved Telegram user IDs should be allowed to use navigator callbacks.
- Reject callbacks if state token does not belong to the requesting chat and message.
- Expire navigation state aggressively.
- Do not embed sensitive tokens or raw credentials in callback data.

## Error Handling and Empty States

## Error Message Pattern
Use short, human messages.

Examples:
- `Could not load live data. Showing cached snapshot from 18m ago.`
- `No search terms found for this campaign in the selected range.`
- `Meta account mapping is missing for this client.`

## Empty State Buttons
Always provide an exit path:
- `Back`
- `Refresh`

## Message Editing Strategy

## Preferred Behavior
Use `editMessageText` and `editMessageReplyMarkup` to update the existing card.

## When to Send a New Message Instead
- original message no longer editable
- callback came from an outdated state
- user explicitly requests pinning or snapshotting in a future extension

## Suggested Interaction Flow

### Primary Flow
1. User opens account summary
2. taps `Campaigns`
3. taps campaign `1`
4. taps `Search Terms`
5. pages through waste queries
6. taps `Back to Campaign`
7. taps `Back to Campaigns`
8. taps `Back`
9. lands on account summary

### Secondary Flow
1. User opens account summary
2. taps `Meta Overview`
3. reviews winner and wasted spend
4. taps `Google Summary`
5. returns to account summary

### Alerts Flow
1. User opens account summary
2. taps `Alerts`
3. taps `Open Campaign`
4. lands on highest-priority campaign detail

## Practical Data Fetching Plan

## Google Ads Queries Needed for MVP
- account summary metrics
- campaign metrics list
- campaign detail metrics
- search term report by campaign
- conversion action list with primary flag and status

## Meta Ads Queries Needed for MVP
- account-level spend and purchase summary
- campaign summary list for top performer and wasted spend detection
- status breakdown for active, paused, ended

## Alert Computation Rules for MVP

Start with simple deterministic rules. Do not use LLM-generated alerts in MVP.

### Google Alert Rules
- `HIGH_SPEND_LOW_RETURN`
  - spend > account-configured threshold
  - conversions <= low threshold
- `ZERO_CONVERSION_CAMPAIGN`
  - status enabled
  - spend > threshold
  - conversions = 0
- `TOO_MANY_PRIMARY_ACTIONS`
  - primary_count > recommended_primary_max
- `NO_IMPRESSIONS_ACTIVE`
  - enabled campaign
  - impressions = 0 in range

### Meta Alert Rules
- `ENDED_WINNER`
  - campaign ended recently
  - purchases above threshold
- `WASTED_SPEND_NO_PURCHASE`
  - spend > threshold
  - purchases = 0

Thresholds should live in config, not code.

## Configuration Needs

Suggested account mapping config:

```json
{
  "client_key": "screamworks",
  "display_name": "ScreamWorks",
  "google_ads_account_id": "2910561991",
  "meta_ads_account_id": "act_1042551150662411",
  "default_currency": "GBP",
  "default_date_range": "LAST_30_DAYS",
  "alert_thresholds": {
    "high_spend": 100,
    "zero_conversion_spend": 50,
    "meta_wasted_spend": 50,
    "recent_days_for_ended_winner": 14
  }
}
```

## Phased Implementation Plan

## Phase 1: Core MVP

### Scope
- account summary
- campaign list
- campaign detail
- search terms
- conversion actions
- alerts
- Meta overview
- callback router
- state store
- cache layer
- normalized data mappers

### Exit Criteria
- one Telegram flow works end-to-end for ScreamWorks
- all 7 screens render and navigate correctly
- all buttons are stable
- no write actions exposed
- freshness labels visible everywhere

## Phase 2: Production Hardening

### Scope
- better error states
- stale cache fallback logic
- logging and callback analytics
- account config for multiple clients
- alert threshold config per client
- tests for callback parsing and state hydration

### Exit Criteria
- supports at least 3 client accounts
- no broken navigation after 30 minutes of inactivity
- callbacks validated against user and message context

## Phase 3: Cross-Account Selector

### Scope
- choose client account from Telegram inline buttons
- remember recent accounts
- support account switching without leaving chat

### Exit Criteria
- user can switch between ScreamWorks and another account in under 3 taps

## Phase 4: Future Read-Write Actions With Approval

### Scope
- pause campaign request flow
- resume campaign request flow
- change conversion action primary or secondary request flow
- add negative keyword request flow

### Exit Criteria
- every write has confirm and cancel
- every write is logged
- every write requires explicit human approval in chat

## Future Extension: Approval and Action Flows

These are not part of MVP, but the architecture should anticipate them.

## Candidate Future Actions
- Pause campaign
- Resume campaign
- Change conversion action from primary to secondary
- Change conversion action from secondary to primary
- Add negative keyword from waste search term
- Increase or decrease budget

## Future Action UX Pattern

### Step 1: Propose action
Example button from alert or campaign detail:
- `Pause Campaign`

### Step 2: Confirmation card

```text
Confirm Action

Account: ScreamWorks
Platform: Google Ads
Campaign: Escape Rooms MOF
Action: Pause campaign
Why: High spend and poor conversion efficiency

This will change live account state.
```

Buttons:
- `Confirm Pause`
- `Cancel`

### Step 3: Execute and show result

```text
Action Complete

Campaign paused successfully.
Previous status: Enabled
New status: Paused
Executed at: 2026-03-13 00:45 UTC
```

## Future Safety Rules for Writes
- always require a dedicated confirmation screen
- never execute directly from a list row tap
- include exact entity name and ID in confirm view
- log initiator Telegram user ID, timestamp, and payload
- prefer pause over delete everywhere
- for conversion actions, prefer primary to secondary instead of remove

## Recommended MVP Decisions

1. Use message editing, not chat spam.
2. Keep page size at 5.
3. Make account summary the default landing screen.
4. Treat alerts as deterministic computed objects, not generated prose.
5. Normalize only what the UI needs.
6. Keep MVP strictly read-only.
7. Build server-side state storage from day one because callback_data alone will become painful fast.
8. Start with one client account, ScreamWorks, then generalize.

## Out of Scope for MVP

- full campaign comparison charts
- inline sparkline images
- multi-user collaboration
- natural language freeform filtering
- write actions
- Meta campaign detail drill-down
- keyword or ad editing
- scheduled push alerts
- PDF export from Telegram

## Final Build Standard

If this MVP is implemented well, it should feel like a tiny ads command center inside Telegram, not a bot dumping reports. The difference will come from disciplined message design, stable button placement, fast cache-backed navigation, and a hard read-only boundary for the first release.
