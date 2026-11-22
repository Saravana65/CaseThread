# CASETHREAD — ADS ALGORITHM SHOWCASE
## Verified Native C Data Structures & Algorithms

This document provides a comprehensive technical breakdown of all Data Structures and Algorithms genuinely implemented in the native C engine (`core-engine/`).

---

## Algorithm Catalog Overview

| Algorithm | Data Structure | Source File | Time Complexity | Space Complexity | Practical CaseThread Application |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Breadth-First Search (BFS)** | FIFO Queue + Adjacency List | `graphs/bfs.c` | $O(V + E)$ | $O(V)$ | Level-by-level contact discovery, unweighted shortest hop path |
| **Depth-First Search (DFS)** | LIFO Stack + Adjacency List | `graphs/dfs.c` | $O(V + E)$ | $O(V)$ | Deep branch investigation, cyclical transaction and accomplice tracing |
| **Connected Components** | Disjoint Graph Traversal (DFS) | `graphs/graph.c` | $O(V + E)$ | $O(V)$ | Partitioning disconnected evidence clusters & detecting isolated evidence |
| **Shortest Path** | BFS with Parent Array | `graphs/bfs.c` | $O(V + E)$ | $O(V)$ | Direct evidentiary provenance chain between suspect and crime scene |
| **Separate Chaining Hash Map** | Array of Linked Buckets (DJB2) | `hashmap/hashmap.c` | $O(1)$ avg, $O(N)$ worst | $O(\text{Cap} + N)$ | Instant $O(1)$ lookup of evidence tracking barcodes and device MACs |
| **Forensic Prefix Tree (Trie)** | 128-Way ASCII Retrieval Tree | `structures/trie.c` | $O(L)$ search/insert | $O(\Sigma \cdot L \cdot N)$ | Prefix autocomplete for docket numbers, badge IDs, and evidence codes |
| **Self-Balancing AVL Tree** | Height-Balanced BST | `trees/avl.c` | $O(\log N)$ guaranteed | $O(N)$ | Chronological incident indexing and spatiotemporal velocity contradictions |
| **Binary Max-Heap** | Contiguous Complete Binary Tree | `structures/max_heap.c`| $O(\log N)$ extract, $O(1)$ peek | $O(N)$ | Prioritizing high-confidence investigative leads for detective assignment |
| **Quadtree 2D Spatial Index** | 4-Quadrant Recursive Spatial Tree | `spatial/quadtree.c` | $O(\log N)$ avg | $O(N)$ | Perimeter bounding-box queries for CCTV and physical evidence discovery |

---

## 1. Breadth-First Search (BFS) & Shortest Path

### 1.1. Data Structure & Theory
Breadth-First Search visits vertices in strictly increasing order of their distance from the source vertex $s$. It utilizes a **First-In, First-Out (FIFO) Queue** and an in-memory **Adjacency List**.

```
Adjacency List:
Node 0 (Devon Kross)     -> [ Node 16 (EVD-CAMPUS-001) ]
Node 16 (EVD-CAMPUS-001) -> [ Node 17 (CCTV), Node 21 (Wi-Fi) ]
Node 17 (EVD-CAMPUS-002) -> [ Node 18 (Witness Elena) ]
Node 21 (EVD-CAMPUS-006) -> [ Node 19 (Laptop E004) ]
```

### 1.2. Pseudocode
```c
void bfs(Graph* graph, int start_node, int* visited, int* parent) {
    Queue* q = create_queue(graph->num_vertices);
    visited[start_node] = 1;
    parent[start_node] = -1;
    enqueue(q, start_node);

    while (!is_queue_empty(q)) {
        int u = dequeue(q);
        record_trace_step("QUEUE_DEQUEUE", u);

        EdgeNode* edge = graph->adj_list[u];
        while (edge != NULL) {
            int v = edge->target;
            if (!visited[v]) {
                visited[v] = 1;
                parent[v] = u;
                enqueue(q, v);
                record_trace_step("QUEUE_ENQUEUE", v);
            }
            edge = edge->next;
        }
    }
}
```

### 1.3. Complexity Analysis
- **Time Complexity:** Every vertex is enqueued and dequeued at most once: $O(V)$. For each dequeued vertex, all incident edges in its adjacency list are examined: $\sum \text{deg}(v) = 2E$ (or $E$ for directed graphs). Total Time: $\mathcal{O}(V + E)$.
- **Space Complexity:** The FIFO queue holds at most $V$ vertices. The `visited` and `parent` arrays require $V$ slots each. Total Space: $\mathcal{O}(V)$.

### 1.4. Application in CaseThread
When investigating Devon Kross (`Node 0`), BFS immediately identifies 1-hop connections (RFID access scan at 21:42), followed by 2-hop connections (corridor CCTV camera and Wi-Fi disconnect), establishing a verifiable path to the stolen laptop in minimum evidentiary hops.

---

## 2. Depth-First Search (DFS) & Cycle Detection

### 2.1. Data Structure & Theory
DFS explores as deeply as possible along each branch before backtracking. It is implemented in C using an explicit **LIFO Call Stack** or recursion.

