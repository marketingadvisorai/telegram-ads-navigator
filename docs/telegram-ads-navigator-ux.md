# Telegram Ads Navigator UX/UI Spec

## UX Goals

1. Make ad account navigation feel fast inside a chat interface, not like a cramped dashboard.
2. Keep each screen focused on one decision only.
3. Reduce scroll fatigue by showing summary first, details on demand.
4. Make inline buttons predictable across all screens.
5. Ensure a user can always answer three questions within one screen:
   - Where am I?
   - What can I do next?
   - How do I go back?
6. Keep message edits as the default behavior for navigation so the chat does not become noisy.
7. Use new messages only for high-importance outputs such as exports, alerts, or long-form drilldowns that should persist in the thread.
8. Make pagination obvious, lightweight, and thumb-friendly.
9. Preserve context across back actions so users return to the same page, filter state, and selected account.
10. Design for one-handed mobile use first.

## Global Message Design Rules

### Message structure
Every navigable screen should use the same message structure:

1. Title line
2. Context line
3. Primary summary block
4. Optional hint line
5. Inline button rows

### Copy style
- Short, operational, and scannable
- No paragraphs longer than 3 lines in Telegram
- Important metrics grouped on one line where possible
- Use plain labels such as Spend, Clicks, Conv, CPA, ROAS
- Keep dates explicit, such as Last 7 days or Mar 1 to Mar 7

### Visual hierarchy inside plain text
- First line identifies the screen
- Second line anchors current account and date range
- The body prioritizes top decision signals
- The bottom line can contain a tiny instruction when needed, such as: Tap a card action for deeper detail

### Stateful behavior
Navigation should edit the current bot message whenever the user is moving within the same flow:
- Account list to account detail
- Campaign list to campaign detail
- Page 1 to page 2
- Summary to filter state

Create a new message only when:
- Sending a shareable report
- Returning a large exported view
- Delivering an alert that should remain visible
- Opening a long insight view that would exceed comfortable message length

## Navigation Model

The navigator should use a strict hierarchical pattern:

1. Home
2. Account list
3. Account overview
4. Campaign list
5. Campaign detail
6. Ad group list
7. Ad group detail
8. Ad or keyword detail if needed

The user should never jump into a deep node without the parent context shown in the message.

### Breadcrumb pattern
Telegram does not support a visual breadcrumb bar, so each message should include a compact text breadcrumb on line 2 or 3.

Format:
- Home / Accounts
- Accounts / ScreamWorks
- ScreamWorks / Campaigns
- ScreamWorks / Corporate Team Building

This breadcrumb is informational. Navigation itself is controlled by inline buttons.

## Screen by Screen Message Design

## 1. Home Screen

### Purpose
Entry point that lets the user choose the account browser, recent items, alerts, or saved views.

### Message design
**Title:** Ads Navigator

**Context line:** Choose where to start

**Body:**
- Connected accounts: X
- Recent alerts: X
- Saved views: X
- Last sync: time

**Hint line:** Open an account to view campaigns, ads, keywords, and performance summaries.

### Inline button layout
Row 1:
- Accounts
- Alerts

Row 2:
- Recent
- Saved Views

Row 3:
- Refresh

### UX notes
- Home should be simple and stable.
- Do not overload Home with metrics.
- If there are urgent alerts, show a count only, not the full alert list.

## 2. Account List Screen

### Purpose
Show available ad accounts in a paginated list.

### Message design
**Title:** Select an Account

**Context line:** Home / Accounts

**Body:**
- Showing 1 to 6 of 24 accounts
- Sort: Recent activity
- Date range: Last 7 days

Then show a numbered compact list:
1. ScreamWorks
2. Eye Care Hawaii
3. South Beach Room Escape
4. Game Over Toronto
5. Game Over Burlington
6. Optimal Escape

**Hint line:** Tap an account name to open its summary.

### Inline button layout
Use one account per button row for tap accuracy.

Rows 1 to 6:
- ScreamWorks
- Eye Care Hawaii
- South Beach Room Escape
- Game Over Toronto
- Game Over Burlington
- Optimal Escape

Row 7:
- ◀ Prev
- Page 1/4
- Next ▶

Row 8:
- Back
- Refresh

### UX notes
- The current page indicator should be non-interactive if supported by callback handling rules. If not, it can open a tiny status toast-equivalent by editing nothing.
- Keep accounts to 5 to 7 per page. Six is the sweet spot for mobile scanning.
- Preserve sort and date range when paginating.

## 3. Account Overview Screen

### Purpose
Give the user the most useful cross-account summary before they dive into campaigns.

### Message design
**Title:** ScreamWorks

**Context line:** Accounts / ScreamWorks

**Body:**
- Date range: Last 7 days
- Spend: £482
- Clicks: 1,126
- Conversions: 19
- CPA: £25.37
- Top campaign: Corporate Team Building
- Biggest issue: 1 campaign with high spend and low conversion rate

