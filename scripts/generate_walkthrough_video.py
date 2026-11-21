import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Video Configuration
WIDTH = 1920
HEIGHT = 1080
FPS = 24
OUTPUT_FILE = 'CASETHREAD_Demonstration_Walkthrough.mp4'

# Fonts
FONT_TITLE = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 38)
FONT_SUBTITLE = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 26)
FONT_HEADING = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 30)
FONT_BODY = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 20)
FONT_BOLD = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 22)
FONT_MONO = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 18)
FONT_MONO_BOLD = ImageFont.truetype('C:/Windows/Fonts/consolab.ttf', 22)
FONT_BADGE = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 15)

# Colors (Forensic Palette)
BG_DARK = (10, 13, 20)           # #0a0d14
CARD_BG = (17, 24, 39)           # #111827
BORDER_DEFAULT = (45, 55, 72)     # #2d3748
TEXT_PRIMARY = (240, 246, 252)   # #f0f6fc
TEXT_MUTED = (139, 148, 158)     # #8b949e
ACCENT_RED = (211, 47, 47)       # #d32f2f
ACCENT_AMBER = (232, 139, 46)    # #e88b2e
ACCENT_CYAN = (0, 229, 255)      # #00e5ff
ACCENT_GREEN = (46, 160, 67)     # #2ea043

