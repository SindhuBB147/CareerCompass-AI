# CareerCompass AI — Comprehensive System Audit & Verification Report

**Date of Audit:** October 18, 2026  
**Audited Directory:** `career-compass-ai (2)\career-compass-ai (1)\career-compass-ai` (Verified Original Project Directory)  
**System Architecture:** Monorepo (`apps/api`, `apps/web`, `apps/ai-service`, `packages/*`, `infra/*`)

---

## 1. Verified Technology Stack & Entry Points

| Layer | Framework / Technology | Version / Specification | Entry Point |
|---|---|---|---|
| **Root Workspace** | npm workspaces | npm 10.9.2, Node.js v22.17.1 | `package.json` |
| **Backend API** | NestJS / Express | TypeScript 5.4.0, NestJS 10.3.0 | `apps/api/src/main.ts` |
| **Frontend Web** | Next.js (App Router) | React 18.2.0, Next.js 14.2.35 | `apps/web/src/app/page.tsx` |
| **AI Microservice** | FastAPI / Python | Python 3.13.9, Pydantic 2.9.2, PyTest 8.3.3 | `apps/ai-service/main.py` |
| **Primary Database** | MongoDB (Mongoose ODM) | Mongo 7.0 / Mongoose 8.2.0 | `apps/api/src/database/` |
| **Vector Store** | PostgreSQL + pgvector | pgvector/pgvector:pg17, asyncpg 0.30.0 | `apps/ai-service/db/postgres.py` |
| **Cache & Queue** | Redis | Redis 7.0 Alpine | Docker Compose / session storage |
| **Shared Libraries** | TypeScript libraries | `@career-compass/config`, `types`, `utils` | `packages/*/` |

---

## 2. Executive Audit Summary

### A. Initial Baseline Failures Identified
1. **Engine Compatibility Warnings (`EBADENGINE`):**
   - Node.js version on host is `v22.17.1`.
   - Packages `jsdom@30.0.1` and `undici@8.10.0` emit `npm warn EBADENGINE` requiring `>=22.19.0`.
   - **Assessment:** Warnings are non-blocking advisory messages under npm 10. All packages and test runners execute properly on v22.17.1 without system perturbation.
2. **MongoMemoryServer Binary Download / Checksum Mismatch (14 Failed Suites, 90 Failed Tests):**
   - In-memory MongoDB testing downloaded an archive `mongodb-windows-x86_64-8.2.6.zip` into `C:\Users\sindh\.cache\mongodb-binaries\`.
   - The file size was 823,107,729 bytes (actual remote length: 819,033,833 bytes) with an MD5 mismatch (`0330A699...` vs expected checkfile `b794B99D...`), caused by an interrupted HTTP resume download.
   - Result: All tests depending on `MongoMemoryServer` failed during `beforeAll` initialization.
3. **Unsafe Resource Teardown Masking Errors:**
   - In 13 test suites, `afterAll` called `await mongod.stop()` without guarding against uninitialized instances. When `beforeAll` failed, Jest crashed with `TypeError: Cannot read properties of undefined (reading 'stop')`, obscuring the real failure reason.
4. **Puppeteer / Chromium Local Fallback Absence on Windows:**
   - `PdfRendererService` only listed Unix and macOS paths in `LOCAL_FALLBACK_PATHS` (`/usr/bin/chromium`, `/Applications/Google Chrome.app/...`).
   - On Windows, despite Google Chrome being present at `C:\Program Files\Google\Chrome\Application\chrome.exe`, PDF tests threw `DomainException: PDF_ENGINE_UNAVAILABLE`.
   - `student-reports.integration.spec.ts` crashed with `TypeError: Cannot read properties of undefined (reading 'closeBrowser')`.
5. **Constructor Argument Mismatch in `wishlist-analytics.service.spec.ts`:**
   - `WishlistAnalyticsService` constructor required 6 parameters (`savedCollegeModel`, `listItemRepo`, `snapshotRepo`, `savedCollegeRepo`, `collegeRepo`, `userRepo`), but the test spec only passed 4 arguments.
6. **Host Python Shadowing Conflict in AI Service:**
   - A script named `py.py` located in the global Python 3.12 directory (`C:\Users\sindh\AppData\Local\Programs\Python\Python312\py.py`) shadowed the internal `py` library required by `pytest`, causing an interactive prompt `enter the value of N:`.

---

## 3. Security & Dependency Review

- **Production Audit Analysis:**
  - Evaluated `npm audit --omit=dev`.
  - Identified that automated `npm audit fix --force` would apply breaking changes:
    - Upgrading `next` to v16.4.2 (breaking change from Next 14).
    - Upgrading `bcrypt` to v6.0.0.
    - Upgrading `nodemailer` to v10.1.2.
    - Downgrading `exceljs` from v4.4.0 to v3.4.0.
  - In accordance with safety policies, destructive force upgrades were not performed. Minimal compatible security hardening was applied.
- **Environment & Secrets:**
  - Verified that local `.env` files are properly excluded by `.gitignore`.
  - No secret keys or credentials are committed to version control.
  - JWT tokens are validated using separate access and refresh secrets.
  - Helmet middleware and ThrottlerGuard (120 req/min/IP) are enforced globally in the NestJS API.
