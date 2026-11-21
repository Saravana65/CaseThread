# Document G: Code-Level Explanation

> **Project:** CASETHREAD - Evidence Gap Detection and Investigation Support System  
> **Course:** Advanced Data Structures (ADS)  
> **Institution:** Geethanjali College of Engineering and Technology (GCET)

---

## 1. Hash Map (`core-engine/src/hashmap/hashmap.c`)
- **Hash Function (DJB2):** Computes `hash = ((hash << 5) + hash) + c` across string keys (evidence IDs, entity labels).
- **Collision Resolution:** Separate chaining using a singly-linked list (`hash_entry_t *next`) at each bucket.
- **Dynamic Resizing:** Evaluates load factor `(size + 1) / capacity`. When `alpha >= 0.75`, allocates double capacity, rehashes all existing entries, and frees the old bucket array.
- **Complexity:** Average $O(1)$ search, insert, and delete.

## 2. AVL Tree (`core-engine/src/trees/avl.c`)
- **Self-Balancing Mechanism:** Each node tracks height. Balance factor $BF = 	ext{height}(L) - 	ext{height}(R)$.
- **Rotations:** Executes Left-Left (Right Rotation), Right-Right (Left Rotation), Left-Right (LR Rotation), and Right-Left (RL Rotation) to guarantee $|BF| \le 1$.
- **Range Queries:** `avl_range_query(tree, t_start, t_end)` recursively traverses only overlapping subtrees in $O(\log N + K)$ time, extracting all events within a specific time window.
- **In-Order Traversal:** Recursively visits Left, Root, Right to emit a strictly sorted chronological event stream in $O(N)$.

## 3. Adjacency-List Graph (`core-engine/src/graphs/graph.c`)
- **Vertex Representation:** Dynamic array `graph_vertex_t *vertices` with dynamic capacity doubling via `realloc`.
- **Edge Representation:** Linked list of `graph_edge_t *edges_head` on each vertex containing target ID, relation type, confidence weight, and verification status.

## 4. Graph Traversals (`bfs.c` & `dfs.c`)
- **BFS Shortest Path:** Uses dynamic `queue_t` and `visited[]` array to explore level-by-level. Tracks predecessors in `parent[]` array to reconstruct the minimum-hop path between any two investigation entities in $O(V + E)$.
- **DFS Connected Components:** Recursively marks visited vertices, partitioning the graph into isolated components to discover disconnected criminal cells.
- **Three-Color Cycle Detection:** Classifies vertices as White (0, unvisited), Gray (1, in recursion stack), and Black (2, fully explored) to detect circular testimonial contradictions.

## 5. Binary Max-Heap (`core-engine/src/structures/max_heap.c`)
- **Array Layout:** Zero-indexed contiguous array where $	ext{Parent}(i) = \lfloor(i-1)/2floor$, $	ext{Left}(i) = 2i+1$, $	ext{Right}(i) = 2i+2$.
- **Heapify Up/Down:** Sifts elements to maintain the max-heap invariant ($P[	ext{parent}] \ge P[	ext{child}]$). Root always provides immediate $O(1)$ access to the highest-priority investigative lead.

## 6. 2D Spatial Quadtree (`core-engine/src/spatial/quadtree.c`)
- **Quadrant Decomposition:** Subdivides 2D coordinate space into NW, NE, SW, and SE quadrants when point threshold is exceeded.
- **Haversine Proximity Search:** Prunes quadrants whose bounding boxes do not intersect the search radius, evaluating great-circle distances in $O(\log N)$ average time.
