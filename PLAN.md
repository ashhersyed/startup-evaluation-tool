# Startup Job Search Engine — Implementation Plan

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                   │
│  Email Gate → Search/Filter UI → Job Cards → Recommendations │
└────────────────────────────┬─────────────────────────────────┘
                             │ REST API
┌────────────────────────────▼─────────────────────────────────┐
│                    Backend (Express + TypeScript)              │
│  /api/jobs  /api/search  /api/recommend  /api/subscribe       │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│               SQLite Database (better-sqlite3 + FTS5)         │
│  jobs | companies | funding_events | scrape_logs | dedup      │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                    Scraper & Agent Layer                       │
│  30+ sources │ Dedup Agent │ Freshness Agent │ Funding Tracker│
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database & Data Models

### Tables

**`companies`**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Company name |
| website | TEXT | Company URL |
| description | TEXT | Short description |
| funding_stage | TEXT | Pre-Seed/Seed/Series A/B/C/D/E+/Public |
| total_raised | TEXT | Total funding amount |
| last_funding_date | TEXT | Date of most recent round |
| headcount_min | INTEGER | Lower bound of employee range |
| headcount_max | INTEGER | Upper bound of employee range |
| location | TEXT | HQ location |
| investors | TEXT | JSON array of VC/investor names |
| founded_year | INTEGER | Year founded |
| logo_url | TEXT | Company logo |
| source | TEXT | Where we first found them |
| created_at | TEXT | Timestamp |
| updated_at | TEXT | Timestamp |

**`jobs`**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| company_id | INTEGER FK | Reference to companies |
| title | TEXT | Job title |
| normalized_title | TEXT | Cleaned/standardized title |
| description | TEXT | Full job description |
| location | TEXT | Job location |
| remote_type | TEXT | remote/hybrid/onsite |
| salary_min | INTEGER | Salary lower bound |
| salary_max | INTEGER | Salary upper bound |
| salary_currency | TEXT | USD/EUR/etc |
| url | TEXT | Apply/source URL |
| source | TEXT | Which scraper found it |
| source_id | TEXT | ID from original source |
| dedup_hash | TEXT | SHA256(normalize(company+title+location)) |
| posted_at | TEXT | When job was posted |
| scraped_at | TEXT | When we scraped it |
| last_seen_at | TEXT | Last time scraper confirmed active |
| is_active | INTEGER | 1=active, 0=inactive |
| merged_from | TEXT | JSON array of source URLs if merged |
| created_at | TEXT | Timestamp |

**`funding_events`**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| company_id | INTEGER FK | Reference to companies |
| round_type | TEXT | Pre-Seed/Seed/Series A/B/C etc |
| amount | TEXT | Funding amount |
| date | TEXT | Announcement date |
| investors | TEXT | JSON array of investors in this round |
| source_url | TEXT | TechCrunch/Crunchbase link |
| scraped_at | TEXT | Timestamp |

**`scrape_logs`**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| source | TEXT | Scraper name |
| status | TEXT | success/error/partial |
| jobs_found | INTEGER | Total jobs scraped |
| jobs_new | INTEGER | New jobs added |
| jobs_updated | INTEGER | Existing jobs updated |
| jobs_deactivated | INTEGER | Jobs marked inactive |
| error_message | TEXT | Error details if failed |
| duration_ms | INTEGER | How long scrape took |
| timestamp | TEXT | When scrape ran |

**`jobs_fts`** (FTS5 virtual table)
- Indexed columns: title, description, company_name, location
- Enables fuzzy full-text search with ranking

---

## Phase 2: Scraper Agents (30+ Sources)

### Tier 1 — Primary Startup Job Boards (highest volume)

| # | Source | URL | Method | Priority |
|---|--------|-----|--------|----------|
| 1 | Y Combinator / Work at a Startup | workatastartup.com | HTML scrape | HIGH |
| 2 | Wellfound (AngelList) | wellfound.com | HTML scrape | HIGH |
| 3 | Hacker News Who's Hiring | news.ycombinator.com | HN Algolia API | HIGH |
| 4 | RemoteOK | remoteok.com | JSON API | HIGH |
| 5 | BuiltIn | builtin.com/jobs | HTML scrape | HIGH |
| 6 | Startup.jobs | startup.jobs | HTML scrape | MEDIUM |
| 7 | Underdog.io | underdog.io/startup-job-board | HTML scrape | MEDIUM |
| 8 | VentureLoop | ventureloop.com | HTML scrape | MEDIUM |
| 9 | Crunchboard (TechCrunch) | crunchboard.com | HTML scrape | MEDIUM |
| 10 | The Muse | themuse.com | Public API | MEDIUM |