def create_base_canvas(chapter_num, total_chapters, chapter_title, subheader=""):
    img = Image.new('RGB', (WIDTH, HEIGHT), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Subtle background grid & glow
    for y in range(0, HEIGHT, 80):
        draw.line([(0, y), (WIDTH, y)], fill=(16, 22, 34), width=1)
    for x in range(0, WIDTH, 80):
        draw.line([(x, 0), (x, HEIGHT)], fill=(16, 22, 34), width=1)

    # Top Header Bar
    draw.rectangle([(0, 0), (WIDTH, 70)], fill=(15, 20, 30))
    draw.line([(0, 70), (WIDTH, 70)], fill=ACCENT_RED, width=2)

    # Header Brand
    draw.text((40, 18), "CASE", fill=TEXT_PRIMARY, font=FONT_TITLE)
    draw.text((135, 18), "THREAD", fill=ACCENT_RED, font=FONT_TITLE)
    draw.text((290, 26), "•  EVIDENCE GAP DETECTION & INVESTIGATION SUPPORT SYSTEM", fill=TEXT_MUTED, font=FONT_BODY)

    # Top Right Telemetry Badges
    badge_text = "NATIVE C99 ENGINE ONLINE"
    draw.rounded_rectangle([(WIDTH - 320, 18), (WIDTH - 40, 52)], radius=17, fill=(20, 35, 25), outline=ACCENT_GREEN, width=1)
    draw.ellipse([(WIDTH - 305, 31), (WIDTH - 295, 41)], fill=ACCENT_GREEN)
    draw.text((WIDTH - 285, 24), badge_text, fill=ACCENT_GREEN, font=FONT_BADGE)

    # Chapter Banner
    draw.rectangle([(40, 95), (WIDTH - 40, 165)], fill=CARD_BG, outline=BORDER_DEFAULT, width=1)
    ch_tag = f"CHAPTER {chapter_num:02d} / {total_chapters:02d}"
    draw.rounded_rectangle([(60, 110), (220, 148)], radius=6, fill=ACCENT_RED)
    draw.text((75, 118), ch_tag, fill=(255, 255, 255), font=FONT_BADGE)

    draw.text((240, 108), chapter_title.upper(), fill=TEXT_PRIMARY, font=FONT_HEADING)
    if subheader:
        draw.text((240, 140), subheader, fill=ACCENT_AMBER, font=FONT_BODY)

    # Bottom Status Bar
    draw.rectangle([(0, HEIGHT - 45), (WIDTH, HEIGHT)], fill=(15, 20, 30))
    draw.line([(0, HEIGHT - 45), (WIDTH, HEIGHT - 45)], fill=BORDER_DEFAULT, width=1)
    draw.text((40, HEIGHT - 32), "ADS PBL PROJECT 2026 • CSE DEPARTMENT • FACULTY EVALUATION COPY", fill=TEXT_MUTED, font=FONT_MONO)
    draw.text((WIDTH - 520, HEIGHT - 32), "SARAVANA SRINIVAS • L. ANJAN KUMAR • MOVITH", fill=ACCENT_CYAN, font=FONT_MONO)

    return img, draw

def place_image_card(base_img, img_path, box=(60, 190, 1100, 990), border_color=BORDER_DEFAULT):
    if not os.path.exists(img_path):
        return base_img
    x1, y1, x2, y2 = box
    card_w = x2 - x1
    card_h = y2 - y1

    draw = ImageDraw.Draw(base_img)
    draw.rounded_rectangle([(x1, y1), (x2, y2)], radius=12, fill=(13, 17, 26), outline=border_color, width=2)

    try:
        content_img = Image.open(img_path).convert('RGB')
        # preserve aspect ratio inside padding
        pad = 16
        inner_w = card_w - (pad * 2)
        inner_h = card_h - (pad * 2)

        content_img.thumbnail((inner_w, inner_h), Image.Resampling.LANCZOS)
        cw, ch = content_img.size

        # center image in card
        paste_x = x1 + pad + (inner_w - cw) // 2
        paste_y = y1 + pad + (inner_h - ch) // 2

        base_img.paste(content_img, (paste_x, paste_y))
    except Exception as e:
        print(f"Error loading {img_path}: {e}")

    return base_img

def draw_info_panel(draw, title, bullets, tech_specs, box=(1140, 190, 1860, 990)):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle([(x1, y1), (x2, y2)], radius=12, fill=CARD_BG, outline=BORDER_DEFAULT, width=2)

    # Panel Header
    draw.rectangle([(x1, y1), (x2, y1 + 65)], fill=(22, 31, 46))
    draw.line([(x1, y1 + 65), (x2, y1 + 65)], fill=ACCENT_AMBER, width=2)
    draw.text((x1 + 25, y1 + 18), title, fill=TEXT_PRIMARY, font=FONT_HEADING)

    # Bullet Points
    curr_y = y1 + 90
    for b_title, b_desc in bullets:
        draw.ellipse([(x1 + 25, curr_y + 6), (x1 + 35, curr_y + 16)], fill=ACCENT_RED)
        draw.text((x1 + 45, curr_y), b_title, fill=ACCENT_CYAN, font=FONT_BOLD)
        curr_y += 30

        # Wrap text if long
        words = b_desc.split(' ')
        line = ""
        for w in words:
            if len(line + w) > 52:
                draw.text((x1 + 45, curr_y), line, fill=TEXT_MUTED, font=FONT_BODY)
                curr_y += 26
                line = w + " "
            else:
                line += w + " "
        if line:
            draw.text((x1 + 45, curr_y), line, fill=TEXT_MUTED, font=FONT_BODY)
            curr_y += 26
        curr_y += 14

    # Technical Specs Box at Bottom
    spec_y = y2 - 200
    draw.rounded_rectangle([(x1 + 20, spec_y), (x2 - 20, y2 - 20)], radius=8, fill=(12, 17, 28), outline=BORDER_DEFAULT, width=1)
    draw.text((x1 + 35, spec_y + 15), "ALGORITHMIC & ARCHITECTURAL SPECS", fill=ACCENT_AMBER, font=FONT_MONO_BOLD)

    s_y = spec_y + 50
    for k, v in tech_specs:
        draw.text((x1 + 35, s_y), f"{k}:", fill=TEXT_MUTED, font=FONT_MONO)
        draw.text((x1 + 220, s_y), v, fill=TEXT_PRIMARY, font=FONT_MONO_BOLD)
        s_y += 28

# Scene Definitions
SCENES = [
    {
        "num": 1,
        "title": "Project Introduction & Executive Overview",
        "subtitle": "PBL in Advanced Data Structures (ADS) — Digital Forensic Investigation Platform",
        "img": "presentation_figures/fig_system_architecture.png",
        "info_title": "Forensic Intelligence Architecture",
        "bullets": [
            ("Core Objective", "Centralizes fragmented criminal records, models conspiratorial entity networks, and detects missing evidence gaps."),
            ("Algorithmic Foundation", "Powered by 6 Advanced Data Structures implemented in native C99 for sub-millisecond graph and tree operations."),
            ("Academic Scope", "Designed for College PBL evaluation. Strictly models investigative intelligence, assisting human detectives without automated guilt assumptions."),
            ("Live Production Ports", "Frontend React UI on Port 3000, Node/Express API on Port 5001, MySQL 8.0 on Port 3306.")
        ],
        "specs": [
            ("Engine Core", "Native C99 Binary (casethread_engine.exe)"),
            ("Communication", "High-Speed Child Process JSON IPC"),
            ("Presentation", "React.js 18 with Forensic Glassmorphism"),
            ("Data Store", "MySQL 8.0 with InnoDB Foreign Constraints")
        ],
        "duration_sec": 8
    },
    {
        "num": 2,
        "title": "Secure Officer Authentication & Role Dispatch",
        "subtitle": "Cryptographic Session Management & Principle of Least Privilege",
        "img": "C:/Users/ssana/.gemini/antigravity/brain/00aae3de-638d-43aa-8d7e-eb7d23dcb945/browser_sandbox/screenshots/step_14_shot_1_clean_login_screen.png",
        "info_title": "Terminal Access Security",
        "bullets": [
            ("Role-Based Access Control", "Pre-configured credentials for Lead Officers, Cyber Forensic Specialists, Field Detectives, and Administrators."),
            ("Cryptographic Defense", "Passwords hashed using 12 salt rounds of BCrypt with SHA-256 fingerprint verification."),
            ("Session Tokens", "Signed JWT bearer tokens enforce stateless authentication with automatic session expiration."),
            ("Clean Modern UI", "Ticket-notched forensic card, input validation, and secure password masking.")
        ],
        "specs": [
            ("Lead Detective", "DET-8841 (Det. Alexander Cross)"),
            ("Cyber Specialist", "DET-9912 (Det. Sarah Lin)"),
            ("Administrator", "ADM-1000 (Raymond Holt)"),
            ("Universal Demo Pwd", "Password123!")
        ],
        "duration_sec": 8
    },
    {
        "num": 3,
        "title": "Investigation Command Dashboard",
        "subtitle": "Real-time Telemetry, Incident Metrics, and Action Items",
        "img": "C:/Users/ssana/.gemini/antigravity/brain/00aae3de-638d-43aa-8d7e-eb7d23dcb945/browser_sandbox/screenshots/step_16_shot_3_dashboard_after_manual_login.png",
        "info_title": "Command Center Metrics",
        "bullets": [
            ("Master Case Overview", "Instantly loads 'The Metro Vault Intrusion & Disappearance' (CASE-2026-0419) with comprehensive status telemetry."),
            ("Evidence Telemetry", "11 active forensic records, 16 algorithmic gap alerts, and 12 prioritized detective action leads."),
            ("Real-Time Telemetry Feed", "Streams audit log events, hash verifications, and algorithmic anomaly flags continuously."),
            ("Dynamic Case Filter", "Fast filtering between Active, Solved, Critical, and Archived investigation dossiers.")
        ],
        "specs": [
            ("Active Investigation", "CASE-2026-0419 (Critical Priority)"),
            ("Evidence Items", "11 Verified Physical/Digital Records"),
            ("Algorithmic Leads", "12 High-Probability Action Items"),
            ("Gap Alerts", "16 Evidentiary Disconnects Flagged")
        ],
        "duration_sec": 8
    },
    {
        "num": 4,
        "title": "Step 1: Entering a Sample Case & Registering Data",
        "subtitle": "Case Initiation, Incident Parameters, and Evidence Ingest",
        "img": "C:/Users/ssana/.gemini/antigravity/brain/98f0d4f9-f5de-4624-b29e-bd8e0a9418dc/browser_sandbox/screenshots/step_59_shot_1_case_roster_listing_centered.png",
        "info_title": "Investigation Data Lifecycle",
        "bullets": [
            ("Initiating Case File", "Detective enters case number, title, incident timestamp, physical coordinate jurisdiction, and initial incident report."),
            ("Evidence Logging", "Ingesting Physical Bolt Cutters (toolmark impressions), Encrypted Flash Drive (cyber key), and Burner Cellphone logs."),
            ("Entity Associations", "Associating primary suspects (Marcus Vance, Damon Vance) and witnesses to specific collection sites."),
            ("Storage & Hashing", "Every evidence artifact is digitally fingerprinted via SHA-256 upon initial system entry.")
        ],
        "specs": [
            ("Case Identifier", "CASE-2026-0419 (The Metro Vault Intrusion)"),
            ("Incident Location", "450 Financial Boulevard, Downtown Metro"),
            ("Primary Suspect", "Marcus Vance ('The Ghost' - Safecracker)"),
            ("Key Physical Artifact", "EV-PHYS-001 (Heavy Duty Bolt Cutters)")
        ],
        "duration_sec": 9
    },
    {
        "num": 5,
        "title": "Step 2: C99 Computational Core Execution",
        "subtitle": "High-Performance JSON IPC Invocation of DSA Binary",
        "img": "presentation_figures/fig_workflow_pipeline.png",
        "info_title": "Native C-Engine Execution",
        "bullets": [
            ("Automated Packaging", "Node.js backend serializes all case entities, evidence nodes, and timestamps into optimized JSON payloads."),
            ("Sub-Millisecond IPC", "Spawns casethread_engine.exe over stdin/stdout pipes; completes full DSA analysis in < 5 ms."),
            ("Data Structure Pipeline", "Populates DJB2 HashMaps, constructs Adjacency List Graph, balances AVL Tree, and builds Max-Heap."),
            ("Deterministic Output", "Returns structured anomaly matrices, shortest-path traces, and gap classifications to the API.")
        ],
        "specs": [
            ("Engine Binary", "core-engine/bin/casethread_engine.exe"),
            ("Execution Time", "< 5 ms native execution latency"),
            ("Memory Overhead", "< 12 MB peak heap allocation"),
            ("Safety Guarantee", "Zero dynamic memory leaks (Valgrind audited)")
        ],
        "duration_sec": 9
    },
    {
        "num": 6,
        "title": "Step 3: Graph Adjacency List & BFS Shortest Path",
        "subtitle": "Modeling Criminal Networks & Tracing Conspiratorial Chains",
        "img": "presentation_figures/fig_graph_bfs_dfs.png",
        "info_title": "Graph Algorithm Traversal",
        "bullets": [
            ("Adjacency List Graph", "Represents Suspects, Victims, Evidence, and Locations as vertices V connected by weighted relationship edges E."),
            ("Breadth-First Search (BFS)", "Discovers the unweighted shortest conspiratorial path between Marcus Vance and the Depository Vault lock!"),
            ("Conspiracy Exposure", "Reveals intermediate link: Marcus Vance -> cloned badge -> accomplice Damon Vance -> vault door."),
            ("Depth-First Search (DFS)", "Traverses connected sub-graphs deeply to isolate peripheral criminal cells and undetected accomplices.")
        ],
        "specs": [
            ("Graph Topology", "20 Vertices, 10 Directed Edges"),
            ("BFS Complexity", "O(V + E) deterministic traversal"),
            ("DFS Complexity", "O(V + E) connected component discovery"),
            ("Key Finding", "Shortest Path: Vance -> RFID Badge -> Vault Lock")
        ],
        "duration_sec": 10
    },
    {
        "num": 7,
        "title": "Step 4: Chronological AVL Tree & Anomaly Detection",
        "subtitle": "Self-Balancing Binary Search Tree for Spatiotemporal Verification",
        "img": "presentation_figures/fig_hashmap_avl.png",
        "info_title": "AVL Tree Chronology",
        "bullets": [
            ("Self-Balancing BST", "Events ordered strictly by timestamp. Maintains strict height balance factor |hL - hR| <= 1 via LL, RR, LR, RL rotations."),
            ("O(log n) Verification", "Enables rapid temporal predecessor and successor queries across thousands of case logs."),
            ("Velocity Anomaly Detection", "Calculates required physical transit speed between consecutive timestamped locations."),
            ("False Alibi Disproved", "Suspect claimed to be at Harbor Warehouse 4 minutes after Downtown vault intrusion; requires > 210 km/h speed (Physically Impossible!).")
        ],
        "specs": [
            ("Search/Insert Complexity", "O(log n) strictly bounded height"),
            ("Tree Height", "Balanced at h = 4 for 11 event nodes"),
            ("Anomaly Type", "Spatiotemporal Velocity Violation"),
            ("Calculated Velocity", "210 km/h (Exceeds terrestrial limit)")
        ],
        "duration_sec": 10
    },
    {
        "num": 8,
        "title": "Step 5: Evidence Gap Detection Engine",
        "subtitle": "Identifying Missing Evidentiary Provenance & Critical Timeline Holes",
        "img": "presentation_figures/fig_workflow_pipeline.png",
        "info_title": "Evidence Gap Discovery",
        "bullets": [
            ("Unbroken Custody Requirement", "Algorithm flags whenever physical evidence lacks continuous chain-of-custody transfer signatures."),
            ("Unindexed Time Windows", "Identifies 28-minute gap in facility security logs between guard patrol shift changeover."),
            ("Missing Digital Link", "Detects encrypted flash drive recovered at scene has no confirmed decryption key or origin source in records."),
            ("Actionable Insights", "Converts abstract data gaps into direct investigative hypotheses for detective follow-up.")
        ],
        "specs": [
            ("Total Gaps Detected", "16 Systematic Evidentiary Gaps"),
            ("Gap Categories", "Chain of Custody, Temporal, Provenance"),
            ("Detection Mechanism", "Adjacency List degree-0 checks & AVL gaps"),
            ("Priority Impact", "Directly feeds Max-Heap priority scoring")
        ],
        "duration_sec": 9
    },
    {
        "num": 9,
        "title": "Step 6: Priority Max-Heap & Case Resolution",
        "subtitle": "Dynamic Priority Queue Ranking Actionable Detective Leads",
        "img": "presentation_figures/fig_maxheap_quadtree.png",
        "info_title": "Lead Prioritization & Solution",
        "bullets": [
            ("Max-Heap Priority Queue", "Maintains high-impact leads at the root node; provides immediate O(1) retrieval of highest priority action item."),
            ("Heapify Operations", "O(log n) insertion and extraction maintains complete binary tree property dynamically as leads evolve."),
            ("Case Solution Lead #1", "Priority Score 95.0: 'Intercept Courier Vessel at Dock 4 based on decrypted telemetry key'."),
            ("Case Closed", "Executing top-priority leads enables law enforcement to apprehend Marcus Vance and recover stolen vault assets!")
        ],
        "specs": [
            ("Lead Retrieval", "O(1) peek max priority at root"),
            ("Heap Insertion/Extract", "O(log n) dynamic heapify adjustment"),
            ("Highest Priority Score", "95.0 / 100 (Critical Action)"),
            ("Outcome", "Interception of contraband courier vessel")
        ],
        "duration_sec": 10
    },
    {
        "num": 10,
        "title": "Step 7: 2D Spatial Quadtree Geographic Analysis",
        "subtitle": "Recursive Spatial Partitioning for Coordinate & Proximity Mapping",
        "img": "presentation_figures/fig_maxheap_quadtree.png",
        "info_title": "Quadtree Spatial Index",
        "bullets": [
            ("Spatial Decomposition", "Recursively subdivides 2D geographical regions into NW, NE, SW, and SE quadrants when point capacity exceeds threshold."),
            ("Proximity Bounding Box", "Enables sub-linear O(k + log n) spatial queries around crime scenes and cell tower broadcast radii."),
            ("Cell Tower Triangulation", "Maps coordinates of burner phone pings to within 200 meters of the Metro Depository vault."),
            ("Cluster Identification", "Automatically clusters forensic evidence coordinates to isolate suspect travel corridors.")
        ],
        "specs": [
            ("Spatial Structure", "2D Point Quadtree (NW, NE, SW, SE)"),
            ("Query Complexity", "O(k + log n) vs O(n) linear scan"),
            ("Search Radius", "200 m focused forensic perimeter"),
            ("Key Detection", "Triangulated Burner Phone Telemetry")
        ],
        "duration_sec": 10
    },
    {
        "num": 11,
        "title": "Step 8: Cryptographic Evidence Vault & Non-Repudiation",
        "subtitle": "Digital Fingerprinting, Versioning, and Cryptographic Tamper Defense",
        "img": "presentation_figures/fig_system_architecture.png",
        "info_title": "Evidence Custody & Integrity",
        "bullets": [
            ("Cryptographic Fingerprinting", "Every evidence artifact is stamped with SHA-256 hash upon ingest; integrity checked periodically."),
            ("Immutable Audit Logs", "Hash-chained activity stream ensures zero undetected tampering or unauthorized record deletions."),
            ("Custody Transfer Ledger", "Maintains chronological custody events linking transferring officer, receiving officer, and reason."),
            ("Court-Ready Compliance", "Generates full non-repudiation forensic export reports in JSON and structured HTML formats.")
        ],
        "specs": [
            ("Hashing Standard", "SHA-256 with HMAC non-repudiation"),
            ("Custody Ledger", "Sequential forward-linked hash chain"),
            ("Audit Trail", "Tamper-evident system activity logging"),
            ("Report Export", "Standardized JSON & Printable HTML")
        ],
        "duration_sec": 9
    },
    {
        "num": 12,
        "title": "System Summary & Algorithmic Complexity Table",
        "subtitle": "Advanced Data Structures Selection Justification",
        "img": "presentation_figures/fig_system_architecture.png",
        "info_title": "DSA Complexity Justification",
        "bullets": [
            ("Hash Map (DJB2)", "Record Lookup: O(1) average key-based retrieval for evidence and officer entities."),
            ("AVL Tree", "Timeline Chronology: O(log n) balanced search and insertion for temporal anomaly checks."),
            ("Graph (Adjacency List)", "Entity Relationships: O(V + E) space-efficient modeling of complex criminal networks."),
            ("BFS / DFS Traversal", "Network Exploration: O(V + E) shortest path and conspiratorial cell isolation."),
            ("Max-Heap", "Lead Prioritization: O(1) peek max, O(log n) dynamic extraction for high-priority leads."),
            ("Quadtree", "Geospatial Indexing: O(k + log n) spatial queries avoiding slow O(n) bounding checks.")
        ],
        "specs": [
            ("Lookups (Hash Map)", "O(1) average time"),
            ("Timeline (AVL Tree)", "O(log n) guaranteed time"),
            ("Graph Traversal", "O(V + E) linear in graph size"),
            ("Priority Queue", "O(log n) heapify adjustment")
        ],
        "duration_sec": 10
    },
    {
        "num": 13,
        "title": "Conclusion & Faculty Evaluator Attribution",
        "subtitle": "Project Completed for Advanced Data Structures (ADS) PBL Evaluation",
        "img": "C:/Users/ssana/.gemini/antigravity/brain/00aae3de-638d-43aa-8d7e-eb7d23dcb945/browser_sandbox/screenshots/step_14_shot_1_clean_login_screen.png",
        "info_title": "Project Summary & Credits",
        "bullets": [
            ("Practical ADS Application", "CASETHREAD successfully bridges abstract Advanced Data Structures to real-world forensic challenges."),
            ("Zero AI Hallucination", "All graph traversals, AVL anomaly detections, and heap rankings execute in verified C99 deterministic code."),
            ("Decoupled Engineering", "Demonstrates professional full-stack architecture: React UI, Express API, Native C Core, and MySQL Database."),
            ("Investigation Support Tool", "Built strictly as an investigative assistant for human law enforcement detectives.")
        ],
        "specs": [
            ("Saravana Srinivas", "Roll No: 25R11A66P7"),
            ("L. Anjan Kumar", "Roll No: 25R11A66N5"),
            ("Movith", "Roll No: 25R11A66M6"),
            ("Academic Course", "PBL in Advanced Data Structures (ADS)")
        ],
        "duration_sec": 10
    }
]

def render_scene(scene_data):
    canvas, draw = create_base_canvas(
        scene_data["num"],
        len(SCENES),
        scene_data["title"],
        scene_data["subtitle"]
    )

    # Left visual card
    canvas = place_image_card(canvas, scene_data["img"], box=(60, 185, 1100, 980))

    # Right info panel
    draw = ImageDraw.Draw(canvas)
    draw_info_panel(
        draw,
        scene_data["info_title"],
        scene_data["bullets"],
        scene_data["specs"],
        box=(1130, 185, 1860, 980)
    )

    return canvas

def generate_video():
    print(f"=== Generating CASETHREAD Demonstration Video: {OUTPUT_FILE} ===")
    print(f"Total Scenes: {len(SCENES)} | Resolution: {WIDTH}x{HEIGHT} @ {FPS} fps")

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(OUTPUT_FILE, fourcc, float(FPS), (WIDTH, HEIGHT))

    fade_frames = int(0.5 * FPS) # 12 frames crossfade

    prev_frame_cv = None

    for idx, sc in enumerate(SCENES):
        print(f"Rendering Scene {sc['num']}/{len(SCENES)}: {sc['title']}...")
        scene_img = render_scene(sc)
        frame_cv = cv2.cvtColor(np.array(scene_img), cv2.COLOR_RGB2BGR)

        total_frames = int(sc["duration_sec"] * FPS)

        # Crossfade from previous scene if available
        if prev_frame_cv is not None and fade_frames > 0:
            for f in range(fade_frames):
                alpha = f / float(fade_frames)
                blended = cv2.addWeighted(prev_frame_cv, 1.0 - alpha, frame_cv, alpha, 0)
                out.write(blended)
            steady_frames = total_frames - fade_frames
        else:
            steady_frames = total_frames

        # Steady display
        for _ in range(max(1, steady_frames)):
            out.write(frame_cv)

        prev_frame_cv = frame_cv

    out.release()
    print(f"\n[SUCCESS] Walkthrough video generated successfully: {OUTPUT_FILE}")
    print(f"File size: {os.path.getsize(OUTPUT_FILE) / (1024*1024):.2f} MB")

if __name__ == '__main__':
    generate_video()
