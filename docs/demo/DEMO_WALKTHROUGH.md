# CASETHREAD — GUIDED DEMO WALKTHROUGH
## 8–12 Minute Presentation Script & Evaluator Walkthrough

**Demonstration Scenario:** Missing Research Laptop — Campus Investigation  
**Docket:** `CASE-DEMO-2026-CAMPUS`  
**Presenter Role:** Senior Detective / Case Commander Alexander Cross (`DET-8841`)  

---

## Pre-Demo Checklist (Before Evaluation Begins)

1. Verify backend server is running on port 5001 (`cd backend && node server.js`).
2. Verify frontend server is running on port 3000 (`cd frontend && npm start`).
3. Verify MySQL 8 service is running (`127.0.0.1:3306`).
4. Ensure the demo case is seeded by executing:
   ```bash
   cd backend
   npm run seed:demo
   ```
5. Open Google Chrome or modern web browser to `http://localhost:3000`.

---

## Presentation Walkthrough Script

### Step 1 — Police Authentication & Login (0:00 – 1:00)
- **Action:** Open `http://localhost:3000`. In the login modal, enter:
  - **Badge Number:** `DET-8841`
  - **Password:** `Password123!`
  - Click **Sign In to Secure Terminal**.
- **What to Explain:**
  > *"CaseThread protects sensitive investigation data with role-based access control. Passwords are salted and hashed with bcrypt (12 rounds) on the backend, issuing a cryptographic JSON Web Token that enforces authorization across all forensic operations."*
- **Visual Outcome:** Successfully transitions to the dark-mode Command Center.

---

### Step 2 — Command Dashboard & Investigation Overview (1:00 – 2:00)
- **Action:** Point out the executive metric tiles: Total Cases, Active Evidence, Open Leads, Chain-of-Custody integrity.
- **What to Explain:**
  > *"The dashboard acts as an investigation command hub. Notice the top ribbon summarizing active dockets and immediate priority leads. We will open our campus demonstration case: 'Missing Research Laptop — Campus Investigation'."*
- **Action:** Click **Investigations** in the sidebar, locate `CASE-DEMO-2026-CAMPUS`, and click to open the case workspace.

---

### Step 3 — Evidence Vault & Cryptographic Hashes (2:00 – 3:30)
- **Action:** Navigate to **Evidence Vault** in the sidebar. Select `CASE-DEMO-2026-CAMPUS`.
- **What to Explain:**
  > *"Every physical item, CCTV stream, and digital log collected by detectives is registered in the Evidence Vault. Notice items E001 through E007."*
- **Key Highlight (Integrity Proof):**
  > *"Notice each item has a unique tracking code (e.g., EVD-CAMPUS-001) and an immutable SHA-256 cryptographic digest computed directly from the payload. CaseThread also maintains a block-level hash chain across all custody handoffs to guarantee courtroom admissibility."*
- **Point Out:** `EVD-CAMPUS-007` (Mechanical Emergency Override Key). Explain that this key was found displaced in Custodian Closet #2.

---

### Step 4 — Evidence Relationship Network (3:30 – 5:00)
- **Action:** Navigate to **Evidence Network** in the sidebar.
- **What to Explain:**
  > *"In traditional investigative software, evidence sits in flat tables. CaseThread converts evidence, suspects, and locations into an in-memory graph. Directed edges represent documented physical and digital relationships with confidence weights."*
- **Show Relationships:**
  - Devon Kross (Contractor) $\rightarrow$ E001 Access Log (Scanned badge at 21:42).
  - E001 Access Log $\rightarrow$ E006 Wi-Fi Disconnect (Network dropped at 21:44:12).
  - E006 Wi-Fi Disconnect $\rightarrow$ E004 Laptop Inventory (MAC address match).
  - E001 Access Log $\rightarrow$ E002 Corridor CCTV (Individual with backpack exits at 21:48).

---

### Step 5 — Native C Algorithm Lab (5:00 – 7:30) — *Core ADS Showcase*
- **Action:** Navigate to **Investigation Lab** in the sidebar.
- **What to Explain:**
  > *"This is the centerpiece of our Advanced Data Structures implementation. Rather than simulating algorithms in JavaScript, the backend streams the case topology via standard I/O into our native compiled C99 engine (`casethread_engine.exe`)."*
