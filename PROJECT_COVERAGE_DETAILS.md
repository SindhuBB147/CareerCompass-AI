# CareerCompass AI - Project Coverage & Technical Specification Report

Welcome to the comprehensive coverage and technical architecture specification report for **CareerCompass AI**. 

CareerCompass AI is an enterprise-grade, AI-driven college admissions and career guidance platform tailored specifically for Karnataka entrance examinations (**KCET**, **COMEDK**, **JEE Main**, and **NEET**). The platform leverages high-fidelity data analytics, multi-year KEA cutoff archives, financial ROI forecasting, and Retrieval-Augmented Generation (RAG) to eliminate guesswork and guide students through their options with data-driven confidence.

---

## 1. Project Architecture & Monorepo Structure

The project is structured as a **monorepo** dividing the workspace into microservices (`apps/`), shared libraries (`packages/`), and deployment configuration (`infra/`).

```
career-compass-ai/
├── apps/
│   ├── api/             # NestJS Back-end Core Server (TypeScript)
│   ├── web/             # Next.js Frontend Application (React, TypeScript)
│   └── ai-service/      # FastAPI Python Microservice (Python, PyVector RAG, ML Predictions)
├── packages/
│   ├── config/          # Shared configuration and lint rules
│   ├── types/           # Shared TypeScript type definitions
│   └── utils/           # Shared utility and mathematical functions (EMI, Currencies)
├── infra/
│   ├── terraform/       # AWS VPC, EKS Cluster, Node Groups, S3 Buckets
│   └── k8s/             # Helm Charts for EKS Kubernetes deployments
└── docker-compose.yml   # Multi-container local orchestration script
```

---

## 2. Shared Libraries (`packages/`)

To guarantee dry code and cross-boundary type safety, shared dependencies are extracted into packages:

### A. `@career-compass/types` ([`packages/types/index.ts`](file:///c:/Users/sindh/Desktop/career-compass-ai%20%281%29/career-compass-ai/packages/types/index.ts))
Defines contract interfaces shared between the NestJS backend and Next.js frontend, including:
* **`College`**: Core college schema metadata, NIRF rank, NAAC grade, courses, placements.
* **`Scholarship`**: Provider types, award formats (fixed/percent), and category/rank eligibility criteria.
* **`ChatMessage` & `AiConversation`**: RAG sessions, sources cited, and conversation states.
* **`NotificationItem` & `NotificationPreference`**: Categorized user notifications (push, SMS, email, WhatsApp).
* **`Reminder`**: Fired and pending reminders.

### B. `@career-compass/utils` ([`packages/utils/index.ts`](file:///c:/Users/sindh/Desktop/career-compass-ai%20%281%29/career-compass-ai/packages/utils/index.ts))
Houses computational logic shared across services:
* **`formatCurrency`**: Formats numerical inputs into the Indian Rupee system (e.g., formatting ₹10,500,000 as `₹1.05 Cr` and ₹250,000 as `₹2.50 Lakh`).
* **`calculateEmi`**: A standard monthly reducing-balance EMI loan calculator computing monthly EMI payments, total interest, and total lifetime repayment.
* **`rankBucket`**: Segmenting entrance exam ranks into logical buckets (e.g., `1 - 1,000`, `1,001 - 5,000`, up to `50,000+`).

---

## 3. Backend Core Server (`apps/api`)

Built on **NestJS**, the backend exposes REST API endpoints with robust guards, decorators, filters, and middleware.

### Global Configuration & Module Setup ([`apps/api/src/app.module.ts`](file:///c:/Users/sindh/Desktop/career-compass-ai%20%281%29/career-compass-ai/apps/api/src/app.module.ts))
Uses a global pipeline of interceptors, middleware, and guards:
1. **`GlobalJwtAuthGuard`**: Decodes JWT and populates `request.user`.
2. **`RolesGuard`**: Enforces Role-Based Access Control (RBAC).
3. **`PermissionsGuard`**: Restricts sensitive admin operations through database permission checks.
4. **`ReauthGuard`**: Mandates verification of the user's password for destructive actions.
5. **`ThrottlerGuard`**: Enforces API rate limits (default: 120 requests/minute per IP).

