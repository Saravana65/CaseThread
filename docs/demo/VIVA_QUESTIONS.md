# CASETHREAD — TECHNICAL VIVA & ORAL DEFENSE GUIDE
## 35 Comprehensive Technical Questions & Verified Answers for ADS Evaluation

---

### Category 1: Graph Algorithms & Traversals

#### Q1: What is the fundamental difference between BFS and DFS in an evidence network?
**Answer:**
- **BFS (Breadth-First Search)** explores vertices level-by-level using a **FIFO Queue**. It evaluates all 1-hop associates before proceeding to 2-hop associates, guaranteeing the shortest path in unweighted graphs.
- **DFS (Depth-First Search)** explores as deeply as possible along each branch using a **LIFO Stack** (or recursion) before backtracking. It is optimal for topological sorting, cycle detection (e.g., circular alibi loops or financial round-tripping), and disjoint component analysis.

#### Q2: What graph representation is used in CaseThread's native C engine, and why?
**Answer:**
An **Adjacency List** (`EdgeNode** adj_list`). In an investigation network, graphs are typically **sparse** ($E \ll V^2$). An Adjacency List requires $\mathcal{O}(V + E)$ space compared to $\mathcal{O}(V^2)$ for an Adjacency Matrix, and allows iterating over incident edges in $\mathcal{O}(\text{deg}(v))$ time instead of $\mathcal{O}(V)$.

#### Q3: What is the exact Time and Space Complexity of BFS in CaseThread?
**Answer:**
- **Time Complexity:** $\mathcal{O}(V + E)$. Every vertex is enqueued and dequeued at most once ($\mathcal{O}(V)$), and every incident edge is traversed once in a directed graph ($\mathcal{O}(E)$).
- **Space Complexity:** $\mathcal{O}(V)$, required by the FIFO queue buffer (up to $V$ nodes in the worst case) and the `visited` / `parent` tracking arrays.

#### Q4: How does CaseThread compute the unweighted shortest path between two entities?
**Answer:**
During BFS traversal, the algorithm populates a predecessor array: `parent[v] = u` whenever edge $(u, v)$ discovers an unvisited vertex $v$. When target vertex $t$ is reached, the optimal path is reconstructed backwards in $\mathcal{O}(\text{path length})$ by following parent pointers from $t$ to source $s$.

#### Q5: How are Connected Components identified using the native C engine?
**Answer:**
The engine loops through all vertices $v \in V$. If $v$ is unvisited, it assigns a new `component_id` and initiates a DFS traversal, marking all reachable vertices with that ID. This partitions the graph into disjoint equivalence classes in $\mathcal{O}(V + E)$ total time.

#### Q6: How does CaseThread algorithmically define an "Evidence Gap"?
**Answer:**
An evidence gap is identified through graph topology:
1. **Isolated Nodes:** Vertices where in-degree + out-degree $= 0$.
2. **Disjoint Subgraphs:** Connected components that lack any recorded relationship to the central crime scene or prime suspect.
3. **Temporal Inconsistencies:** Timeline gaps exceeding configurable thresholds without recorded alibi or activity logs.

---

### Category 2: Hashing & Indexing

#### Q7: Which hash function is implemented in `core-engine/src/hashmap/hashmap.c`?
**Answer:**
Daniel J. Bernstein’s **DJB2** hash algorithm. It initializes `hash = 5381` and iteratively computes `hash = ((hash << 5) + hash) + c` for each character $c$ in the key string. It exhibits excellent bit dispersion and minimal clustering for ASCII strings.

#### Q8: How does CaseThread resolve hash collisions?
**Answer:**
Using **Separate Chaining**. Each table bucket points to a singly linked list (`HashEntry*`). When multiple keys produce the same hash index modulo capacity (`hash % capacity`), the new entry is appended to that bucket's linked list.

#### Q9: What are the average-case and worst-case time complexities of the HashMap?
**Answer:**
- **Average-Case:** $\mathcal{O}(1)$ for lookup, insertion, and deletion, assuming a uniform hash distribution and load factor $\alpha \le 0.75$.
- **Worst-Case:** $\mathcal{O}(N)$ if an adversarial or pathological dataset hashes all $N$ keys into a single bucket, degenerating into a linear linked list search.

#### Q10: How and when is the HashMap resized?
**Answer:**
The load factor is monitored: $\alpha = \frac{N}{\text{capacity}}$. When $\alpha > 0.75$, `hashmap_resize` allocates a new array with double the capacity ($2 \times \text{capacity}$), re-hashes all existing entries into the new buckets, and frees old bucket pointers.

---

### Category 3: Self-Balancing Trees & Heaps

#### Q11: What is the invariant of the AVL Tree implemented in `trees/avl.c`?
**Answer:**
For every node $u$, the balance factor is defined as:
$$\text{balance}(u) = \text{height}(\text{left}(u)) - \text{height}(\text{right}(u))$$
The tree strictly guarantees that $\text{balance}(u) \in \{-1, 0, 1\}$. If $|\text{balance}(u)| > 1$ after an insertion or deletion, rotation operations restore the invariant.

