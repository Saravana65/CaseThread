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

The core engine implements eight fundamental data structures and four analytical modules entirely from scratch:

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
                                  |   Binary Max-Heap Priority Queue      |
                                  |   - O(log N) Lead Prioritization      |
                                  |   - O(1) Top Investigative Lead Peek  |
                                  |   - Strict Monotonic Descending Order |
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

#### F. Dynamic Array-Based Binary Max-Heap Priority Queue (`max_heap.c`)
- **Forensic Role:** Ranks candidate investigative leads dynamically by composite priority score. Detectives in active investigations need the most urgent, high-impact leads surfaced first.
- **Why Max-Heap was Selected:**
  - Finding the top lead in an unsorted list takes $\mathcal{O}(N)$ linear scan time, or $\mathcal{O}(N \log N)$ to sort after every update.
  - A Binary Max-Heap enables $\mathcal{O}(1)$ immediate inspection of the highest-priority action item (`heap_peek_max`).
  - Dynamic insertion (`heap_insert`) and extraction (`heap_extract_max`) operate in guaranteed $\mathcal{O}(\log N)$ logarithmic time.
  - Memory locality: Stored as a flat, contiguous dynamic array (`elements[0 ... size-1]`), avoiding pointer-chasing overhead and node fragmentation present in tree-based priority queues.
- **Array Representation and Indexing Logic:**
  - Complete binary tree mapped directly into zero-based contiguous memory:
    - **Parent Index:** $\text{parent}(i) = \left\lfloor \frac{i - 1}{2} \right\rfloor \quad (\text{for } i > 0)$
    - **Left Child Index:** $\text{left}(i) = 2i + 1$
    - **Right Child Index:** $\text{right}(i) = 2i + 2$
  - **Max-Heap Invariant:**
    $$\text{priority}(\text{elements}[\text{parent}(i)]) \ge \text{priority}(\text{elements}[i]) \quad \forall \; i > 0$$
    The root element at index $0$ is guaranteed to maintain the global maximum priority score.
- **Core Operations & Sifting Logic:**
  - `heap_create(capacity)`: Allocates initial array storage (default capacity 16). $\mathcal{O}(1)$ time.
  - `heap_insert(heap, priority, data)`: Inserts new element at the leaf end (`elements[size]`) and bubbles up via `heapify_up` until the heap invariant is restored. Dynamically doubles capacity ($2 \times \text{capacity}$) on full storage. $\mathcal{O}(\log N)$ amortized.
  - `heap_extract_max(heap, &priority)`: Removes root element (index 0), moves the last leaf to the root position, and sifts down via `heapify_down` comparing against larger child nodes. $\mathcal{O}(\log N)$.
  - `heap_peek_max(heap, &priority)`: Returns the maximum element at the root without extraction in $\mathcal{O}(1)$ time.
  - `heap_destroy(heap, free_data_fn)`: Frees the underlying contiguous array and optionally executes a caller-supplied cleanup callback on remaining payloads. $\mathcal{O}(N)$ payload cleanup, $\mathcal{O}(1)$ buffer deallocation.
- **Complexity:**
  - Insertion: $\mathcal{O}(\log N)$
  - Extraction: $\mathcal{O}(\log N)$
  - Peek Max: $\mathcal{O}(1)$
  - Space: $\mathcal{O}(N)$ contiguous dynamic array

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

### 3. Centrality-Weighted Lead Generation & Max-Heap Prioritization (`lead_generation.c`)
Synthesizes actionable next steps for investigators based on a multi-factor forensic heuristic:
$$\text{Strength Score} = \left((0.40 \times \text{Confidence}) + (0.30 \times \text{Normalized Centrality}) + (0.30 \times \text{Gap Factor})\right) \times 100$$
- **Centrality Nexus:** Nodes with $\text{deg}(v) \ge 2$ represent forensic crossroads connecting disparate evidence chains.
- **Critical Gap Resolution:** Identified evidence gaps with high or critical severity generate high-scoring resolution directives ($\text{Score} = 88.0$).
- **Max-Heap Pipeline Integration:** As candidate leads are synthesized, they are inserted directly into `leads_heap` in $\mathcal{O}(\log N)$ time. During finalization (`analysis_finalize_leads`), leads are extracted sequentially via `heap_extract_max()`. This guarantees that serialized JSON output (`prioritized_leads`), Node.js IPC responses, and the React investigation workspace display leads in strict descending priority order.
- Categorizes lead strength: `STRONG_CORROBORATION` ($\ge 75$), `MODERATE_LEAD` ($\ge 50$), or `PRELIMINARY_HYPOTHESIS` ($< 50$).

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
| **Binary Max-Heap** | Insertion (`heap_insert`) | $\mathcal{O}(\log N)$ | $\mathcal{O}(\log N)$ | $\mathcal{O}(N)$ | Dynamic lead priority queue insertion |
| **Binary Max-Heap** | Extract Max (`heap_extract_max`) | $\mathcal{O}(\log N)$ | $\mathcal{O}(\log N)$ | $\mathcal{O}(1)$ | Draining leads in strict descending urgency |
| **Binary Max-Heap** | Peek Max (`heap_peek_max`) | $\mathcal{O}(1)$ | $\mathcal{O}(1)$ | $\mathcal{O}(1)$ | Immediate query of highest-priority action item |
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
**Test Coverage:** 91 assertions verifying Hash Map separate chaining, load factor dynamic resizing, BST monotonicity, AVL balancing and rotations, BFS shortest paths, DFS components, cycle detection, gap identification, timeline anomaly flagging, and Array-Based Binary Max-Heap priority queue operations (empty safety, single/multiple elements, duplicate priorities, negative/zero priorities, dynamic resizing, repeated extraction, and payload cleanup).