### Database Integration ([`apps/api/src/database/database.module.ts`](file:///c:/Users/sindh/Desktop/career-compass-ai%20%281%29/career-compass-ai/apps/api/src/database/database.module.ts))
Exhibits clean fallback mechanisms for development:
* Automatically detects if a local MongoDB service is running on port 27017.
* If local Mongo is down, it spawns an **in-memory database instance** using `mongodb-memory-server` to allow quick bootstrap during local setup.

---

## 4. API Feature Modules (`apps/api/src/modules/`)

### 🔑 Authentication & Authorizations (`auth`)
* **Role-Based Access Control (RBAC)**: Supports roles: `student`, `support_agent`, `data_manager`, `b2b_account_manager`, and `super_admin`.
* **Token Rotation**: Enforces short-lived JWT Access Tokens and secure HttpOnly Refresh Tokens to prevent replay attacks.
* **Flows**: Standard register, login, logout, and password recovery triggers.

### 👤 Profile & Target Tracking (`users`)
* **Exam Profiles**: Tracks student metrics (rolls, ranks, categories) for target exams: KCET, COMEDK, NEET, JEE.
* **Categories Mapping**: Resolves complex reservations (e.g., GM, GMR, GMK, HK, SCG, STK, SNQ, EWS).
* **Onboarding & Verification**: Handlers for initial onboarding states and email verifications.

### 🏫 College Directory Administration (`colleges`)
* **Colleges CRUD**: Direct endpoints to register, update, soft-delete, and restore institutions.
* **Branch Intake & Seat Matrix**: Detail configurations of courses, duration, degree types, intake seat allocation, and annual fees.
* **Auditing**: Audit trail logs capture which admin user altered fees or verified details.
* **Reviews**: Public student reviews and rating aggregations.
* **Image Management**: Media galleries with crop definitions, verification checks, rejection pipelines, and primary image setups.

### 📊 Historical KEA Cutoff Archive (`cutoffs`)
* **Cutoff Trends**: Direct query lookup for historical trends across rounds, categories, and years.
* **File Parser**: High-performance parser utilizing `exceljs` to parse `.xlsx` and `.csv` sheets containing millions of rows.
* **Conflict Resolution**: Identifies row conflicts during bulk uploads (e.g., same college/course/year/round/category but mismatching ranks). Creates a `CutoffConflict` ticket for admins to merge, overwrite, or dismiss.

### 🎓 Scholarship Matching System (`scholarships`)
* **Scholarship Matching**: Dynamic student profile matching based on state residency, household income, entrance rank, categories, and gender-specific eligibility.
* **Taxonomy Management**: Dynamic categorization systems for scholarships (Government, Private, Institutional) and providers.