- **Demonstration A — Breadth-First Search (BFS):**
  - Select **Algorithm:** `Breadth-First Search (BFS)`.
  - Set **Start Node:** `Devon Kross`.
  - Click **Execute Native Algorithm**.
  - **Show Traversal:** Walk through the interactive step-by-step queue states (`QUEUE_ENQUEUE`, `QUEUE_DEQUEUE`) as BFS discovers vertices in non-decreasing order of hop distance in under 2 milliseconds ($O(V + E)$).
- **Demonstration B — Max-Heap Priority Queue:**
  - Select **Algorithm:** `Binary Max-Heap Priority Queue`.
  - Click **Execute**.
  - Show how investigative leads are maintained in logarithmic $O(\log N)$ extraction order, with Lead 1 (Cell tower dump for Devon Kross, Score: 95.0) placed at root index 0.

---

### Step 6 — Evidence Gap Review (7:30 – 8:30)
- **Action:** In the Algorithm Lab, select **Connected Components & Isolated Leads**. Click **Execute**.
- **What to Explain:**
  > *"Notice the algorithm partitions the network into connected components. Component 1 contains the main theft path. However, Component 2 contains an isolated node: `EVD-CAMPUS-007` (Emergency Override Key) with degree 0."*
- **Crucial Ethical Distinction:**
  > *"CaseThread does NOT claim automated AI crime-solving. Disconnected evidence is not proof of guilt. Instead, it exposes a critical evidentiary gap: Why was the mechanical override key displaced without a checkout log? This algorithmic finding directly generates an action item for detectives to lift latent prints from the key."*

---

### Step 7 — Spatiotemporal Timeline & Contradiction Analysis (8:30 – 10:00)
- **Action:** Navigate to **Timeline Analysis** in the sidebar.
- **What to Explain:**
  > *"The timeline unifies multi-source events chronologically using an in-memory AVL tree structure."*
- **Highlight Two Key Findings:**
  1. **Precise Sequence:** Devon Kross signs in at 20:45 $\rightarrow$ Scans into Lab 402 at 21:42 $\rightarrow$ Laptop disconnects from Wi-Fi at 21:44:12 $\rightarrow$ Individual exits fire stairs on CCTV at 21:48.
  2. **Identified Temporal Gap:** Highlight the **10 hour 42 minute gap** between CCTV exit (21:48) and Prof. Reynolds discovering the theft the following morning (08:30).

---

### Step 8 — Report Center & Multi-Format Export (10:00 – 11:30)
- **Action:** Click **Report Center** in the sidebar (or header "REPORT" button). Select `CASE-DEMO-2026-CAMPUS`.
- **Action:** Select **Template:** `Evidence Inventory & Cryptographic Ledger`.
  - Show the dynamic document preview updating in real-time with 100% SHA-256 hashed items.
- **Action:** Switch to **Template:** `Comprehensive Case Dossier`.
  - Scroll through the official law-enforcement layout, case summary, evidence tables, custody ledger, timeline, and signature attestation block.
- **Action:** Click **Export CSV** (show safe formula escaping) and **Print / Save as PDF** to demonstrate print-ready paged media formatting.

---

### Step 9 — Conclusion & Viva Readiness (11:30 – 12:00)
- **Closing Statement:**
  > *"To summarize: CaseThread connects physical investigation workflows with native C data structures. Every evidentiary link is explainable, every hash is mathematically verified, and algorithmic outputs strictly empower human investigators rather than automating unverified conclusions. We are ready for technical viva questions."*

---

## Live Troubleshooting & Fallback Procedures

| Potential Issue | Immediate Fallback Action |
| :--- | :--- |
| **Demo case not appearing in dropdown** | Run `npm run seed:demo` in terminal; refresh browser. |
| **Backend API disconnected** | Restart backend: `cd backend && node server.js`. |
| **C Engine execution timeout** | Ensure `core-engine/bin/casethread_engine.exe` exists. If needed, run `core-engine/build.bat` to recompile. |
| **Accidental data corruption during live test** | Re-run `npm run seed:demo` — it cleans and restores the exact demo state in 1 second. |
