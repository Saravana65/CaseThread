# Document B: Frontend and User Interface Explanation

> **Project:** CASETHREAD - Evidence Gap Detection and Investigation Support System  
> **Technology:** React.js 18, React Router v6, CSS3 Modern Flexbox/Grid  
> **Institution:** Geethanjali College of Engineering and Technology (GCET)

---

## 1. Overview
The CASETHREAD frontend is designed as a responsive Single-Page Application (SPA) providing investigative officers with a distraction-free, high-contrast forensic dashboard. It incorporates a professional dark theme (Charcoal `#1A1A1A`, Crimson `#C02828`, Amber `#E88B2E`) engineered for long analytical sessions.

## 2. Navigation Architecture: Collapsible Left Sidebar
The application layout centers on a permanent collapsible left sidebar (`Sidebar.js`):
- **Expanded Width:** 250px (showing category headers, icons, and text labels).
- **Collapsed Width:** 72px (icon-only mode with active tooltips).
- **Navigation Groups:**
  - **CASETHREAD:** Dashboard overview.
  - **INVESTIGATIONS:** All Cases, New Case Registration, Active Investigations, Solved Archives.
  - **INTELLIGENCE:** Evidence Management Vault, Relationship Graph, Timeline Analysis, Evidence Gaps, Investigative Leads, Geospatial Analysis.
  - **OPERATIONS:** Officer Roster, Task Management, Evidence Quality Review, Activity & Audit Logs.
  - **SYSTEM:** Validation Dashboard, Investigative Reports, System Settings.
- **Bottom Profile:** Displays authenticated officer name, badge number, active role badge, and one-click secure logout.

## 3. Core Screen Breakdown
1. **Login Portal (`Login.js`):** Terminal-inspired secure authentication interface requiring Badge Number and passcode.
2. **Investigation Dashboard (`Dashboard.js`):** Central command hub featuring dynamic metric cards (Total Cases, Active Files, Evidence Items, Gaps, Leads), priority distribution charts, and officer task rosters.
3. **Case Dossier (`CaseDetail.js`):** Master case hub displaying lead detective assignment, suspect dossiers, witness credibility scores, and registered evidence.
4. **Relationship Graph Canvas (`GraphView.js`):** Interactive SVG network graph displaying color-coded entity nodes, confidence-weighted relationship edges, and BFS shortest-path investigative tracing.
5. **Digital Evidence Vault (`EvidenceVault.js`):** Storage metrics, category breakdown cards, and immutable SHA-256 integrity ledger.
6. **Geospatial Proximity Map (`GeospatialView.js`):** Map-based coordinate clustering and co-presence detection.

## 4. State Management and API Integration
The frontend utilizes React Hooks (`useState`, `useEffect`, `useCallback`) alongside a centralized API service layer (`src/services/api.js`). JWT tokens are securely persisted in `localStorage` and dispatched via Axios/Fetch request interceptors in the `Authorization: Bearer <token>` header.
