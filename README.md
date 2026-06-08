# 🛡️ VulnShield — AI-Powered Vulnerability Detection & Mitigation System

> **Major Project | Department of CSE (Cyber Security) | RNS Institute of Technology**  
> VTU, Belagavi | Batch 7 — Nithyashree R · Dev Kukreja · Kavindra Nishod  
> Guide: Dr. Manohar P

---

## 📌 What Is This?

VulnShield is an **AI-powered dependency vulnerability scanner** that:

1. **Ingests** any public GitHub repository URL
2. **Parses** dependency manifest files (`package.json`, `pom.xml`, `requirements.txt`)
3. **Detects** known CVEs by querying OSV.dev + NIST NVD
4. **Scores** each vulnerability using CVSS v3 (computed from vector strings)
5. **Reports** a prioritised, colour-coded vulnerability report via CLI and REST API
6. *(Phase 2)* **Embeds** vulnerability descriptions into ChromaDB for semantic retrieval
7. *(Phase 2)* **Reasons** with an LLM (Gemini) to produce context-aware remediation advice

**Final vision:** Packaged as a **VS Code extension** that scans your open project in real-time.

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND (Phase 3)                    │
│         Next.js 14 Dashboard  ←→  VS Code Webview           │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST API
┌───────────────────────────▼──────────────────────────────────┐
│                    @vuln-shield/api                          │
│               Express 5 · TypeScript                         │
└───────┬──────────────────────────────────┬───────────────────┘
        │                                  │
┌───────▼──────────────┐      ┌────────────▼───────────────────┐
│  @vuln-shield/core   │      │         PostgreSQL 16           │
│  Scanning Engine     │      │   (Docker · port 5433)          │
│  ─────────────────   │      │   Prisma ORM                    │
│  GitHub API Client   │      └────────────────────────────────┘
│  Manifest Parsers    │
│  OSV.dev Client      │      ┌────────────────────────────────┐
│  NVD API Client      │      │   ChromaDB (Phase 2)           │
│  CVSS v3 Calculator  │      │   Vector Store · Docker         │
└──────────────────────┘      └────────────────────────────────┘
```

### Monorepo Structure

```
major proj/
├── packages/
│   ├── core/                    ← Scanning engine (pure TS, no framework)
│   │   ├── prisma/
│   │   │   └── schema.prisma    ← DB schema (Scan, Dependency, Vulnerability)
│   │   ├── src/
│   │   │   ├── types.ts         ← All shared TypeScript interfaces
│   │   │   ├── scanner.ts       ← Main VulnerabilityScanner class
│   │   │   ├── cli.ts           ← CLI entry point (coloured output)
│   │   │   ├── db.ts            ← Prisma singleton
│   │   │   ├── github/
│   │   │   │   └── client.ts    ← GitHub REST API client (Octokit)
│   │   │   ├── parsers/
│   │   │   │   ├── npm-parser.ts
│   │   │   │   ├── maven-parser.ts
│   │   │   │   └── python-parser.ts
│   │   │   └── vulndb/
│   │   │       ├── osv-client.ts ← OSV.dev batch API + enrichment
│   │   │       └── nvd-client.ts ← NIST NVD API (rate-limited)
│   │   └── tests/
│   │       └── parsers.test.ts   ← Vitest unit tests (9 tests)
│   └── api/
│       └── src/
│           └── server.ts         ← Express REST API
├── docker-compose.yml            ← PostgreSQL 16 on port 5433
├── .env.example                  ← Template for all API keys
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## ⚙️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Language | TypeScript (ESM) | Type safety + VS Code extension native |
| Package Manager | pnpm (workspaces) | Fast, monorepo support |
| Backend | Express 5 | Lightweight REST API |
| ORM | Prisma 6 | Type-safe DB access |
| Database | PostgreSQL 16 | Matches synopsis, robust for prod |
| Primary Vuln DB | OSV.dev API | Free, no key, 30+ sources aggregated |
| Secondary Vuln DB | NIST NVD API | Richer CVSS metadata |
| Manifest Parsing | Custom parsers | npm / Maven / Python |
| CVSS Scoring | Manual v3 formula | Library-independent, accurate |
| Testing | Vitest | Fast, ESM-native |
| Runtime | Node.js 22 | LTS, native fetch |

---

## 🚀 Reproducing the Build (Step-by-Step)

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 | https://nodejs.org |
| pnpm | ≥ 9 | `npm install -g pnpm` |
| Docker Desktop | Any recent | https://docker.com/products/docker-desktop |
| Git | Any | https://git-scm.com |

> ⚠️ **Windows note:** Docker Desktop must be running before you start.

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/Nithya-shree182/major-project.git
cd major-project
git checkout initial-build
```

---

### Step 2 — Set Up Environment Variables

Copy the example env file and fill in your keys:

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
# GitHub Personal Access Token
# → https://github.com/settings/tokens → New token → "repo" scope
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# NIST NVD API Key (optional but recommended for higher rate limits)
# → https://nvd.nist.gov/developers/request-an-api-key
NVD_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Gemini API Key (used in Phase 2 — LLM reasoning)
# → https://aistudio.google.com/apikey
GEMINI_API_KEY=AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Leave this as-is — it matches docker-compose.yml
DATABASE_URL=postgresql://vulnshield:vulnshield123@localhost:5433/vulnshield
```

> ℹ️ `GITHUB_TOKEN` is the most important. Without it, GitHub's unauthenticated rate limit (60 req/hour) will block scans of larger repos.

---

### Step 3 — Start the PostgreSQL Database

```bash
docker compose up -d
```

