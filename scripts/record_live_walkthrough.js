/**
 * @file record_live_walkthrough.js
 * @description Records an authentic live browser session of CASETHREAD running on http://localhost:3000
 * with a visible moving mouse cursor, realistic keystroke typing, and live feature walkthrough.
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

async function moveMouseSmooth(page, targetX, targetY, steps = 12) {
  const startX = currentMouseX;
  const startY = currentMouseY;

  for (let i = 1; i <= steps; i++) {
    // cubic ease in-out
    const t = i / steps;
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const x = Math.round(startX + (targetX - startX) * ease);
    const y = Math.round(startY + (targetY - startY) * ease);

    await page.evaluate((cx, cy) => {
      window.updateVirtualCursor(cx, cy);
    }, x, y);

    currentMouseX = x;
    currentMouseY = y;
    await captureFrame(page);
  }
}

async function clickAt(page, targetX, targetY) {
  await moveMouseSmooth(page, targetX, targetY, 14);

  // Trigger ripple & click
  await page.evaluate((cx, cy) => {
    window.triggerClickEffect();
  });
  await captureFrame(page);

  // Native mouse click at coordinates
  await page.mouse.click(targetX, targetY);
  await captureFrame(page);
  await captureFrame(page);
}

async function clickElementBySelector(page, selector) {
  const el = await page.$(selector);
  if (!el) {
    console.warn(`Element not found for click: ${selector}`);
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

async function clickSidebarItem(page, textLabel) {
  console.log(`Navigating to: ${textLabel}`);
  const targetCoords = await page.evaluate((label) => {
    const items = Array.from(document.querySelectorAll('div, button, a, li, span'));
    for (const item of items) {
      if (item.innerText?.trim() === label && item.offsetParent !== null) {
        const rect = item.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        }
      }
    }
    return null;
  }, textLabel);

  if (targetCoords) {
    await clickAt(page, targetCoords.x, targetCoords.y);
  } else {
    console.warn(`Could not find clickable coordinates for: ${textLabel}`);
  }
  // Hold view for observation
  for (let i = 0; i < 18; i++) {
    await captureFrame(page);
  }
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
  // pause after typing
  for (let i = 0; i < 4; i++) {
    await captureFrame(page);
  }
}

async function smoothScroll(page, distance, steps = 10) {
  const delta = Math.round(distance / steps);
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => window.scrollBy(0, d), delta);
    await captureFrame(page);
  }
}

async function runLiveWalkthrough() {
  console.log('=== Starting CASETHREAD Live Interactive Walkthrough Recording ===');
  console.log('Output Directory:', FRAMES_DIR);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();

  // Clear any existing session to start fresh on Login Screen
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle2' });

  // Injected Visual Cursor DOM Helper
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
        bottom: 18px;
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
        <span style="color:#00e5ff; font-weight:bold;">[LIVE DEMO]</span>
        <span id="hud-text">CASETHREAD Investigation Terminal Active</span>
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

  // SCENE 1: Clean Terminal Login Page
  console.log('--- SCENE 1: Login Screen & Assistance Helper ---');
  await setHud("Authenticating Officer on Forensic Terminal", "AUTH SECURITY");
  for (let i = 0; i < 15; i++) await captureFrame(page);

  // Click 'Need assistance?' to display credentials helper
  console.log('Hovering and clicking "Need assistance?"...');
  const assistBox = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Need assistance?'));
    if (btn) {
      const r = btn.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }
    return null;
  });

  if (assistBox) {
    await clickAt(page, assistBox.x, assistBox.y);
    await setHud("Inspecting Authorized Role Credentials", "LEAST PRIVILEGE RBAC");
    for (let i = 0; i < 20; i++) await captureFrame(page);
  }

  // Type Badge DET-8841
  console.log('Typing Badge Number DET-8841...');
  await setHud("Entering Lead Detective Badge Number: DET-8841");
  await typeIntoField(page, '#ct-badge', 'DET-8841');

  // Type Passcode Password123!
  console.log('Typing Passcode...');
  await setHud("Entering Cryptographic Security Passcode");
  await typeIntoField(page, '#ct-password', 'Password123!');

  // Reveal password eye toggle
  const eyeBtn = await page.$('.ct-pw-toggle');
  if (eyeBtn) {
    const eBox = await eyeBtn.boundingBox();
    if (eBox) {
      console.log('Toggling password visibility...');
      await clickAt(page, Math.round(eBox.x + eBox.width / 2), Math.round(eBox.y + eBox.height / 2));
      for (let i = 0; i < 10; i++) await captureFrame(page);
    }
  }

  // Click Submit
  console.log('Submitting login form...');
  await setHud("Dispatching Signed JWT Session to API Gateway", "BCRYPT + JWT");
  await clickElementBySelector(page, 'button[type="submit"]');

  // Wait for transition to Dashboard
  await new Promise(r => setTimeout(r, 2200));
  await injectCursor();

  // SCENE 2: Dashboard Exploration
  console.log('--- SCENE 2: Dashboard Overview ---');
  await setHud("Command Dashboard: Master Case CASE-2026-0419 Active", "TELEMETRY METRICS");
  for (let i = 0; i < 15; i++) await captureFrame(page);

  // Hover over overview metrics
  await moveMouseSmooth(page, 450, 240, 15);
  for (let i = 0; i < 10; i++) await captureFrame(page);
  await moveMouseSmooth(page, 720, 240, 15);
  for (let i = 0; i < 10; i++) await captureFrame(page);
  await moveMouseSmooth(page, 1000, 240, 15);
  for (let i = 0; i < 10; i++) await captureFrame(page);

  // Hover over Anomaly Alert Banner
  console.log('Inspecting Anomaly Banner...');
  await setHud("Anomaly Alert: Spatiotemporal Contradiction Detected", "AVL ANOMALY DETECTOR");
  await moveMouseSmooth(page, 700, 360, 15);
  for (let i = 0; i < 20; i++) await captureFrame(page);

  // Scroll down to view activity feed
  console.log('Scrolling down activity feed...');
  await setHud("Streaming Real-Time Forensic Activity & Audit Ledger");
  await smoothScroll(page, 400, 12);
  for (let i = 0; i < 15; i++) await captureFrame(page);
  await smoothScroll(page, -400, 12);
  for (let i = 0; i < 10; i++) await captureFrame(page);

  // SCENE 3: All Cases View
  console.log('--- SCENE 3: All Cases Roster ---');
  await setHud("Navigating to Master Case Dossier Roster");
  await clickSidebarItem(page, 'All Cases');
  await injectCursor();
  await moveMouseSmooth(page, 600, 320, 15);
  for (let i = 0; i < 15; i++) await captureFrame(page);

  // SCENE 4: Evidence Management Vault
  console.log('--- SCENE 4: Evidence Management Vault ---');
  await setHud("Opening Secure Evidence Vault: 11 Verified Artifacts", "SHA-256 VAULT");
  await clickSidebarItem(page, 'Evidence Management');
  await injectCursor();

  // Scroll through evidence list
  await moveMouseSmooth(page, 750, 400, 15);
  for (let i = 0; i < 15; i++) await captureFrame(page);

  // Click 'Verify Integrity' button if present
  console.log('Verifying evidence integrity fingerprint...');
  const verifyBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(b => b.innerText.includes('Verify') || b.innerText.includes('SHA-256') || b.innerText.includes('Integrity'));
    if (target && target.offsetParent !== null) {
      const r = target.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }
    return null;
  });

  if (verifyBtn) {
    await setHud("Verifying Cryptographic SHA-256 Chain-of-Custody", "TAMPER PROOFING");
    await clickAt(page, verifyBtn.x, verifyBtn.y);
    for (let i = 0; i < 20; i++) await captureFrame(page);
  }

  await smoothScroll(page, 300, 10);
  for (let i = 0; i < 12; i++) await captureFrame(page);
  await smoothScroll(page, -300, 10);

  // SCENE 5: Relationship Graph & BFS Shortest Path
  console.log('--- SCENE 5: Relationship Graph & BFS ---');
  await setHud("Generating Dynamic Relational Graph & BFS Traversal", "GRAPH ADJACENCY LIST");
  await clickSidebarItem(page, 'Relationship Graph');
  await injectCursor();

  // Hover and inspect graph canvas
  console.log('Exploring graph vertices and edges...');
  await moveMouseSmooth(page, 700, 480, 18);
  for (let i = 0; i < 15; i++) await captureFrame(page);
  await moveMouseSmooth(page, 950, 420, 18);
  for (let i = 0; i < 15; i++) await captureFrame(page);
  await moveMouseSmooth(page, 620, 600, 18);
  for (let i = 0; i < 15; i++) await captureFrame(page);

  await setHud("Tracing Unweighted Shortest Path: Vance -> RFID -> Vault Lock", "BFS SHORTEST PATH");
  for (let i = 0; i < 25; i++) await captureFrame(page);

  // SCENE 6: Timeline Analysis & Spatiotemporal Velocity
  console.log('--- SCENE 6: Timeline Analysis ---');
  await setHud("Chronological AVL Tree Event Indexing", "BALANCED AVL TREE");
  await clickSidebarItem(page, 'Timeline Analysis');
  await injectCursor();

  await moveMouseSmooth(page, 700, 380, 15);
  for (let i = 0; i < 15; i++) await captureFrame(page);

  await setHud("Spatiotemporal Velocity Violation: 14 km in 4 min (> 210 km/h)", "FALSE ALIBI DISPROVED");
  await moveMouseSmooth(page, 750, 520, 15);
  for (let i = 0; i < 25; i++) await captureFrame(page);

  // SCENE 7: Evidence Gaps Detection
  console.log('--- SCENE 7: Evidence Gaps ---');
  await setHud("Algorithmic Gap Detection: 16 Evidentiary Disconnects", "GAP DETECTION ENGINE");
  await clickSidebarItem(page, 'Evidence Gaps');
  await injectCursor();

  await smoothScroll(page, 250, 10);
  for (let i = 0; i < 15; i++) await captureFrame(page);
  await setHud("Unmonitored 28-min Window & Missing Custody Signatures Identified");
  for (let i = 0; i < 15; i++) await captureFrame(page);
  await smoothScroll(page, -250, 10);

  // SCENE 8: Priority Max-Heap Leads & Solution
  console.log('--- SCENE 8: Investigative Leads ---');
  await setHud("Priority Max-Heap Actionable Leads: Root Score 95.0", "MAX-HEAP PRIORITY QUEUE");
  await clickSidebarItem(page, 'Investigative Leads');
  await injectCursor();

  await moveMouseSmooth(page, 750, 360, 15);
  for (let i = 0; i < 15; i++) await captureFrame(page);

  await setHud("Top Lead: Intercept Courier Vessel at Dock 4 (Case Solved!)", "CASE RESOLUTION");
  await moveMouseSmooth(page, 800, 480, 15);
  for (let i = 0; i < 25; i++) await captureFrame(page);

  // SCENE 9: Geospatial Quadtree Mapping
  console.log('--- SCENE 9: Geospatial Quadtree ---');
  await setHud("2D Quadtree Spatial Indexing: Proximity Radius Clustering", "2D POINT QUADTREE");
  await clickSidebarItem(page, 'Geospatial Analysis');
  await injectCursor();

  await moveMouseSmooth(page, 850, 500, 18);
  for (let i = 0; i < 25; i++) await captureFrame(page);

  // SCENE 10: Trigger Live C-Engine Analysis
  console.log('--- SCENE 10: Triggering Live C-Engine ---');
  await setHud("Triggering Native C99 Algorithm Execution Pipeline", "JSON IPC CORE ENGINE");

  const runEngineBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(b => b.innerText.includes('Run C-Engine') || b.innerText.includes('Analyze') || b.innerText.includes('Execute'));
    if (target && target.offsetParent !== null) {
      const r = target.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }
    return null;
  });

  if (runEngineBtn) {
    await clickAt(page, runEngineBtn.x, runEngineBtn.y);
    await setHud("C-Engine Executed: Gaps, Anomalies & Leads Synchronized", "ENGINE LATENCY < 5ms");
    for (let i = 0; i < 30; i++) await captureFrame(page);
  }

  // SCENE 11: Return to Dashboard & Sign Out
  console.log('--- SCENE 11: Return to Dashboard & Complete ---');
  await setHud("Investigation Completed: Case Dossier Validated", "ADS PBL COMPLETE");
  await clickSidebarItem(page, 'Dashboard');
  await injectCursor();
  for (let i = 0; i < 20; i++) await captureFrame(page);

  console.log(`\n[SUCCESS] Recorded ${frameIndex} frames in total.`);
  await browser.close();
}

runLiveWalkthrough().catch(err => {
  console.error('[ERROR in Walkthrough Recording]:', err);
  process.exit(1);
});
