# CASETHREAD Core Algorithm Engine
### Evidence Gap Detection & Investigation Intelligence System
> **Tagline:** *"Connecting Evidence. Uncovering the Missing Pieces."*  
> **Implementation Standard:** C99 Native Core (Zero External Heavy Dependencies)  
> **Engine Version:** `1.0.0-phase3-dsa`

---

## 1. System Overview & Academic Purpose

**CASETHREAD** is an investigative support platform designed for police investigators, crime analysts, and forensic specialists. In complex criminal investigations, police collect vast amounts of seemingly disconnected intelligence—witness statements, CCTV logs, mobile device cell-tower dumps, vehicle registrations, physical ballistic markers, and timeline events.

The **CASETHREAD Core Algorithm Engine** is implemented natively in **C (C99 standard)**. As an academic project demonstrating core Computer Science fundamentals, it avoids high-level language abstractions or black-box third-party libraries. Instead, it demonstrates rigorous, manual implementations of fundamental **Data Structures and Algorithms (DSA)** to solve real-world investigative challenges:

1. **Uncovering Hidden Networks:** Constructing heterogeneous forensic knowledge graphs and discovering multi-hop association paths between suspects, vehicles, and crime scenes.
2. **Auditing Evidence Gaps:** Rigorously detecting missing timestamps, incomplete geographic data, unverified anonymous observations, and isolated entities.
3. **Spatiotemporal Anomaly Detection:** Evaluating movement across space and time using self-balancing trees to flag physically impossible speeds ($>120\text{ km/h}$) and timeline contradictions.
4. **Generating Actionable Leads:** Synthesizing investigative leads prioritized by graph centrality and forensic gap severity scores.

> [!IMPORTANT]
> **Ethical Investigative Safeguard:**  
> The system operates strictly as an investigative aid for human detectives. It **never** declares guilt, assigns culpability, or treats uncorroborated conjectures as established facts. Unverified observations are explicitly partitioned from confirmed forensic evidence.

---

## 2. Forensic Data Structures & Algorithmic Matrix

The core engine implements seven fundamental data structures and four analytical modules entirely from scratch:

```
                                  +---------------------------------------+
                                  |     JSON Case Payload via STDIN       |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |   High-Performance Ingestion Parser   |
                                  +---------------------------------------+
                                                      |
                  +-----------------------------------+-----------------------------------+
                  |                                   |                                   |
                  v                                   v                                   v
+-----------------------------------+ +-----------------------------------+ +-----------------------------------+
|       Separate-Chaining           | |     Self-Balancing AVL Tree       | |      Adjacency-List Graph         |
|         Hash Map (DJB2)           | |    & Chronological BST Index      | |     (Typed Entities & Edges)    |
|-----------------------------------| |-----------------------------------| |-----------------------------------|
| * O(1) Entity Retrieval           | | * O(log N) Time-Range Queries     | | * BFS Shortest Evidence Path    |
| * Dynamic Re-hashing (L >= 0.75)  | | * Temporal Monotonicity Check     | | * DFS Connected Components      |
| * Tracking Code & ID Indexing     | | * Self-Balancing (LL, RR, LR, RL) | | * 3-Color Cycle Detection       |
+-----------------------------------+ +-----------------------------------+ +-----------------------------------+
                  |                                   |                                   |
                  +-----------------------------------+-----------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |     Forensic Intelligence Modules     |
                                  |---------------------------------------|
                                  | 1. Rule-Based Evidence Gap Detector   |
                                  | 2. Spatiotemporal Velocity Analyzer   |
                                  | 3. Centrality-Weighted Lead Generator |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |   Structured Forensic JSON to STDOUT  |
                                  +---------------------------------------+
```

---

### Detailed Data Structure Analysis

#### A. Separate-Chaining Hash Map (`hashmap.c`)
- **Forensic Role:** Rapid, constant-time indexing of evidence items, vehicle license plates, phone numbers, and entity IDs (`SUSPECT:101`, `VEHICLE:DL01AB1234`).
- **Hashing Function:** DJB2 hash algorithm ($\text{hash} = ((\text{hash} \ll 5) + \text{hash}) + c$), providing uniform key distribution and minimal clustering.
- **Collision Resolution:** Separate chaining with dynamic linked list buckets.
- **Dynamic Resizing:** Automatically doubles table capacity ($2 \times \text{capacity}$) and re-hashes all keys whenever load factor $\lambda = \frac{N}{\text{capacity}} \ge 0.75$.
- **Complexity:**
  - Average Case: $\mathcal{O}(1)$ Insert, Search, and Delete.
  - Worst Case: $\mathcal{O}(N)$ if all keys hash to the same bucket (mitigated by DJB2 and dynamic resizing).