### 📈 Predictor Engine & ROI Analysis (`predictions`)
* **Cutoff Probability modeling** ([`prediction.service.ts`](file:///c:/Users/sindh/Desktop/career-compass-ai%20%281%29/career-compass-ai/apps/api/src/modules/predictions/services/prediction.service.ts)):
  * Computes closing rank trends using a weighted mathematical average (giving a 2x weight modifier to recent cutoff years).
  * Classifies admission odds into four standard PRD probability bands:
    * **Safe**: Rank is $\le 70\%$ of the trend closing rank.
    * **Moderate**: Rank is $70\% - 95\%$ of the closing rank.
    * **Ambitious**: Rank is $95\% - 115\%$ of the closing rank.
    * **Reach**: Rank is $> 115\%$ of the closing rank.
  * Triggers notification alerts (`PREDICTION_IMPROVED`) if a new cutoff import shifts a student's dream college into a safer probability band.
* **Choice-Filling Optimizer**: Ranks shortlisted target courses using a custom scoring matrix adjusted by the student's risk appetite (e.g., Conservative vs. Aggressive).
* **ROI Calculator**: Combines course tuition fees, living costs in the target city, and potential scholarship savings, weighing it against the college's placement median package to calculate the exact payback period in years.

### 💰 Student Financial Planning (`financial-planning`)
* **Calculators**: Employs estimators for living costs based on target city tiers (Tier-1: Bangalore/Bengaluru, Tier-2: Mysore/Mangalore/Hubli).
* **Dashboard Summary**: Integrates student tuition, accommodation, mess charges, personal allowance, scholarship awards, and loan EMIs into a unified budget overview.
* **What-if Scenario Planning**: Lets students adjust variables (such as loan interest rate or personal spending) to simulate different financial budgets.

### 🤖 AI Counsellor Integration (`counsellor`)
* **Session Lifecycle**: Handles isolated chat sessions, session deletion, chat naming, and chat rating feedback.
* **Context Aggregation** ([`counsellor.service.ts`](file:///c:/Users/sindh/Desktop/career-compass-ai%20%281%29/career-compass-ai/apps/api/src/modules/counsellor/services/counsellor.service.ts)):
  * Gathers full context: student profile, target exams, current wishlist, active budget, and historical cutoff trends.
  * Bundles context into an encrypted/secure format and streams the RAG query directly to the Python AI service.
  * Streams text chunks back to the client in real-time using Server-Sent Events (SSE).
  * Automatically flags conversations with low confidence scores for administrator review.

### 📑 Reports & Document Generation (`student-reports`)
* **Format Renderers**: Leverages dedicated renderers to compile student profiles, predictions, wishlists, and budgets into **PDF**, **Excel (.xlsx)**, **CSV**, or raw **HTML**.
* **Unified Pipeline** ([`report-generator.service.ts`](file:///c:/Users/sindh/Desktop/career-compass-ai%20%281%29/career-compass-ai/apps/api/src/modules/student-reports/services/report-generator.service.ts)): Renders all export formats from a single data aggregation structure, eliminating redundant queries.
* **Secure Sharing**: Implements guest access generation, token-controlled parent links, and log trackers.

### 🛡️ Enterprise Security (`security`)
* **MFA (2FA)**: Full TOTP registration and verification lifecycle, complete with secure QR codes and backup recovery codes.
* **Session & Device Tracking**: Browser fingerprinting tracks login history, flagging unknown devices or locations. Allows remote session revocation.
* **Brute-Force Detection**: Locks account interfaces after consecutive login failures.
* **Auditing**: Security logs tracking sensitive events (password changes, 2FA toggle, session termination).

### 🍪 Compliance, Consent & Memory (`memory`)
* **Cookie Consent**: Custom cookie consent register to comply with GDPR and Indian DPDP acts.
* **Memory Aggregator**: A unified interface that queries, exports, or deletes a user's data across all sub-services (Wishlist, Counsellor, Profile, Predictions) to support the Right to Portability and Right to be Forgotten.
* **UI Session State**: Stores workspace layouts and UI views for session continuation on return.

---

## 5. AI Python Service (`apps/ai-service`)

A high-performance **FastAPI** microservice serving as the AI engine.

### A. Vector Store (`prisma/schema.prisma` / `db/postgres.py`)
* Dedicated **PostgreSQL** database utilising the **PgVector** extension.
* Stores parsed document chunks (`chunks`) along with their 1536-dimension embeddings.
* Maintains a unique category table matching documents to categories (brochure, cutoff sheet, handbook, etc.).

### B. Python RAG Pipeline ([`main.py`](file:///c:/Users/sindh/Desktop/career-compass-ai%20%281%29/career-compass-ai/apps/ai-service/main.py))
* **FastAPI Endpoints**:
  * `/rag/query`: Processes user questions, retrieves chunks from the vector database using cosine distance, expanding structured database context, and passes them to the LLM.
  * `/rag/query/stream`: Employs Python async generators to stream response deltas via Server-Sent Events (SSE).
  * `/search/analyze`: Performs entity extraction and query expansion (e.g., mapping abbreviations like "PESIT" to "PES University") using fast regex-based pipelines.
  * `/predict-probability`: Secondary mathematical model estimating admission probability based on rank constraints.
  * `/settings/llm-provider`: Administrators can dynamically switch the active LLM provider (OpenAI, Azure, Gemini, Ollama, or Offline Fallback) on the fly without restarting the service.
  * `/knowledge/*`: Document ingestion, chunking, re-indexing, soft-deleting, and status monitoring.

---

## 6. Frontend Interface Client (`apps/web`)

A modern, fast **Next.js** application.

* **Design Language**: Rich, editorial design aesthetic featuring custom typography, asymmetrical layout configurations, Unsplash-driven campus images, smooth hover states, and dark/light modes.
* **Landing Page** ([`apps/web/src/app/page.tsx`](file:///c:/Users/sindh/Desktop/career-compass-ai%20%281%29/apps/web/src/app/page.tsx)):
  * Asymmetrical hero banner highlighting platform synthesis (KEA Cutoffs, AI RAG Counselling, ROI forecasts).
  * High-impact statistics grid (e.g., 98.4% prediction accuracy, 14,500+ KEA cutoffs).
  * Custom FAQ accordion and advisory form inputs.
* **Student Dashboard**: Quick statistics, roadmap checkpoints, and targeted search bars.
* **Interactive Calculators**: Real-time budget planners and EMI graphs.
* **AI Chat Terminal**: Streaming chatbot with citation cards that link to PDF pages, rating buttons, and quick suggestion prompts.
* **Admin Center**:
  * **Analytics Dashboard**: RAG statistics, popular colleges, and token usage trackers.
  * **Database Roster**: Interface to edit colleges, branches, placements, and verify user-submitted data.
  * **Cutoff Upload Panel**: Drag-and-drop zone to upload KEA spreadsheets, preview parsing states, and manage conflicts.

---

## 7. Database Schemas & Models

### NestJS MongoDB Schemas (Mongoose)
1. **User Schema**: Personal info, JWT refresh sessions, target exam records, categories, and active settings.
2. **College Schema**: Name, code, state, accreditation, courses list (durations, intake, fee schedule), and placement stats.
3. **Cutoff Schema**: Year, round, category, course code, closing rank, and status.
4. **CutoffConflict Schema**: Pending import conflicts tracking original vs. incoming closing ranks, with action markers (`create`, `update`, `conflict`).
5. **Wishlist Schema**: User associations, saved colleges, course choices, tags, customized notes, and compare metrics.
6. **AiConversation Schema**: User session chats, role-based message logs (`user`, `assistant`), cited source markers, and flagging status.
7. **SecurityAudit Schema**: Comprehensive audit logger capturing IP, location, activity details, and target indicators.

### Python PostgreSQL Schemas (Prisma)
1. **`knowledge_documents`**: Title, hash, status, chunk counts, source filename, upload details, and deletion markers (soft-deletes).
2. **`chunks`**: Text snippet content, metadata (page range/page number), and a 1536-dimension float vector representation.
3. **`retrieval_logs`**: Session context, query strings, confidence metrics, and retrieved chunk references.
4. **`prompt_templates`**: Admin system prompts, version numbers, and active status tags.
5. **`runtime_settings`**: Active system variables (such as active LLM providers).

---

## 8. Infrastructure & CI/CD Pipeline (`infra/`)

### A. Terraform (`infra/terraform/`)
Provisions complete AWS production infrastructure:
* **Region**: Mumbai (`ap-south-1`) to ensure minimum latency.
* **VPC**: 10.0.0.0/16 VPC containing public and private subnets.
* **EKS Cluster**: Kubernetes control plane managing container resources.
* **EKS Node Group**: Autoscaling worker nodes (t3.large instances scaling from 2 up to 10 nodes for results-day traffic spikes).
* **S3 Buckets**: Host college asset images and exported student reports with versioning and AES256 server-side encryption.

### B. Helm Charts (`infra/k8s/`)
Declares Kubernetes resources for both the `api` backend and `web` frontend:
* **Deployments**: Configures replicas, environment variables, volumes, and ports.
* **Services**: Maps ingress traffic.
* **Horizontal Pod Autoscaling (HPA)**: Scales pods dynamically based on CPU/memory usage.
* **Ingress**: Manages SSL termination and route mapping.

---

## 9. Covered Technical Accomplishments

The CareerCompass AI project successfully implements:
1. **Trend-Weighted Prediction Math**: Leverages historically grounded weighting rules, allocating higher weight to recent years to build stable prediction models.
2. **True Cosine Vector Search**: Runs low-latency retrieval queries against PostgreSQL chunks utilizing PgVector.
3. **Interactive PDF/Excel Generating Pipelines**: Aggregates datasets dynamically and converts them into structured downloads in milliseconds.
4. **Zero-Hallucination Guardrails**: Employs validation checks over RAG outputs, flagging any numeric values that cannot be validated against retrieved sources.
5. **Dynamic LLM Switcher**: Hot-swaps models dynamically (e.g., switching from OpenAI to Gemini) from the admin panel without restarting application processes.
6. **GDPR/DPDP Compliant Facade**: Implements comprehensive export and purge features across MongoDB and Postgres through a single endpoint.
7. **2FA Totp Security**: Provides robust multi-factor authentication, device fingerprint checks, and re-authentication guards.