### Tier 2 — VC Portfolio Job Boards (high quality, curated)

| # | VC Firm | Job Board URL | Method |
|---|---------|---------------|--------|
| 11 | Andreessen Horowitz (a16z) | portfoliojobs.a16z.com | HTML scrape |
| 12 | Sequoia Capital | jobs.sequoiacap.com/jobs | HTML scrape |
| 13 | Accel | jobs.accel.com/jobs | HTML scrape |
| 14 | Greylock Partners | jobs.greylock.com | HTML scrape |
| 15 | Kleiner Perkins | jobs.kleinerperkins.com/companies | HTML scrape |
| 16 | Lightspeed Ventures | jobs.lsvp.com | HTML scrape |
| 17 | Index Ventures | indexventures.com/startup-jobs | HTML scrape |
| 18 | General Catalyst | jobs.generalcatalyst.com/jobs | HTML scrape |
| 19 | Bessemer (BVP) | jobs.bvp.com | HTML scrape |
| 20 | NEA | careers.nea.com | HTML scrape |
| 21 | Insight Partners | jobs.insightpartners.com/companies | HTML scrape |
| 22 | Khosla Ventures | jobs.khoslaventures.com/jobs | HTML scrape |
| 23 | Thrive Capital | jobs.thrivecap.com/jobs | HTML scrape |
| 24 | Battery Ventures | job-boards.greenhouse.io/batteryventures | Greenhouse |

### Tier 3 — ATS Aggregation (Lever + Greenhouse boards)

| # | Source | URL Pattern | Method |
|---|--------|-------------|--------|
| 25 | Greenhouse Boards | boards.greenhouse.io/{company} | HTML/API |
| 26 | Lever Boards | jobs.lever.co/{company} | HTML/API |

Strategy: Maintain a list of ~200+ known startup company slugs on Greenhouse/Lever. Expand this list by cross-referencing companies found from VC portfolio pages and funding events.

### Tier 4 — VC Portfolio Aggregators (meta-sources)

| # | Source | URL | Method |
|---|--------|-----|--------|
| 27 | TopStartups.io | topstartups.io/?investors={vc} | HTML scrape |
| 28 | Consider.com | consider.com/boards/vc/{vc}/jobs | HTML scrape |
| 29 | TrueUp | trueup.io/{vc-slug} | HTML scrape |
| 30 | Employbl | employbl.com/company-collections/{vc} | HTML scrape |

### Tier 5 — Funding Data Sources (triangulation)

| # | Source | URL | Method | Data |
|---|--------|-----|--------|------|
| 31 | TechCrunch Funding RSS | techcrunch.com/tag/funding/feed | RSS/XML | Funding announcements |
| 32 | TechCrunch Startups RSS | techcrunch.com/category/startups/feed | RSS/XML | Startup news |
| 33 | GrowthList | growthlist.co/funded-startups | HTML scrape | Recently funded startups |
| 34 | HN Algolia (funding posts) | hn.algolia.com/api | API | "Show HN" + funding posts |

### Funding Triangulation Strategy

When a new funding event is detected:
1. Parse the company name, round type, amount, and investors from the article/feed
2. Search for the company's career page (check `{company}.com/careers`, `{company}.com/jobs`)
3. Check if they have a Greenhouse board (`boards.greenhouse.io/{slug}`) or Lever board (`jobs.lever.co/{slug}`)
4. Add the company + any found jobs to our database
5. Tag the company with the funding data (stage, amount, investors)
6. Re-check weekly — recently funded companies often post a burst of new jobs

### Scraper Architecture