#### Q12: Name the four AVL rotation cases and when each is triggered.
**Answer:**
1. **Left-Left (LL):** Inserted into left subtree of left child. Fixed by a **Single Right Rotation**.
2. **Right-Right (RR):** Inserted into right subtree of right child. Fixed by a **Single Left Rotation**.
3. **Left-Right (LR):** Inserted into right subtree of left child. Fixed by **Left Rotation on left child, then Right Rotation on root**.
4. **Right-Left (RL):** Inserted into left subtree of right child. Fixed by **Right Rotation on right child, then Left Rotation on root**.

#### Q13: Why is an AVL Tree preferred over a standard Binary Search Tree (BST) for temporal logs?
**Answer:**
A standard BST degenerates into a skewed linked list of height $\mathcal{O}(N)$ if timestamps are inserted in sorted chronological order, causing searches to degrade to $\mathcal{O}(N)$. An AVL Tree guarantees a height bounded by $\approx 1.44 \log_2 N$, ensuring strictly $\mathcal{O}(\log N)$ worst-case lookups.

#### Q14: How is the Binary Max-Heap represented in memory in `structures/max_heap.c`?
**Answer:**
It is stored as a contiguous 1D array representing a **complete binary tree**. For an element at index $i$:
- Parent is at $\lfloor (i - 1) / 2 \rfloor$
- Left child is at $2i + 1$
- Right child is at $2i + 2$
This eliminates pointer overhead and maximizes CPU cache locality.

#### Q15: What is the time complexity of extracting the top investigative lead from the Max-Heap?
**Answer:**
$\mathcal{O}(\log N)$. Peeking the root is $\mathcal{O}(1)$. Extracting swaps the root with the last array element, decrements size, and calls `sift_down` to restore the heap property, taking at most $\log_2 N$ comparisons.

---

### Category 4: Specialized Data Structures

#### Q16: What is a Trie, and how is it structured in `structures/trie.c`?
**Answer:**
A **Trie (Prefix Tree)** is an $M$-ary tree where each node represents a character. CaseThread implements a 128-way ASCII retrieval tree (`children[128]`). Words sharing a common prefix share the same ancestor path, terminating with an `is_terminal` boolean flag.

#### Q17: What is the time complexity to search a prefix of length $P$ in the Trie?
**Answer:**
$\mathcal{O}(P)$ operations. Unlike a database table scan that depends on row count $N$, Trie prefix lookup depends solely on the length of the prefix $P$, making it ideal for instant evidence code autocomplete.

#### Q18: What is a Quadtree and why was it implemented in `spatial/quadtree.c`?
**Answer:**
A Quadtree is a 2D spatial partition tree where each internal node recursively decomposes space into four quadrants: North-West (NW), North-East (NE), South-West (SW), and South-East (SE). It allows $\mathcal{O}(\log N)$ range queries to find all physical evidence and CCTV cameras within a geographic incident perimeter.

---

### Category 5: Native C Integration & Architecture

#### Q19: How does the Node.js backend communicate with the compiled C engine?
**Answer:**
Via standard Inter-Process Communication (IPC) using **child process streams**:
1. Node.js spawns `casethread_engine.exe --stdin`.
2. Normalized investigation JSON streams into the process's standard input (`stdin`).
3. The C engine parses the JSON, constructs data structures, executes algorithms, and writes results to standard output (`stdout`).
4. Stderr is reserved for diagnostics and assertion logging.

#### Q20: Why execute algorithms in native C rather than directly in JavaScript?
**Answer:**
1. **Execution Speed & Determinism:** Compiled C has direct hardware execution with zero V8 JIT warm-up or garbage collection pauses.
2. **Pedagogical ADS Rigor:** Demonstrates manual pointer manipulation, memory allocation (`malloc`/`free`), custom queue/stack buffers, and algorithm correctness required by university PBL standards.
3. **Isolation:** The engine executes in an isolated sandbox child process, preventing engine crashes from taking down the backend server.

#### Q21: How are memory leaks prevented in the C engine during graph construction?
**Answer:**
Every dynamically allocated structure has an explicit recursive destruction function (e.g., `free_graph`, `free_hashmap`, `free_avl_tree`). Before the process terminates or upon completing an analysis cycle, all adjacency list nodes, bucket linked lists, and tree nodes are traversed and freed.

---

### Category 6: Forensics, Security & Cryptography

#### Q22: What role does SHA-256 play in the Evidence Vault?
**Answer:**
SHA-256 produces a unique 256-bit (64-character hexadecimal) cryptographic digest of the evidence content payload. If even a single byte or timestamp is modified after registration, the re-computed hash diverges, immediately flagging `TAMPERED_MISMATCH`.

#### Q23: How does the Chain-of-Custody state-chain prevent retroactive log tampering?
**Answer:**
Every custody transfer event incorporates a `previous_event_hash` and generates an updated `state_hash_sha256 = SHA256(event_id + previous_hash + timestamp + officer_id)`. Modifying or deleting an intermediate transfer record breaks the cryptographic chain of subsequent blocks.