#### B. Binary Search Tree (BST) (`bst.c`)
- **Forensic Role:** Maintains events strictly ordered by Unix epoch timestamp.
- **Forensic Utility:** In-order traversal ($\mathcal{O}(N)$) outputs a chronologically sequenced investigation event log.
- **Complexity:**
  - Average Case: $\mathcal{O}(\log N)$ Insertion, Search.
  - Worst Case: $\mathcal{O}(N)$ when events are inserted in monotonic chronological order (degeneration into a linked list).

#### C. Self-Balancing AVL Tree (`avl.c`)
- **Forensic Role:** Solves the BST chronological skew problem. Police events are almost always logged in chronological order. An unbalanced BST would degrade to $\mathcal{O}(N)$. The AVL tree guarantees strict balance.
- **Balance Invariant:** For every node $v$, $|\text{height}(\text{left}) - \text{height}(\text{right})| \le 1$.
- **Rotations Implemented:**
  1. *Left-Left (LL):* Single right rotation.
  2. *Right-Right (RR):* Single left rotation.
  3. *Left-Right (LR):* Left rotation on child, followed by right rotation on parent.
  4. *Right-Left (RL):* Right rotation on child, followed by left rotation on parent.
- **Range Queries:** Range query algorithm (`avl_range_query`) extracts all events within interval $[T_1, T_2]$ in guaranteed $\mathcal{O}(\log N + K)$ time, where $K$ is the number of matched events.
- **Complexity:**
  - Guaranteed Worst-Case: $\mathcal{O}(\log N)$ Insertion, Search, Deletion.

#### D. Adjacency-List Graph (`graph.c`, `bfs.c`, `dfs.c`)
- **Forensic Role:** Models the complete investigation network as an undirected/directed graph $G = (V, E)$, where $V$ represents persons, vehicles, locations, CCTV feeds, and physical evidence, while $E$ represents verified interactions, ownerships, sightings, or shared forensic markers.
- **Breadth-First Search (BFS):**
  - Uses a FIFO Queue to find the **shortest path of association** between two entities (e.g., *Suspect A $\to$ Phone $\to$ Suspect B $\to$ Stolen Vehicle*).
  - Guarantees minimum number of intermediate hops.
- **Depth-First Search (DFS) & Connected Components:**
  - Explores graph depth and partitions $V$ into connected components ($C_1, C_2, \dots, C_k$) to detect isolated suspects or independent conspiracy sub-cells.
- **Three-Color Cycle Detection:**
  - Employs White/Gray/Black graph coloring to flag circular associations, reciprocal statements, or timeline loops in $\mathcal{O}(V + E)$ time.

#### E. Queue, Stack, and Dynamic Linked List (`structures/`)
- **Generic Queue (`queue.c`):** $\mathcal{O}(1)$ FIFO enqueue and dequeue operations powering BFS traversals.
- **Generic Stack (`stack.c`):** $\mathcal{O}(1)$ LIFO push and pop operations supporting DFS backtracking and state unwind.
- **Dynamic Linked List (`linkedlist.c`):** Dynamic storage for graph adjacency lists, collision chains, and evidence arrays.

---

## 3. Algorithmic Intelligence Modules

### 1. Evidence Gap Detection (`gap_detection.c`)
Audits all collected records and flags four critical categories of investigative gaps:
- `MISSING_TIMESTAMP`: Evidence lacking verified collection time.
- `MISSING_SOURCE`: Evidence missing chain-of-custody source provenance.
- `INCOMPLETE_LOCATION`: Physical evidence lacking GPS or street-level collection origin.
- `UNVERIFIED_OBSERVATION`: Anonymous tips or uncorroborated witness claims lacking forensic backing.
- `DISCONNECTED_CLUSTER`: Graph vertices with degree $\text{deg}(v) = 0$, representing isolated leads that require relational integration.

### 2. Spatiotemporal Timeline Analysis (`timeline_analysis.c`)
Iterates through the AVL tree-sorted timeline and evaluates consecutive appearances of identical entities.
- Calculates physical displacement using geographic distance approximation.
- Calculates elapsed interval $\Delta t = t_2 - t_1$.
- Computes transit speed $v = \frac{\Delta d}{\Delta t}$.
- Flags **Spatiotemporal Travel Anomalies** if $v > 120\text{ km/h}$ for ground entities or if an individual is logged at disparate locations simultaneously ($\Delta t \le 60\text{ s}, \Delta d > 5\text{ km}$).

### 3. Centrality-Weighted Lead Generation (`lead_generation.c`)
Synthesizes actionable next steps for investigators based on a multi-factor heuristic:
$$\text{Priority Score} = \min\left(100, \; 30 + 10 \cdot \text{deg}(v) + \sum \text{Severity}(\text{gaps})\right)$$
- Categorizes lead strength: `CRUCIAL_LEAD` ($\ge 85$), `STRONG_CORROBORATION` ($\ge 65$), or `INVESTIGATIVE_OPPORTUNITY` ($< 65$).
- Explicitly frames suggestions as questions and investigative angles (e.g., *"Review CCTV camera feeds within 500m of Dock 9"*).