```
server/scrapers/
  base.ts                  — BaseScraper class with shared logic
  registry.ts              — Scraper registry + orchestrator
  utils.ts                 — URL normalization, text cleaning, hash generation

  job-boards/
    yc.ts                  — Y Combinator + Work at a Startup
    wellfound.ts           — Wellfound (AngelList)
    hn-hiring.ts           — Hacker News Who's Hiring (Algolia API)
    remoteok.ts            — RemoteOK (JSON API)
    builtin.ts             — BuiltIn
    startup-jobs.ts        — Startup.jobs
    underdog.ts            — Underdog.io
    ventureloop.ts         — VentureLoop
    crunchboard.ts         — Crunchboard
    themuse.ts             — The Muse (API)

  vc-boards/
    a16z.ts                — Andreessen Horowitz portfolio jobs
    sequoia.ts             — Sequoia Capital
    accel.ts               — Accel
    greylock.ts            — Greylock Partners
    kleiner.ts             — Kleiner Perkins
    lightspeed.ts          — Lightspeed Ventures
    index-ventures.ts      — Index Ventures
    general-catalyst.ts    — General Catalyst
    bessemer.ts            — Bessemer Venture Partners
    nea.ts                 — NEA
    insight.ts             — Insight Partners
    khosla.ts              — Khosla Ventures
    thrive.ts              — Thrive Capital
    battery.ts             — Battery Ventures

  ats/
    greenhouse.ts          — Generic Greenhouse board scraper
    lever.ts               — Generic Lever board scraper

  aggregators/
    topstartups.ts         — TopStartups.io
    consider.ts            — Consider.com
    trueup.ts              — TrueUp
    employbl.ts            — Employbl

  funding/
    techcrunch-rss.ts      — TechCrunch funding RSS feed parser
    growthlist.ts          — GrowthList recently funded
    hn-funding.ts          — HN funding announcements
    career-page-finder.ts  — Given a company name, find their job board
```

### Common Scraper Interface

```typescript
interface ScraperResult {
  jobs: RawJob[];
  companies: RawCompany[];
  fundingEvents?: RawFundingEvent[];
}

interface RawJob {
  title: string;
  company_name: string;
  description?: string;
  location?: string;
  remote_type?: 'remote' | 'hybrid' | 'onsite';
  salary_min?: number;
  salary_max?: number;
  url: string;
  source: string;
  source_id?: string;
  posted_at?: string;
}

interface RawCompany {
  name: string;
  website?: string;
  description?: string;
  funding_stage?: string;
  headcount_min?: number;
  headcount_max?: number;
  location?: string;
  investors?: string[];
}

abstract class BaseScraper {
  abstract name: string;
  abstract scrape(): Promise<ScraperResult>;

  // Shared: rate limiting, retry, logging, normalization
}
```

---

## Phase 3: Agents (Dedup, Freshness, Funding Tracker)

### Deduplication Agent (`server/agents/dedup.ts`)
- Runs after every scrape batch
- Generates dedup hash: `SHA256(lowercase(company_name) + "|" + normalize(title) + "|" + normalize(location))`
- Title normalization: strip "Senior"/"Sr."/"Jr."/"Junior", trim whitespace, lowercase
- When duplicate found across sources:
  - Keep the record with the richest data (longest description, has salary)
  - Merge `source` into array, keep all source URLs in `merged_from`
  - Use earliest `posted_at` date
  - Mark duplicate records as inactive with reference to primary

### Freshness Agent (`server/agents/freshness.ts`)
- Runs every 12 hours
- For each active job, HEAD request the source URL
  - 404/410 → mark `is_active = false`
  - 200 → update `last_seen_at`
  - 3xx → follow redirect, update URL
  - Rate limited: max 100 checks per minute, staggered
- Jobs not seen by any scraper for 3+ consecutive runs → mark inactive
- Jobs older than 60 days with no confirmation → mark inactive

### Funding Tracker Agent (`server/agents/funding-tracker.ts`)
- Runs every 4 hours
- Polls TechCrunch RSS feeds for new funding announcements
- Parses company name, round type, amount, investors
- Cross-references against our `companies` table
  - If company exists: update funding data
  - If company is new: add to companies, trigger career page discovery
- Career page discovery: try common patterns to find Greenhouse/Lever boards
- Queue newly discovered companies for job scraping on next cycle

### Scheduler (`server/agents/scheduler.ts`)
- Uses `node-cron` for scheduling
- Schedule:
  - Full scrape (all sources): every 6 hours
  - Freshness check: every 12 hours
  - Funding tracker: every 4 hours
  - Dedup merge: after each scrape
  - Stale job cleanup: daily at 3 AM
- Logs all runs to `scrape_logs`
- Admin API to trigger any agent manually

---