**Secondary summary block:**
- Active campaigns: 6
- Paused campaigns: 22
- Alerts: 2
- Last sync: 12 min ago

**Hint line:** Open campaigns to investigate winners, losers, and budget waste.

### Inline button layout
Row 1:
- Campaigns
- Alerts

Row 2:
- Top Movers
- Date Range

Row 3:
- Refresh
- Back

### UX notes
- This screen should answer whether the account is healthy in under 5 seconds.
- Avoid showing too many secondary metrics. Telegram is not a BI dashboard.
- If an account has a critical alert, place a warning icon in the body text line, not in the button label.

## 4. Campaign List Screen

### Purpose
Show campaigns as compact cards with enough information to decide what to open.

### Message design
**Title:** Campaigns

**Context line:** ScreamWorks / Campaigns

**Body:**
- Showing 1 to 5 of 6 campaigns
- Sort: Spend high to low
- Date range: Last 7 days

Then show one compact block per campaign:

**1. Corporate Team Building**
Spend £148 | Conv 8 | CPA £18.50
Status: Active | Type: Search

**2. Events Campaign**
Spend £96 | Conv 3 | CPA £32.00
Status: Active | Type: Search

And so on.

**Hint line:** Tap a campaign button for its detailed card.

### Inline button layout
Rows 1 to 5:
- 1. Corporate Team Building
- 2. Events Campaign
- 3. Escape Rooms MOF
- 4. Brand Search
- 5. Remarketing

Row 6:
- Filters
- Sort

Row 7:
- ◀ Prev
- Page 1/2
- Next ▶

Row 8:
- Back to Account
- Refresh

### UX notes
- Campaigns should be sorted by the currently active sort, with the sort visible in the message body.
- Filters should not open a huge menu. Instead, use a compact filter picker screen.
- If a campaign has a critical issue, prefix the campaign name in text with a warning marker.

## 5. Campaign Detail Screen

### Purpose
Present one campaign as a high-signal card with drilldown actions.

### Message design
Use a clear single-card format.

**Title:** Campaign Detail

**Context line:** ScreamWorks / Corporate Team Building

**Body:**
- Status: Active
- Type: Search
- Date range: Last 7 days
- Spend: £148
- Impr: 12,430
- Clicks: 421
- CTR: 3.39%
- Conv: 8
- CPA: £18.50
- Avg CPC: £0.35
- Trend: Conversions up 22% vs previous period

**Insight block:**
- Best signal: Strong conversion efficiency on mobile
- Risk: Tuesday spend spikes with lower intent traffic
- Suggested next step: Review search terms and ad groups

### Inline button layout
Row 1:
- Ad Groups
- Search Terms

Row 2:
- Ads
- Keywords

Row 3:
- Prev Campaign
- Next Campaign

Row 4:
- Back to Campaigns
- Refresh

### UX notes
- Prev Campaign and Next Campaign should respect the current filtered and sorted list, not global campaign order.
- This lets users review campaigns like a deck.
- Card body should stay under roughly 14 lines to avoid excessive scrolling before buttons appear.

## 6. Ad Group List Screen

### Purpose
Display child entities for a selected campaign.

### Message design
**Title:** Ad Groups

**Context line:** Corporate Team Building / Ad Groups

**Body:**
- Showing 1 to 4 of 4 ad groups
- Date range: Last 7 days

**1. Team Events London**
Spend £52 | Conv 3 | CPA £17.33

**2. Corporate Escape Rooms**
Spend £41 | Conv 2 | CPA £20.50

**3. Group Activities**
Spend £33 | Conv 2 | CPA £16.50

**4. Work Social Ideas**
Spend £22 | Conv 1 | CPA £22.00

### Inline button layout
Rows 1 to 4:
- 1. Team Events London
- 2. Corporate Escape Rooms
- 3. Group Activities
- 4. Work Social Ideas

Row 5:
- Back to Campaign
- Refresh

### UX notes
- No need for pagination if item count is small.
- If the count grows, switch to the standard paginated list pattern automatically.

## 7. Ad Group Detail Screen

### Purpose
Help the user inspect a specific segment before going to ads or keywords.

### Message design
**Title:** Ad Group Detail

**Context line:** Corporate Team Building / Team Events London

**Body:**
- Spend: £52
- Clicks: 141
- Conversions: 3
- CPA: £17.33
- Top keyword theme: team building london
- Best ad strength: Good
- Main issue: 12 search queries with poor intent

### Inline button layout
Row 1:
- Ads
- Keywords

Row 2:
- Search Terms
- Insights

Row 3:
- Prev Ad Group
- Next Ad Group

Row 4:
- Back to Ad Groups
- Refresh

### UX notes
- Keep action labels consistent with Campaign Detail.
- Do not invent new verbs for the same type of drilldown.

## 8. Filter Picker Screen

