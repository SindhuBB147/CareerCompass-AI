# CareerCompass AI

AI-driven college admissions and career guidance platform for Karnataka entrance exams (KCET, COMEDK, JEE, NEET).

## Quick Start

```bash
# Start MongoDB + Redis
docker-compose up -d mongodb redis

# Install API dependencies
cd apps/api && npm install

# Configure environment
cp .env.example .env  # then fill in JWT secrets

# Seed development data
npx ts-node src/database/seed.ts

# Start the API server
npm run start:dev
```

The API runs at `http://localhost:3000/api/v1`

## Project Structure

```
career-compass-ai/
├── apps/api/src/
│   ├── modules/
│   │   ├── auth/          # JWT, RBAC, refresh rotation, forgot/reset password
│   │   ├── users/         # Student profile, exam profiles, email verification
│   │   ├── colleges/      # College CRUD, branches, placements, fees, audit log
│   │   ├── cutoffs/       # Exams, cutoff history, bulk upload, conflict resolution
│   │   ├── scholarships/  # Scholarship matching, admin CRUD
│   │   ├── predictions/   # Admission probability, choice-filling optimizer, ROI
│   │   ├── roadmap/       # Career roadmap generator
│   │   ├── counsellor/    # AI Counsellor (LLM + RAG sessions)
│   │   ├── analytics/     # Admin analytics dashboard
│   │   ├── notifications/ # Deadline alerts, scholarship alerts, B2B nudges
│   │   ├── admin/         # User management, audit logs, B2B roster
│   │   └── reporting/     # Platform & cohort reports
│   ├── common/            # Shared decorators, guards, filters, utils
│   ├── database/          # Connection module + seed script
│   ├── app.module.ts      # Root module wiring all features
│   └── main.ts            # Bootstrap
├── infra/
│   ├── terraform/         # AWS EKS, S3, VPC
│   └── k8s/               # Helm charts
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## API Endpoints Summary

| Area | Endpoints | Auth |
|---|---|---|
| Auth | POST /auth/login, /refresh, /logout, /password/forgot, /password/reset | Public (except logout) |
| Users | GET/PATCH /users/me, exam-profiles CRUD, notification-preferences, email verification | Student JWT |
| Colleges | GET /colleges (search), /:id (detail), /compare | Public |
| Admin Colleges | POST/PATCH /admin/colleges, courses CRUD, placement CRUD, fee update | data_manager+ |
| Cutoffs | GET /colleges/:id/cutoffs (trend) | Public |
| Admin Cutoffs | POST /admin/cutoffs/bulk-upload, GET/PATCH conflicts | data_manager+ |
| Scholarships | GET /scholarships/matched, /:id | Student JWT / Public |
| Predictions | GET /predictions, /shortlist, /roi, /placement, POST /choice-filling/optimize | Student JWT |
| Career Roadmap | GET /career-roadmap | Student JWT |
| AI Counsellor | POST /ai-counsellor/sessions, /messages, GET /sessions/:id | Student JWT |
| Notifications | GET /notifications, PATCH /:id/read | Student JWT |
| B2B | GET /b2b/students, POST /b2b/students/:id/nudge | b2b_account_manager |
| Analytics | GET /admin/analytics/dashboard | super_admin/data_manager |
| Admin | GET /admin/users, PATCH status, GET /admin/audit-logs | support_agent+ / super_admin |
| Reports | GET /admin/reports/platform, /cohort | super_admin/data_manager |
| Health | GET /health | Public |

## Scope

Karnataka entrance exams only: KCET, COMEDK, JEE (Main), NEET. All colleges in the database are Karnataka institutions.