## Phase 4: Backend API

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/jobs` | GET | List jobs, paginated with filters |
| `GET /api/jobs/search` | GET | Full-text search with FTS5 |
| `GET /api/jobs/:id` | GET | Single job with company details |
| `GET /api/companies` | GET | List companies with filters |
| `GET /api/companies/:id` | GET | Company detail with all jobs |
| `GET /api/recommend` | GET | Top 10 company recommendations |
| `GET /api/filters` | GET | All available filter values |
| `GET /api/stats` | GET | Dashboard statistics |
| `POST /api/subscribe` | POST | Beehiiv email gate (existing) |
| `POST /api/admin/scrape` | POST | Trigger manual scrape |
| `GET /api/admin/logs` | GET | View scrape logs |

### Search & Filter Parameters

```
GET /api/jobs/search?
  q=backend+engineer          # Full-text search (FTS5 fuzzy)
  &funding_stage=seed,seriesA # Comma-separated stages
  &vc=a16z,sequoia            # Filter by investor
  &company_size=11-50,51-200  # Employee ranges
  &posted_within=7d           # 24h, 7d, 30d, 60d
  &location=san+francisco     # City, state, or country
  &remote=true                # Remote only filter
  &source=yc,wellfound        # Filter by source
  &sort=relevance             # relevance, date, company_size
  &page=1&limit=20            # Pagination
```

### Recommendation Engine (`/api/recommend`)

Scores companies on a weighted formula:
- Active job count (more = hiring aggressively) — 25%
- Funding recency (funded in last 6 months) — 25%
- Job freshness (average days since posting) — 20%
- Source diversity (listed on multiple boards) — 15%
- Data completeness (has salary, description, etc.) — 15%

Accepts filters: `vc`, `funding_stage`, `remote`, `company_size`
Returns top 10 with scores and reasoning.

---

## Phase 5: Frontend UI

### Page Structure

**1. Landing / Email Gate (`/`)**
- Hero: "Find your next startup job"
- Value props: 30+ sources, 14 VC portfolios, real-time freshness
- Email input → Beehiiv subscribe → localStorage token → redirect to `/jobs`
- Stats: "X jobs from Y startups updated Z minutes ago"

**2. Job Search Dashboard (`/jobs`)**
- Top: Search bar with auto-suggestions
- Left sidebar: Filter panel
  - Funding Stage: checkboxes (Pre-Seed through Series E+)
  - Investors/VCs: searchable multi-select with top VCs listed
  - Company Size: range buttons (1-10, 11-50, 51-200, 201-500, 500+)
  - Posted Within: dropdown (24h, 7d, 30d, All)
  - Location: text input with autocomplete
  - Remote Only: toggle switch
  - Source: checkboxes (YC, Wellfound, a16z, etc.)
  - Clear All Filters button
- Main area: Job cards in list view
  - Each card: Company logo, job title, company name, location/remote badge, funding stage pill, posted time, source badge(s), salary range (if available)
  - Click → Job detail page
- Top bar: result count, sort dropdown, active filter pills
- Bottom: pagination (prev/next + page numbers)

**3. Job Detail (`/jobs/:id`)**
- Full job description (rendered markdown/HTML)
- Company sidebar: name, logo, website, funding stage, total raised, headcount, investors, founded year
- Apply button (external link to original posting)
- "More jobs at {company}" section
- Source attribution badges
- "Seen on X sources" if merged duplicate

**4. Top 10 Recommendations (`/recommendations`)**
- Filter bar: VC, funding stage, remote, company size
- Ranked cards 1-10:
  - Company name, logo, description
  - Why recommended (funding recency, hiring velocity, etc.)
  - Active job count
  - Expandable: show all open roles
- Updates dynamically as filters change

**5. Stats Footer**
- Total active jobs | Total companies | Sources scraped | Last updated

### Component Structure

```
client/src/
  pages/
    Home.tsx               — Email gate landing (modify existing)
    Jobs.tsx               — Job search dashboard (new)
    JobDetail.tsx          — Single job view (new)
    Recommendations.tsx    — Top 10 companies (new)
  components/
    EmailGate.tsx          — Email gate (modify existing)
    SearchBar.tsx          — Search input with debounce
    FilterPanel.tsx        — Sidebar filters
    JobCard.tsx            — Job list card
    JobList.tsx            — Job card list with loading states
    CompanyCard.tsx        — Company info card
    CompanySidebar.tsx     — Company detail sidebar
    RecommendationCard.tsx — Ranked company card
    Pagination.tsx         — Page navigation
    StatsBar.tsx           — Live stats bar
    FilterPill.tsx         — Active filter badge
    SourceBadge.tsx        — Data source indicator
    FundingStageBadge.tsx  — Funding stage pill
    RemoteBadge.tsx        — Remote/hybrid/onsite badge
  hooks/
    useJobs.ts             — Job search/filter data fetching
    useCompanies.ts        — Company data fetching
    useRecommendations.ts  — Recommendations data fetching
    useFilters.ts          — Filter state management
    useAuth.ts             — Email gate auth check
    useDebounce.ts         — Debounced search input
  types/
    index.ts               — All TypeScript interfaces
  lib/
    api.ts                 — API client with base URL config
    utils.ts               — Shared utilities (existing)
