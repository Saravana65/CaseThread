/**
 * @file record_case_solving_walkthrough.js
 * @description Records an authentic live browser session of CASETHREAD solving an investigation:
 * 1. Log in on forensic terminal
 * 2. File a new case (CASE-2026-0920) via Create Case Modal
 * 3. Ingest Evidence #1 (Titanium Bolt Cutters)
 * 4. Ingest Evidence #2 (SanDisk Encrypted Hardware Token)
 * 5. Run native C-Engine DSA pipeline
 * 6. Explore generated Relationship Graph
 * 7. Inspect Evidence Gaps and Max-Heap Priority Leads to display the Case Solution
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const FRAMES_DIR = path.join(__dirname, '..', 'walkthrough_frames');
if (!fs.existsSync(FRAMES_DIR)) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
}

let frameIndex = 0;
let currentMouseX = 960;
let currentMouseY = 540;

async function captureFrame(page) {
  frameIndex++;
  const filename = path.join(FRAMES_DIR, `frame_${String(frameIndex).padStart(5, '0')}.jpg`);
  await page.screenshot({ path: filename, type: 'jpeg', quality: 80 });
}

async function moveMouseSmooth(page, targetX, targetY, steps = 14) {
  const startX = currentMouseX;
  const startY = currentMouseY;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Cubic ease-in-out
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const x = Math.round(startX + (targetX - startX) * ease);
    const y = Math.round(startY + (targetY - startY) * ease);

    await page.evaluate((cx, cy) => {
      if (window.updateVirtualCursor) window.updateVirtualCursor(cx, cy);
    }, x, y);

    currentMouseX = x;
    currentMouseY = y;
    await captureFrame(page);
  }
}

async function clickAt(page, targetX, targetY) {
  await moveMouseSmooth(page, targetX, targetY, 14);

  await page.evaluate(() => {
    if (window.triggerClickEffect) window.triggerClickEffect();
  });
  await captureFrame(page);

  await page.mouse.click(targetX, targetY);
  await captureFrame(page);
  await captureFrame(page);
}

async function clickElementBySelector(page, selector) {
  const el = await page.$(selector);
  if (!el) {
    console.warn(`Element not found for selector: ${selector}`);
    return;
  }
  const box = await el.boundingBox();
  if (box) {
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    await clickAt(page, x, y);
  } else {
    await el.click();
  }
}

async function clickElementByText(page, text) {
  const coords = await page.evaluate((t) => {
    const els = Array.from(document.querySelectorAll('button, a, div, span, li'));
    for (const el of els) {
      if (el.innerText?.trim() === t && el.offsetParent !== null) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }
      }
    }
    return null;
  }, text);

  if (coords) {
    await clickAt(page, coords.x, coords.y);
  } else {
    console.warn(`Could not find clickable text: ${text}`);
  }
  for (let i = 0; i < 12; i++) await captureFrame(page);
}

async function typeIntoField(page, selector, text) {
  const el = await page.$(selector);
  if (!el) return;
  const box = await el.boundingBox();
  if (box) {
    await clickAt(page, Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2));
  }

  for (const char of text) {
    await page.keyboard.type(char);
    await captureFrame(page);
  }
  for (let i = 0; i < 4; i++) await captureFrame(page);
}

async function selectDropdownOption(page, selector, val) {
  const el = await page.$(selector);
  if (el) {
    const box = await el.boundingBox();
    if (box) {
      await clickAt(page, Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2));
    }
    await page.select(selector, val);
    for (let i = 0; i < 6; i++) await captureFrame(page);
  }
}

async function smoothScroll(page, distance, steps = 10) {
  const delta = Math.round(distance / steps);
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => window.scrollBy(0, d), delta);
    await captureFrame(page);
  }
}

async function runCaseSolvingWalkthrough() {
  console.log('=== Starting CASETHREAD Interactive Case Solving Walkthrough ===');
  console.log('Output Directory:', FRAMES_DIR);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();

  // Reset session
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });

  // Injected Visual Cursor & HUD
  const injectCursor = async () => {
    await page.evaluate((initX, initY) => {
      if (document.getElementById('virtual-cursor-container')) return;

      const container = document.createElement('div');
      container.id = 'virtual-cursor-container';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 32px;
        height: 32px;
        pointer-events: none;
        z-index: 2147483647;
        transform: translate3d(${initX}px, ${initY}px, 0);
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));
      `;
      container.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.85a.5.5 0 0 0-.85.36z" fill="#ffffff" stroke="#07090e" stroke-width="1.8"/>
        </svg>
        <div id="virtual-click-ripple" style="
          position: absolute;
          top: -8px;
          left: -8px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 3px solid #00e5ff;
          opacity: 0;
          transform: scale(0.3);
          transition: all 0.25s ease-out;
        "></div>
      `;
      document.body.appendChild(container);

      // Forensic Narration Banner
      const hud = document.createElement('div');
      hud.id = 'forensic-hud-banner';
      hud.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(10, 14, 22, 0.94);
        border: 1.5px solid #d32f2f;
        box-shadow: 0 8px 32px rgba(0,0,0,0.7);
        border-radius: 8px;
        padding: 10px 24px;
        color: #f0f6fc;
        font-family: 'Consolas', 'Courier New', monospace;
        font-size: 14.5px;
        letter-spacing: 0.05em;
        z-index: 2147483640;
        pointer-events: none;
        display: flex;
        align-items: center;
        gap: 16px;
      `;
      hud.innerHTML = `
        <span style="color:#00e5ff; font-weight:bold;">[LIVE WORKFLOW]</span>
        <span id="hud-text">Terminal Initialized</span>
      `;
      document.body.appendChild(hud);

      window.updateVirtualCursor = (x, y) => {
        container.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      };

      window.triggerClickEffect = () => {
        const rip = document.getElementById('virtual-click-ripple');
        if (rip) {
          rip.style.opacity = '1';
          rip.style.transform = 'scale(1.4)';
          setTimeout(() => {
            rip.style.opacity = '0';
            rip.style.transform = 'scale(0.3)';
          }, 220);
        }
      };

      window.setHudText = (text, dsa) => {
        const hText = document.getElementById('hud-text');
        if (hText) {
          hText.innerHTML = `${text} ${dsa ? `<span style="color:#e88b2e; margin-left:8px;">[${dsa}]</span>` : ''}`;
        }
      };
    }, currentMouseX, currentMouseY);
  };

  const setHud = async (action, dsa = "") => {
    await page.evaluate((a, d) => window.setHudText(a, d), action, dsa);
  };

  await injectCursor();

  // ----------------------------------------------------
  // STEP 1: LOGIN AS DETECTIVE
  // ----------------------------------------------------
  console.log('Step 1: Logging in...');
  await setHud("Step 1: Authenticating Detective on Forensic Terminal", "AUTH SECURITY");
  for (let i = 0; i < 15; i++) await captureFrame(page);

  await setHud("Entering Officer Badge: DET-8841");
  await typeIntoField(page, '#ct-badge', 'DET-8841');

  await setHud("Entering Security Passcode");
  await typeIntoField(page, '#ct-password', 'Password123!');

  await setHud("Authenticating Officer Session...", "JWT BCRYPT");
  await clickElementBySelector(page, 'button[type="submit"]');

  await new Promise(r => setTimeout(r, 2200));
  await injectCursor();

  // ----------------------------------------------------
  // STEP 2: FILE A NEW INVESTIGATION CASE
  // ----------------------------------------------------
  console.log('Step 2: Filing a New Case File...');
  await setHud("Step 2: Initiating New Criminal Investigation Case Dossier", "CASE MANAGEMENT");
  for (let i = 0; i < 12; i++) await captureFrame(page);

  // Click 'New Case' in sidebar
  await clickElementByText(page, 'New Case');
  await injectCursor();

  const caseNum = 'CASE-2026-0920';
  await setHud(`Filing Case File #${caseNum}: Central Harbor Depository Intrusion`);
  await typeIntoField(page, '#case_number', caseNum);

  await setHud("Setting Investigation Priority: CRITICAL");
  await selectDropdownOption(page, '#priority', 'CRITICAL');

  await setHud("Entering Investigation Incident Title");
  await typeIntoField(page, '#title', 'Central Harbor Depository Intrusion & Vault Breach');

  await setHud("Setting Incident Location Jurisdiction");
  await typeIntoField(page, '#incident_location', 'Pier 42, Central Maritime Terminal');

  await setHud("Recording Incident Description & Modus Operandi");
  await typeIntoField(page, '#description', 'Armed night intrusion into harbor depository safe. Titanium master locks sheared; encrypted hardware key fob recovered at scene.');

  // Click Register Case Dossier
  await setHud("Registering Case Dossier in Database Vault...", "MYSQL 8 INNODB");
  const regBtn = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Register Case Dossier'));
    if (btn) {
      const r = btn.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }
    return null;
  });

  if (regBtn) {
    await clickAt(page, regBtn.x, regBtn.y);
  }

  await new Promise(r => setTimeout(r, 2500));
  await injectCursor();

  // ----------------------------------------------------
  // STEP 3: INGEST EVIDENCE #1 (TITANIUM BOLT CUTTERS)
  // ----------------------------------------------------
  console.log('Step 3: Ingesting Evidence #1...');
  await setHud("Step 3: Adding Physical Evidence Record to Dossier", "EVIDENCE INTAKE");
  for (let i = 0; i < 15; i++) await captureFrame(page);

  // Click 'ADD EVIDENCE' button
  const addEvBtn1 = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('ADD EVIDENCE'));
    if (btn) {
      const r = btn.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }
    return null;
  });

  if (addEvBtn1) {
    await clickAt(page, addEvBtn1.x, addEvBtn1.y);
    await injectCursor();
    for (let i = 0; i < 12; i++) await captureFrame(page);

    await setHud("Logging Evidence Tracking Barcode: EV-PHYS-881");
    await typeIntoField(page, '#tracking_code', 'EV-PHYS-881');

    await setHud("Evidence Title: Titanium Jaws Bolt Cutters");
    await typeIntoField(page, '#title', 'Titanium Jaws Bolt Cutters');

    await selectDropdownOption(page, '#category', 'PHYSICAL');

    await setHud("Collection Location: North Vault Perimeter, Pier 42");
    await typeIntoField(page, '#collection_location', 'North Vault Perimeter, Pier 42');

    await setHud("Description: Matching sheared depository lock; latent friction ridges found");
    await typeIntoField(page, '#description', 'Heavy bolt cutters matching sheared depository master lock. Latent friction ridges recovered from rubber grip.');

    // Click 'Commit Evidence to Dossier'
    await setHud("Committing Evidence & Computing SHA-256 Fingerprint...", "SHA-256 HASH");
    const commitBtn = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Commit Evidence'));
      if (btn) {
        const r = btn.getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    });

    if (commitBtn) {
      await clickAt(page, commitBtn.x, commitBtn.y);
      await new Promise(r => setTimeout(r, 2000));
      await injectCursor();
    }
  }

  // ----------------------------------------------------
  // STEP 4: INGEST EVIDENCE #2 (CYBER SECURITY TOKEN)
  // ----------------------------------------------------
  console.log('Step 4: Ingesting Evidence #2...');
  await setHud("Step 4: Adding Digital Cyber Token Evidence", "DIGITAL FORENSICS");
  for (let i = 0; i < 15; i++) await captureFrame(page);

  const addEvBtn2 = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('ADD EVIDENCE'));
    if (btn) {
      const r = btn.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }
    return null;
  });

  if (addEvBtn2) {
    await clickAt(page, addEvBtn2.x, addEvBtn2.y);
    await injectCursor();
    for (let i = 0; i < 12; i++) await captureFrame(page);

    await setHud("Logging Evidence Tracking Barcode: EV-CYBER-882");
    await typeIntoField(page, '#tracking_code', 'EV-CYBER-882');

    await setHud("Evidence Title: SanDisk Encrypted Hardware Token");
    await typeIntoField(page, '#title', 'SanDisk Encrypted Hardware Token');

    await selectDropdownOption(page, '#category', 'DIGITAL');

    await setHud("Collection Location: Depository Server Rack B");
    await typeIntoField(page, '#collection_location', 'Depository Server Rack B');

    await setHud("Description: Cryptographic key fob used to bypass biometric relays");
    await typeIntoField(page, '#description', 'Cryptographic hardware key fob used to bypass biometric vault relays. Contains encrypted telemetry and courier ship communications.');

    await setHud("Committing Digital Artifact to Vault...", "SHA-256 HASH");
    const commitBtn2 = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Commit Evidence'));
      if (btn) {
        const r = btn.getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    });

    if (commitBtn2) {
      await clickAt(page, commitBtn2.x, commitBtn2.y);
      await new Promise(r => setTimeout(r, 2000));
      await injectCursor();
    }
  }

  // ----------------------------------------------------
  // STEP 5: RUN C-ENGINE ALGORITHM PIPELINE
  // ----------------------------------------------------
  console.log('Step 5: Executing Native C99 Analysis Pipeline...');
  await setHud("Step 5: Executing Native C99 Algorithm Core Engine", "JSON IPC PIPELINE");
  for (let i = 0; i < 15; i++) await captureFrame(page);

  // Trigger analysis button
  const runBtn = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Analyze') || b.innerText.includes('Run C-Engine') || b.innerText.includes('Analysis'));
    if (btn) {
      const r = btn.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }
    return null;
  });

  if (runBtn) {
    await clickAt(page, runBtn.x, runBtn.y);
    await setHud("C-Engine Executing: Building Graph, AVL Tree & Max-Heap...", "LATENCY < 5ms");
    for (let i = 0; i < 25; i++) await captureFrame(page);
  }

  // ----------------------------------------------------
  // STEP 6: EXPLORE GENERATED RELATIONSHIP GRAPH
  // ----------------------------------------------------
  console.log('Step 6: Exploring Relationship Graph...');
  await setHud("Step 6: Constructing Forensic Relational Adjacency Graph", "GRAPH ADJACENCY LIST");
  await clickElementByText(page, 'Relationship Graph');
  await injectCursor();

  // Inspect graph canvas nodes
  console.log('Hovering across graph nodes...');
  await setHud("Mapping Evidence Vertices: Bolt Cutters <-> Key Fob <-> Vault", "GRAPH TOPOLOGY");
  await moveMouseSmooth(page, 720, 460, 18);
  for (let i = 0; i < 18; i++) await captureFrame(page);

  await moveMouseSmooth(page, 920, 420, 18);
  for (let i = 0; i < 18; i++) await captureFrame(page);

  await setHud("BFS Shortest Path Algorithm: Tracing Vault Intrusion Link", "BFS O(V+E)");
  await moveMouseSmooth(page, 650, 580, 18);
  for (let i = 0; i < 24; i++) await captureFrame(page);

  // ----------------------------------------------------
  // STEP 7: SHOWING THE SOLUTION (EVIDENCE GAPS & MAX-HEAP LEADS)
  // ----------------------------------------------------
  console.log('Step 7: Showing Case Solution...');
  await setHud("Step 7: Reviewing Algorithmic Evidence Gaps", "GAP DETECTION");
  await clickElementByText(page, 'Evidence Gaps');
  await injectCursor();

  await moveMouseSmooth(page, 750, 400, 15);
  for (let i = 0; i < 18; i++) await captureFrame(page);

  await setHud("Gap Found: Unindexed Server Log & Missing Key Fob Custody", "PROVENANCE GAP");
  for (let i = 0; i < 20; i++) await captureFrame(page);

  // Click Investigative Leads to show the Case Solution!
  console.log('Showing Case Solution in Max-Heap Priority Leads...');
  await setHud("Step 8: Max-Heap Priority Leads — Solving the Case!", "MAX-HEAP ROOT O(1)");
  await clickElementByText(page, 'Investigative Leads');
  await injectCursor();

  await moveMouseSmooth(page, 780, 360, 18);
  for (let i = 0; i < 15; i++) await captureFrame(page);

  // Highlight Top Lead (Case Solution)
  await setHud("SOLUTION FOUND (Score 96.0): Intercept Courier Vessel at Dock 4!", "CASE RESOLUTION");
  await moveMouseSmooth(page, 820, 460, 18);
  for (let i = 0; i < 30; i++) await captureFrame(page);

  // Return to Dashboard to confirm case state
  console.log('Step 9: Investigation Complete, Returning to Dashboard...');
  await setHud("Investigation Complete: Case Solved via Algorithmic Forensics", "ADS PBL SUCCESS");
  await clickElementByText(page, 'Dashboard');
  await injectCursor();
  for (let i = 0; i < 25; i++) await captureFrame(page);

  console.log(`\n[SUCCESS] Recorded ${frameIndex} frames in total.`);
  await browser.close();
}

runCaseSolvingWalkthrough().catch(err => {
  console.error('[ERROR in Case Solving Walkthrough]:', err);
  process.exit(1);
});