Expected output:
```
✔ Container vulnshield-db  Started
```

Verify it's running:
```bash
docker ps
# Should show: vulnshield-db   postgres:16-alpine   0.0.0.0:5433->5432/tcp
```

> **Port note:** We use `5433` on the host to avoid conflicts with any locally installed PostgreSQL.

---

### Step 4 — Install Dependencies

```bash
pnpm install
```

When prompted by `pnpm approve-builds`:
- Press `a` to select all packages
- Press `Enter`
- Type `y` to approve

This installs Prisma engines (Rust-compiled binaries) — it's normal for this to take ~30s.

---

### Step 5 — Generate Prisma Client & Push Schema

```bash
# Generate the TypeScript client from schema.prisma
pnpm --filter @vuln-shield/core db:generate

# Push schema to the running PostgreSQL container
pnpm --filter @vuln-shield/core db:push
```

Expected output for `db:push`:
```
Your database is now in sync with your Prisma schema. Done in 381ms
```

This creates three tables in PostgreSQL:
- `Scan` — one record per repository scan
- `Dependency` — one record per parsed package
- `Vulnerability` — one record per CVE/advisory found

---

### Step 6 — Run Unit Tests

```bash
pnpm --filter @vuln-shield/core test
```

Expected output:
```
✓ tests/parsers.test.ts (9 tests) 24ms
Test Files  1 passed (1)
    Tests  9 passed (9)
```

> The `stderr` warning about malformed JSON is **expected** — it's the test verifying graceful error handling.

---

### Step 7 — Run Your First Scan (CLI)

Scan a known-vulnerable Node.js repository:

```bash
pnpm --filter @vuln-shield/core scan scan snyk-labs/nodejs-goof
```

Or with a full GitHub URL:
```bash
pnpm --filter @vuln-shield/core scan scan https://github.com/juice-shop/juice-shop
```

**CLI flags:**

| Flag | Effect |
|---|---|
| `--use-nvd` | Also query NVD for richer CVSS data (slower) |
| `--skip-dev` | Ignore devDependencies |
| `--no-persist` | Don't save results to PostgreSQL |

**Expected output (nodejs-goof):**
```
✔ Scan complete!

═══════════════════════════════════════════════
  🛡️  VulnShield — Scan Report
═══════════════════════════════════════════════

Repository:  snyk-labs/nodejs-goof
Total deps:  35
Total vulns: 58

Severity Breakdown:
  🔴 CRITICAL   11
  🟠 HIGH       18
  🟡 MEDIUM     25
  ⚪ UNKNOWN     4

Vulnerable Dependencies (18/35):

  📦 ejs@1.0.0  (npm, package.json)
     🔴 CRITICAL   GHSA-3w5v-p54c-f74x (9.8)
       ejs is vulnerable to remote code execution due to weak input validation
       Fix: upgrade to 3.1.10
...
```

---

### Step 8 — Start the REST API

```bash
pnpm --filter @vuln-shield/api dev
```

Server starts on `http://localhost:3001`.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/scan` | Start a new scan |
| `GET` | `/api/scan/:id` | Get scan results by ID |
| `GET` | `/api/scans` | List last 50 scans |

**Example — start a scan via API:**
```bash
curl -X POST http://localhost:3001/api/scan \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "snyk-labs/nodejs-goof"}'
```

---

## 🧪 Test Repositories

Use these intentionally vulnerable repos to validate the scanner:

| Repository | Ecosystem | Expected Vulns |
|---|---|---|
| `snyk-labs/nodejs-goof` | npm | ~58 (11 CRITICAL) |
| `juice-shop/juice-shop` | npm | ~30+ |
| `WebGoat/WebGoat` | Maven | Multiple |
| `appsecco/dvna` | npm | ~20+ |

---

## 🗄️ Database Access

View your scan data with Prisma Studio (visual DB browser):

```bash
pnpm --filter @vuln-shield/core db:studio
```

Opens at `http://localhost:5555` — browse Scans, Dependencies, Vulnerabilities.

---

## 🛑 Stopping / Cleanup

```bash
# Stop the PostgreSQL container (data persists)
docker compose down

# Stop and delete all data (fresh start)
docker compose down -v
```

---

## 🗺️ What's Next (Phases 2–4)

See [`WORKFLOW.md`](./WORKFLOW.md) for the full project roadmap.

| Phase | What Gets Built |
|---|---|
| **Phase 2** (next) | ChromaDB vector store · Gemini embeddings · LLM risk prioritisation |
| **Phase 3** | Next.js dashboard · Scan history · Visual risk report |
| **Phase 4** | VS Code extension · CI/CD integration · Final polish |

---

## 🐛 Troubleshooting

### `pnpm install` fails on Prisma

Run `pnpm approve-builds`, select all with `a`, confirm with `y`.

### `db:push` fails with "Authentication failed"

Make sure Docker Desktop is running and the container is up:
```bash
docker compose up -d
docker ps  # Verify vulnshield-db is running
```

### Scan shows all UNKNOWN severity

This means the OSV enrichment fetch is failing (network issue). Try:
```bash
curl https://api.osv.dev/v1/vulns/GHSA-3w5v-p54c-f74x
# Should return JSON with severity field
```

### GitHub rate limit exceeded

Add `GITHUB_TOKEN` to your `.env` file. Without it you get 60 requests/hour.

### Port 5432 conflict

This project deliberately uses port **5433** to avoid conflicts with locally installed PostgreSQL. The `DATABASE_URL` in `.env` already reflects this.

---

## 📄 License

Academic project — RNS Institute of Technology, Bengaluru. Not licensed for commercial use.