---

## 4. Time & Space Complexity Matrix

| Data Structure / Algorithm | Operation / Traversal | Average Time | Worst-Case Time | Space Complexity | Forensic Use Case |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Hash Map (DJB2)** | Key Insertion | $\mathcal{O}(1)$ | $\mathcal{O}(N)$ | $\mathcal{O}(N)$ | Indexing Evidence Codes & Entity IDs |
| **Hash Map (DJB2)** | Key Lookup | $\mathcal{O}(1)$ | $\mathcal{O}(N)$ | $\mathcal{O}(N)$ | Rapid $O(1)$ relationship lookup |
| **Binary Search Tree** | Insertion / Search | $\mathcal{O}(\log N)$ | $\mathcal{O}(N)$ | $\mathcal{O}(N)$ | Baseline temporal ordering |
| **Binary Search Tree** | In-order Traversal | $\mathcal{O}(N)$ | $\mathcal{O}(N)$ | $\mathcal{O}(N)$ | Chronological incident export |
| **Self-Balancing AVL Tree** | Insertion / Search | $\mathcal{O}(\log N)$ | $\mathcal{O}(\log N)$ | $\mathcal{O}(N)$ | Guaranteed time indexing under monotonic inserts |
| **Self-Balancing AVL Tree** | Range Query $[T_1, T_2]$ | $\mathcal{O}(\log N + K)$ | $\mathcal{O}(\log N + K)$ | $\mathcal{O}(K)$ | Alibi window & crime interval retrieval |
| **Graph (Adjacency List)** | Vertex / Edge Add | $\mathcal{O}(1)$ | $\mathcal{O}(1)$ | $\mathcal{O}(V + E)$ | Associating evidence and entities |
| **BFS Shortest Path** | Path Reconstruction | $\mathcal{O}(V + E)$ | $\mathcal{O}(V + E)$ | $\mathcal{O}(V)$ | Minimum-hop connection between entities |
| **BFS Neighborhood Exploration** | Subgraph Retrieval | $\mathcal{O}(V + E)$ | $\mathcal{O}(V + E)$ | $\mathcal{O}(V)$ | $K$-hop local entity neighborhood discovery |
| **DFS Components & Cycles** | Full Traversal | $\mathcal{O}(V + E)$ | $\mathcal{O}(V + E)$ | $\mathcal{O}(V)$ | Sub-network discovery & cycle detection |
| **FIFO Queue / LIFO Stack** | Enqueue / Push / Pop | $\mathcal{O}(1)$ | $\mathcal{O}(1)$ | $\mathcal{O}(N)$ | Graph traversals and algorithm execution |

---

## 5. Inter-Process Communication (IPC) Protocol

The C Core Engine communicates with the Node.js backend using a strictly isolated standard I/O (stdio) pipe protocol:

1. **Input (STDIN):** High-density JSON payload containing `case_id`, `entities`, `evidence`, `relationships`, and `timeline`.
2. **Processing:** Native C ingestion, data structure population, graph traversals, gap audits, and timeline scans.
3. **Output (STDOUT):** Strictly parseable JSON containing metrics, detected connections, evidence gaps, timeline anomalies, connected components, and prioritized leads.
4. **Diagnostics (STDERR):** All debugging messages, memory allocation logs, and version banners route exclusively to `stderr`, guaranteeing zero JSON output corruption.

---

## 6. Compilation & Execution Guide

### Linux / Docker / macOS (GCC or Clang)
The project includes a robust GNU `Makefile`:

```bash
# Build the core engine binary (bin/casethread_engine)
make

# Build and execute the full 58-test DSA verification suite
make test

# Clean all build artifacts
make clean
```

### Windows (MSVC `cl.exe`)
For native Windows development, an automated build batch script is provided:

```cmd
cd core-engine
build.bat
```

Alternatively, invoke `cl.exe` directly:
```cmd
cl /O2 /Fe:bin\casethread_engine.exe /Iinclude src\*.c src\structures\*.c src\hashmap\*.c src\trees\*.c src\graphs\*.c src\algorithms\*.c
```

### CLI Command Options

```bash
# Verify build version and registered DSA capabilities
./bin/casethread_engine --version

# Run analysis on a JSON payload via standard input
./bin/casethread_engine --stdin < sample_case.json

# Display help and usage
./bin/casethread_engine --help
```

### Running the Unit Test Suite

```bash
# Run unit tests
./bin/test_dsa
```
**Test Coverage:** 58 assertions verifying Hash Map separate chaining, load factor dynamic resizing, BST monotonicity, AVL balancing and rotations, BFS shortest paths, DFS components, cycle detection, gap identification, and timeline anomaly flagging.
