# CASETHREAD — DEPLOYMENT COST & RESOURCE ESTIMATION REPORT
**Version:** 1.0.0-phase19  
**Policy:** Zero-Cost Development Budget / Controlled Police Infrastructure

---

## 1. EXECUTIVE SUMMARY

In strict compliance with the Phase 19 primary directives, **zero paid cloud services, external billable APIs, or commercial domains have been activated**. 

CaseThread is designed to operate seamlessly across three deployment tiers:
1. **Tier 1 (Recommended & Fully Operational):** Completely Local / Air-Gapped Police Workstation (**\$0.00 / Month**).
2. **Tier 2:** Zero-Cost Cloud Staging using Community / Free Tiers (**\$0.00 / Month** with known capacity limits).
3. **Tier 3:** High-Availability Police Department Production Infrastructure (On-Premises Hardware or Dedicated Cloud VPC).

---

## 2. DETAILED RESOURCE REQUIREMENTS & TIER BREAKDOWN

### Tier 1: Completely Local / Air-Gapped Workstation Deployment (Current Architecture)
- **Cost:** **\$0.00** (Uses existing hardware and open-source infrastructure)
- **Frontend:** Built with React 19, served locally via Nginx or Express static serving.
- **Backend API:** Node.js 20 runtime consuming $< 80\text{ MB}$ RAM.
- **Relational Database:** MySQL 8 Community Edition (zero licensing fee).
- **Native C Engine:** Compiled directly on host architecture (`gcc` / MinGW-w64), sub-50ms execution.
- **AI Inference Engine:** Deterministic rule-based Hybrid RAG reasoner consuming 0 external tokens and 0 billable API credits, with optional local quantized model (Ollama / llama.cpp) running on consumer CPU/GPU.
- **Digital Vault Storage:** Local filesystem storage bounded by local disk space.
- **Backup & Recovery:** Local logical SQL dumps with SHA-256 integrity hashing.

### Tier 2: Zero-Cost Developer Cloud Staging (Evaluated Free-Tier Limitations)

| Component | Free-Tier Provider | Free-Tier Limit | CaseThread Viability Assessment |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | Cloudflare Pages / Vercel | Unlimited bandwidth / 100GB | **VIABLE** for compiled static React SPA assets. |
| **Backend API** | Render / Fly.io / Railway | 512MB RAM, shared vCPU | **VIABLE for basic API**, but cold-starts and ephemeral filesystems risk evidence vault loss without persistent volume attachments. |
| **MySQL Database** | Aiven / PlanetScale / Oracle Free Tier | 5GB storage, 1-2 vCPU | **VIABLE for staging**, but strict row limits or sleep timeouts on inactive instances interfere with forensic audit trails. |
| **Document Storage** | Cloudflare R2 | 10GB free / 0 egress fee | **VIABLE** for staging evidence files. |
| **Local AI Inference** | None (Cloud GPU free tiers do not exist for continuous background inference) | — | **NOT VIABLE** on free tiers. Must use local CPU/deterministic engine. |

> [!WARNING]
> Public free-tier cloud platforms are **NOT APPROVED** for operational police use due to compliance mandates (CJIS, GDPR, DPA 2018). Real historical crime records and sensitive victim files must never be hosted on shared multi-tenant public free tiers.

### Tier 3: Dedicated Police Department Infrastructure (Cost Projection for Operational Review)

If a police department approves a transition from local air-gapped workstations to enterprise server infrastructure:

| Infrastructure Item | Dedicated Hardware (On-Premises) | Cloud VPC (AWS GovCloud / Azure Govt) |
| :--- | :---: | :---: |
| **Compute (API & C Engine)** | Existing Rack Server (4 Cores, 16GB RAM) | 1x `t4g.xlarge` (~$98/mo) |
| **Database (MySQL 8 Cluster)** | Existing RAID-10 Storage Server | Multi-AZ RDS `db.m6g.large` (~$180/mo) |
| **Vault Storage (Encrypted)** | 2TB Enterprise NVMe Drive (~$300 one-time) | 500GB S3 Standard + Glacier (~$15/mo) |
| **Local LLM Inference (Optional)** | 1x NVIDIA RTX 4080 (16GB VRAM) (~$1,100 one-time) | 1x `g5.xlarge` (On-Demand: ~$730/mo) |
| **Total Estimated Ongoing Cost** | **$0.00 / month (capital amortized)** | **~$293 – $1,023 / month** |

---

## 3. RECOMMENDATION FOR CONTROLLER APPROVAL

**Maintain Tier 1 (Completely Local / Air-Gapped Workstation Deployment).**  
It satisfies all Phase 1 through 19 functional and forensic requirements with **zero operational cost**, complete data sovereignty, and zero cloud dependency risk.
