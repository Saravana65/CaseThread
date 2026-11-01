# CASETHREAD C Core DSA Engine – Empirical Benchmark Report

## 1. Environment & Hardware Profile
- **OS Platform:** Windows 11 (x64)
- **Compiler:** Microsoft Visual C/C++ Optimizing Compiler (MSVC v18.5.2 / x64)
- **Optimization Level:** `/O2 /W3 /D_CRT_SECURE_NO_WARNINGS`
- **Timer Resolution:** Windows High-Resolution Performance Counter (`QueryPerformanceCounter`)
- **Metric Output:** [`core-engine/benchmarks/benchmark_results.csv`](file:///c:/Users/ssana/Desktop/CaseThread/core-engine/benchmarks/benchmark_results.csv)

---

## 2. Benchmark Summary Results

### A. Separate-Chaining Hash Map ($O(1)$ Average)
Dynamic expansion triggered at load factor $\lambda \ge 0.75$.

| Scale ($N$) | Insert Time ($\mu\text{s}$) | Insert Throughput (ops/s) | Lookup Time ($\mu\text{s}$) | Lookup Throughput (ops/s) | Observed Scaling |
|---|---|---|---|---|---|
| **100** | $39.80\,\mu\text{s}$ | 2,512,563 | $3.40\,\mu\text{s}$ | 29,411,793 | $O(1)$ |
| **500** | $119.60\,\mu\text{s}$ | 4,180,602 | $24.80\,\mu\text{s}$ | 20,161,291 | $O(1)$ |
| **1,000** | $219.20\,\mu\text{s}$ | 4,562,044 | $39.70\,\mu\text{s}$ | 25,188,919 | $O(1)$ |
| **5,000** | $951.10\,\mu\text{s}$ | 5,257,071 | $185.00\,\mu\text{s}$ | 27,027,027 | $O(1)$ |
| **10,000**| $3,032.40\,\mu\text{s}$| 3,297,718 | $1,548.90\,\mu\text{s}$| 6,456,195 | $O(1)$ |

```
Hash Map Lookup Scaling Curve (us)
10000 |                                                    *  (1.55 ms)
 5000 |                                       *
 1000 |                         *
  500 |                   *
  100 |          *
      +-------------------------------------------------------------
        100     500     1000                  5000         10000 (N)
```

---

### B. Self-Balancing AVL Tree ($O(\log N)$ Guaranteed)
Rotations maintain node balance factor strictly within $[-1, 1]$.

| Scale ($N$) | Insertion Time ($\mu\text{s}$) | Insert Throughput (ops/s) | Inorder Traversal ($\mu\text{s}$) | 100 Window Range Queries ($\mu\text{s}$) | Tree Invariant |
|---|---|---|---|---|---|
| **100** | $123.20\,\mu\text{s}$ | 811,688 | $2.20\,\mu\text{s}$ | $18.40\,\mu\text{s}$ | Balance $\in [-1, 1]$ |
| **500** | $416.30\,\mu\text{s}$ | 1,201,057 | $12.60\,\mu\text{s}$ | $891.60\,\mu\text{s}$ | Balance $\in [-1, 1]$ |
| **1,000** | $758.00\,\mu\text{s}$ | 1,319,261 | $14.60\,\mu\text{s}$ | $149.90\,\mu\text{s}$ | Balance $\in [-1, 1]$ |
| **5,000** | $3,399.70\,\mu\text{s}$| 1,470,718 | $74.50\,\mu\text{s}$ | $153.60\,\mu\text{s}$ | Balance $\in [-1, 1]$ |
| **10,000**| $6,836.50\,\mu\text{s}$| 1,462,737 | $172.10\,\mu\text{s}$ | $212.20\,\mu\text{s}$ | Balance $\in [-1, 1]$ |

---

### C. Adjacency-List Evidence Graph ($O(V + E)$)
Weighted relationship graph with multi-hop association edges ($E \approx 3.5V$).

| Vertices ($V$) | Edges ($E$) | Graph Build ($\mu\text{s}$) | 50 BFS Path Queries ($\mu\text{s}$) | DFS Component Partition ($\mu\text{s}$) |
|---|---|---|---|---|
| **50** | 139 | $150.30\,\mu\text{s}$ | $340.80\,\mu\text{s}$ | $6.10\,\mu\text{s}$ |
| **100** | 289 | $162.00\,\mu\text{s}$ | $299.80\,\mu\text{s}$ | $5.20\,\mu\text{s}$ |
| **250** | 739 | $394.90\,\mu\text{s}$ | $696.40\,\mu\text{s}$ | $31.20\,\mu\text{s}$ |
| **500** | 1,489 | $743.30\,\mu\text{s}$ | $3,568.30\,\mu\text{s}$ | $73.30\,\mu\text{s}$ |
| **1,000**| 2,989 | $1,443.30\,\mu\text{s}$ | $5,770.00\,\mu\text{s}$ | $121.10\,\mu\text{s}$ |

---

### D. Array-Based Binary Max-Heap Priority Queue ($O(\log N)$)
Dynamic capacity expansion maintaining max-priority score at root array index 0.

| Scale ($N$) | Insert Time ($\mu\text{s}$) | Insert Throughput (ops/s) | 10k Peek Max ($\mu\text{s}$) | Extract All Max Time ($\mu\text{s}$) | Extract Throughput (ops/s) |
|---|---|---|---|---|---|
| **100** | $6.60\,\mu\text{s}$ | 15,151,533 | $19.30\,\mu\text{s}$ | $7.50\,\mu\text{s}$ | 13,333,335 |
| **500** | $28.90\,\mu\text{s}$ | 17,301,037 | $19.40\,\mu\text{s}$ | $50.90\,\mu\text{s}$ | 9,823,184 |
| **1,000** | $39.60\,\mu\text{s}$ | 25,252,528 | $19.30\,\mu\text{s}$ | $115.50\,\mu\text{s}$ | 8,658,009 |
| **5,000** | $185.80\,\mu\text{s}$ | 26,910,658 | $19.30\,\mu\text{s}$ | $788.60\,\mu\text{s}$ | 6,340,350 |
| **10,000**| $750.10\,\mu\text{s}$ | 13,331,556 | $22.60\,\mu\text{s}$ | $1,908.60\,\mu\text{s}$ | 5,239,443 |

```
Max-Heap Extract-Max Scaling Curve (us)
 2000 |                                                    *  (1.91 ms)
 1500 |
 1000 |                                       *
  500 |
  100 |                         *
    0 |          *        *
      +-------------------------------------------------------------
        100     500     1000                  5000         10000 (N)
```

---

## 3. How to Reproduce
Run the verified native benchmark suite:
```powershell
cd core-engine
.\bin\benchmark_dsa.exe
```
Or on Linux / GCC:
```bash
cd core-engine
make benchmark
```
Output data will be regenerated in `benchmarks/benchmark_results.csv`.