### Purpose
Let the user change view state without cluttering the main list screens.

### Message design
**Title:** Filters

**Context line:** ScreamWorks / Campaigns

**Body:**
- Status: All
- Type: All
- Sort: Spend high to low
- Date range: Last 7 days

**Hint line:** Choose one filter to update the campaign list.

### Inline button layout
Row 1:
- Status
- Type

Row 2:
- Sort
- Date Range

Row 3:
- Clear Filters

Row 4:
- Apply
- Back

### UX notes
- If Telegram interaction limits require immediate application, each filter tap can update state instantly and redraw this screen.
- In that case, Apply can be removed.
- The preferred behavior is immediate apply with visible current state in the body.

## Fully Rendered ScreamWorks Example Card

Use this exact structure as the reference design for a high-quality campaign detail card:

**Campaign Detail**
ScreamWorks / Corporate Team Building

Status: Active
Type: Search
Date range: Last 7 days

Spend: £148
Impr: 12,430
Clicks: 421
CTR: 3.39%
Conv: 8
CPA: £18.50
Avg CPC: £0.35

Best signal: Mobile traffic is converting efficiently
Risk: Tuesday clicks rise without matching conversion growth
Next step: Review search terms and trim weak intent queries
Last sync: 12 min ago

Inline buttons under this message:

Row 1:
- Ad Groups
- Search Terms

Row 2:
- Ads
- Keywords

Row 3:
- Prev Campaign
- Next Campaign

Row 4:
- Back to Campaigns
- Refresh

## Pagination UX

## Pagination principles
1. Pagination must feel like browsing cards, not navigating tables.
2. Users should always know current page and total pages.
3. Prev and Next buttons should remain in the same row and same order everywhere.
4. Page state must persist when moving back from a detail screen.
5. Changing filters resets pagination to page 1.

## Standard pagination row
Use this exact row on all paginated screens:
- ◀ Prev
- Page X/Y
- Next ▶

## Disabled states
When on the first page:
- Prev should appear disabled or non-actionable

When on the last page:
- Next should appear disabled or non-actionable

If Telegram callback handling does not support a visual disabled style, use a no-op button label such as:
- ·
- Page 1/4
- Next ▶

But keep the row shape stable.

## Page size recommendations
- Accounts: 6 per page
- Campaigns: 5 per page
- Ad groups: 5 per page
- Ads: 4 per page if card summaries are denser
- Keywords: 6 per page if using short metric rows

## Detail screen pagination
Detail screens should support sibling browsing using Prev and Next entity buttons.

Example:
- Prev Campaign
- Next Campaign

This allows fast scanning of adjacent entities without bouncing back to the list every time.

## Navigation and Back Patterns

## Core back rule
Every non-home screen must have a Back action in the bottom row.

## Back label rules
Use explicit back labels, not generic ambiguity.

Preferred:
- Back to Account
- Back to Campaigns
- Back to Ad Groups

Avoid:
- Back

Generic Back is allowed only on compact utility screens like Filters where the parent is obvious from context.

## Back behavior
Back should restore:
- Parent screen
- Previous pagination page
- Current sort
- Current filters
- Current date range
- Current account or campaign selection context

Example:
If the user opens Campaign 4 from Campaigns page 2 filtered to Active only, Back to Campaigns returns them to page 2 with Active only still applied.

## Home escape hatch
Major screens should offer one simple way to reset context within two taps maximum.

Pattern:
- Detail screen: Back to Campaigns
- Campaign list screen: Back to Account
- Account overview: Back to Accounts
- Account list: Back to Home

## Refresh pattern
Refresh should be present on all primary data screens, always in the bottom row.

Rules:
- Refresh re-fetches data for the current view only
- Refresh should preserve the current screen context
- Refresh should not throw the user back to the top of the hierarchy

## Consistency Rules for Inline Buttons

1. Primary drilldown actions belong in the top rows.
2. Sibling navigation such as Prev and Next belongs above the bottom row.
3. Back and Refresh belong in the bottom row.
4. Keep button count to 2 buttons per row where possible.
5. Only use 3-button rows for pagination.
6. Do not mix destructive or editing actions into read-only navigation views.
7. Reuse the same labels everywhere:
   - Campaigns
   - Ad Groups
   - Ads
   - Keywords
   - Search Terms
   - Alerts
   - Refresh
   - Back to X

## UX Acceptance Criteria

The UX/UI section is complete only if the implementation follows these rules:

1. A user can move from Home to Campaign Detail in no more than 4 taps.
2. A user can always return one level up with a clearly labeled button.
3. Message edits are the default for navigation, reducing chat clutter.
4. No list screen exceeds comfortable mobile scan length before buttons appear.
5. Pagination state persists when returning from child detail views.
6. Inline button placement is consistent across all screens.
7. The ScreamWorks campaign detail card matches the rendered reference structure above.
8. Every screen includes enough textual context that a screenshot alone still makes sense.