#### Q24: What is CSV Formula Injection (DDE) and how does CaseThread prevent it?
**Answer:**
If an exported CSV contains fields starting with `=`, `+`, `-`, or `@`, spreadsheet applications (Excel, LibreOffice) may interpret the cell as an executable formula. CaseThread's `escapeCsvField` sanitizes every exported string:
```javascript
if (/^[=+\-@\t\r]/.test(str)) { str = "'" + str; }
```
Prefixing with `'` forces spreadsheet parsers to treat the field strictly as a text literal.

#### Q25: Why does PDF export use CSS `@media print` instead of external binary PDF generators?
**Answer:**
Using CSS Paged Media (`@page { margin: 1.6cm; size: A4; }` and `page-break-inside: avoid;`) produces vector-quality print outputs directly from the browser's native rendering engine. This eliminates heavy external server dependencies (like Headless Chrome or wkhtmltopdf) and prevents table clipping and font-embedding flaws.

---

### Category 7: Case Domain & Evidence-Gap Philosophy

#### Q26: Does CaseThread predict who is guilty?
**Answer:**
**Strictly NO.** CaseThread is an investigative support and evidence-gap detection system, not an automated crime-solving or predictive policing tool. It provides deterministic algorithmic aids (graph traversal, timeline reconstruction, gap detection) while leaving all legal conclusions to authorized human investigators.

#### Q27: Does a disconnected graph node automatically mean evidence was destroyed?
**Answer:**
No. A disconnected node simply indicates that no corroborating relationship has been documented between that item and the rest of the case network. It serves as an exploratory prompt for investigators (e.g., *"Why was this emergency key in the custodian closet?"*) rather than proof of criminal activity.

#### Q28: How are "Confirmed Facts" distinguished from "Unverified Observations"?
**Answer:**
Through the database column `relationship_nature` and `verification_status` ENUMs (`CONFIRMED_FACT`, `UNVERIFIED_OBSERVATION`, `HYPOTHESIS`). Physical evidence and electronic logs are confirmed facts; witness testimonies or anonymous tips remain unverified observations with adjusted confidence weights.

#### Q29: What happens when two timeline events contradict each other?
**Answer:**
The Timeline Analysis engine evaluates Rule A–F contradiction rules (e.g., Rule A: Impossible travel velocity between two timestamped locations; Rule B: Contradictory physical location claims). Discrepancies are flagged in the UI with precision tags (`EXACT_SEC`, `MINUTE_ESTIMATE`) and highlighted in red on the generated timeline report.

#### Q30: How does the campus demonstration case demonstrate an evidence gap?
**Answer:**
In `CASE-DEMO-2026-CAMPUS`, items E001 through E006 form a verified connected path from Devon Kross to the stolen laptop. Item `EVD-CAMPUS-007` (Emergency Mechanical Override Key) has degree 0. Connected Component analysis isolates E007 as a separate component, prompting detectives to investigate who displaced the key.

---

### Category 8: Advanced Viva Defense

#### Q31: What is the difference between Dijkstra’s algorithm and BFS for shortest path?
**Answer:**
- BFS finds the shortest path by **edge count** (hop count) in unweighted graphs in $\mathcal{O}(V + E)$ time.
- Dijkstra's algorithm finds the shortest path in **weighted graphs** with non-negative edge weights using a Min-Priority Queue in $\mathcal{O}((V + E) \log V)$ time.

#### Q32: Could an Adjacency Matrix be faster than an Adjacency List for edge queries?
**Answer:**
Yes. Checking whether edge $(u, v)$ exists takes $\mathcal{O}(1)$ time in an Adjacency Matrix (`matrix[u][v] == 1`), compared to $\mathcal{O}(\text{deg}(u))$ in an Adjacency List. However, iterating through all neighbors takes $\mathcal{O}(V)$ in a matrix versus $\mathcal{O}(\text{deg}(u))$ in a list, making Adjacency Lists far superior for sparse graph traversals like BFS/DFS.

#### Q33: How does the system handle database migrations or seed resetting during viva?
**Answer:**
Via isolated, idempotent scripts (`scripts/seed_demo_case.js` and `scripts/reset_demo_case.js`). The seeder targets only case number `CASE-DEMO-2026-CAMPUS`, deleting old test artifacts and recreating the exact 7-evidence dataset without affecting any other database records.

#### Q34: What is the space overhead of a complete binary tree in a Max-Heap?
**Answer:**
Zero pointer overhead. Unlike binary search trees that require two 8-byte child pointers per node, an array-based Max-Heap stores elements contiguously. Array indices implicitly encode the tree structure.

#### Q35: If the C engine executable is deleted, how does the application handle it?
**Answer:**
`cEngineService.js` performs readiness checks (`checkEngineReadiness`). If the binary is missing, it catches the error gracefully, returns HTTP 503 Service Unavailable with a clear diagnostic message indicating the engine must be compiled via `build.bat` or `Makefile`, preventing unhandled backend crashes.