### 2.2. Pseudocode
```c
void dfs_visit(Graph* graph, int u, int* visited, int* on_stack) {
    visited[u] = 1;
    on_stack[u] = 1;
    record_trace_step("STACK_PUSH", u);

    EdgeNode* edge = graph->adj_list[u];
    while (edge != NULL) {
        int v = edge->target;
        if (!visited[v]) {
            dfs_visit(graph, v, visited, on_stack);
        } else if (on_stack[v]) {
            record_cycle_detected(u, v); // Cycle found (e.g., circular alibi)
        }
        edge = edge->next;
    }

    on_stack[u] = 0;
    record_trace_step("STACK_POP", u); // Backtracking
}
```

### 2.3. Complexity Analysis
- **Time Complexity:** $\mathcal{O}(V + E)$ — Visits each vertex and traverses each edge exactly once.
- **Space Complexity:** $\mathcal{O}(V)$ — Stack depth bounded by $V$ in the worst case (a linear path graph).

---

## 3. Connected Components & Evidence Gap Detection

### 3.1. Theoretical Principle
In an evidence network $G = (V, E)$, a connected component is a maximal subgraph in which any two vertices are connected to each other by paths. 

```
Component 1 (Incident Chain): 
[Devon Kross] <--> [E001 Access Log] <--> [E002 CCTV] <--> [E003 Witness]
                             \
                              +--> [E006 Wi-Fi] <--> [E004 Laptop]

Component 2 (Isolated Gap):
[E007 Emergency Mechanical Override Key] (Degree = 0)
```

### 3.2. Evidence Gap Logic
1. The engine computes the degree $\text{deg}(v) = \text{in-degree}(v) + \text{out-degree}(v)$ for every vertex $v \in V$.
2. Any vertex with $\text{deg}(v) = 0$ is flagged as an **Isolated Evidentiary Island**.
3. In our campus demonstration case, `E007` (Emergency Override Key) was found displaced in Custodian Closet #2, but has no recorded relationship connecting it to Devon Kross, Dr. Vance, or the laptop. The C engine detects this component boundary in $O(V + E)$ time and flags it as a priority gap for fingerprint lifting.

---

## 4. Daniel J. Bernstein Hash Map (DJB2)

### 4.1. Implementation
Located in `core-engine/src/hashmap/hashmap.c`. Implements separate chaining with singly linked lists.

```c
unsigned long djb2_hash(const char *str) {
    unsigned long hash = 5381;
    int c;
    while ((c = *str++)) {
        hash = ((hash << 5) + hash) + c; /* hash * 33 + c */
    }
    return hash;
}
```

### 4.2. Performance Characteristics
- **Average Lookup:** $\mathcal{O}(1)$ time.
- **Worst-Case Lookup:** $\mathcal{O}(N)$ if all keys hash to the same bucket.
- **Load Factor Control:** The table automatically resizes (doubling bucket count) when the load factor $\alpha = \frac{N}{\text{capacity}} > 0.75$.

---

## 5. Self-Balancing AVL Tree

### 5.1. Invariant & Rotations
Located in `core-engine/src/trees/avl.c`. Enforces the balance factor:
$$\text{balance}(u) = \text{height}(\text{left}(u)) - \text{height}(\text{right}(u)) \in \{-1, 0, 1\}$$

When an insertion violates the invariant ($|\text{balance}| > 1$), four deterministic rotations restore balance in $\mathcal{O}(1)$ pointer operations:
1. **Left-Left (LL):** Single Right Rotation.
2. **Right-Right (RR):** Single Left Rotation.
3. **Left-Right (LR):** Left rotation on child, followed by Right rotation on root.
4. **Right-Left (RL):** Right rotation on child, followed by Left rotation on root.

### 5.2. Chronological & Velocity Anomaly Detection
Timestamps are inserted into the AVL tree with epoch values as keys. A range query $[\tau_1, \tau_2]$ executes in $\mathcal{O}(\log N + K)$ time, where $K$ is the number of events in the range. If an individual is recorded at Location A at $\tau_1$ and Location B at $\tau_2$, the system evaluates velocity $v = \frac{\text{distance}(A, B)}{\tau_2 - \tau_1}$. If $v > v_{\text{max}}$, a spatiotemporal contradiction is flagged.

---

## 6. Binary Max-Heap Priority Queue

### 6.1. Array-Based Complete Binary Tree
Located in `core-engine/src/structures/max_heap.c`. Stored contiguously in a dynamic array where for element at index $i$:
- $\text{Parent}(i) = \lfloor \frac{i - 1}{2} \rfloor$
- $\text{LeftChild}(i) = 2i + 1$
- $\text{RightChild}(i) = 2i + 2$

### 6.2. Complexity
- **Peek Max:** $\mathcal{O}(1)$ time (returns `array[0]`).
- **Insert (Sift-Up):** $\mathcal{O}(\log N)$ time.
- **Extract-Max (Sift-Down):** $\mathcal{O}(\log N)$ time.
- **Space:** $\mathcal{O}(N)$ contiguous memory.