```

---

## Phase 6: Deployment & Config

### Vercel Configuration
- Frontend: static build from Vite
- API routes: serverless functions in `/api/`
- SQLite: use Turso (hosted libSQL) for persistent read/write from serverless
- Cron: Vercel Cron Jobs for scheduling scrapers (vercel.json `crons` config)

### Environment Variables
```
# Existing
BEEHIIV_API_KEY=
BEEHIIV_PUB_ID=

# New
DATABASE_URL=libsql://your-db.turso.io
DATABASE_AUTH_TOKEN=
ADMIN_API_KEY=          # Protect admin endpoints
SCRAPE_INTERVAL=6h      # Configurable
```

### Vercel Cron Jobs (vercel.json)
```json
{
  "crons": [
    { "path": "/api/cron/scrape", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/freshness", "schedule": "0 */12 * * *" },
    { "path": "/api/cron/funding", "schedule": "0 */4 * * *" },
    { "path": "/api/cron/cleanup", "schedule": "0 3 * * *" }
  ]
}
```

---

## Phase 7: Testing & Polish

- [ ] All scrapers return valid data against live sources
- [ ] FTS5 search returns relevant results for partial/fuzzy queries
- [ ] Dedup correctly merges same job from different sources
- [ ] Freshness agent marks dead jobs as inactive
- [ ] Funding tracker discovers new companies and their job boards
- [ ] Email gate blocks access until subscribed
- [ ] All filter combinations work correctly
- [ ] Recommendation engine returns sensible top 10
- [ ] Responsive design on mobile/tablet
- [ ] Loading skeletons and error states
- [ ] Pagination works at scale (1000+ jobs)
- [ ] Rate limiting on scraper requests

---

## Implementation Order

1. **Database** — Schema, connection, migrations, FTS5 setup
2. **Types** — Shared TypeScript interfaces
3. **Scraper base** — BaseScraper class, utilities, registry
4. **Tier 1 scrapers** — YC, Wellfound, HN, RemoteOK, BuiltIn (highest volume)
5. **Tier 2 scrapers** — All 14 VC portfolio boards
6. **Tier 3 scrapers** — Greenhouse/Lever generic + company slug list
7. **Tier 4 scrapers** — Aggregator sites (TopStartups, Consider, TrueUp, Employbl)
8. **Tier 5 scrapers** — Funding RSS feeds + GrowthList + career page finder
9. **Agents** — Dedup, freshness, funding tracker, scheduler
10. **API routes** — Jobs, search, companies, recommend, filters, admin
11. **Frontend** — Email gate → search UI → filters → job cards → detail → recommendations
12. **Deployment** — Vercel + Turso, cron jobs, env vars
13. **Testing & polish** — End-to-end verification

---

## Success Criteria Mapping

| # | Criterion | How We Address It |
|---|-----------|-------------------|
| 1 | Scrape from VCs, YC, Wellfound, etc. | 30+ scrapers across 5 tiers |
| 2 | Filter by funding stage, VC, size, date, location, remote | Full filter panel with all params |
| 3 | Searchable with fuzzy matching | SQLite FTS5 full-text search |
| 4 | Frequently updated, only active jobs shown | Cron scrapers + freshness agent |
| 5 | Detect and merge duplicates | Dedup agent with hash-based matching |
| 6 | Email gate with Beehiiv | Existing integration + localStorage auth |
| 7 | Top 10 recommendations with major filters | Recommendation engine with scoring |
| 8 | End-to-end frontend + backend | React + Express + SQLite + Vercel |
| 9 | Agents to maintain/update database | Scheduler + dedup + freshness + funding tracker |
