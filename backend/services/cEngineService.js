/**
 * @file cEngineService.js
 * @description High-performance IPC bridge connecting Node.js backend to the compiled C Core DSA Engine.
 * 
 * PROTOCOL:
 *   1. Node.js marshals normalized case entities, evidence nodes, edges and timeline into JSON.
 *   2. Node spawns the C engine binary (casethread_engine) as an isolated child process.
 *   3. JSON payload streams through child.stdin.
 *   4. C engine parses, indexes into HashMaps/AVL-trees, runs Graph BFS/DFS, and writes results to child.stdout.
 *   5. Node captures child.stdout, validates JSON, and persists findings to MySQL investigation_results.
 *   6. Diagnostics & assertions route through child.stderr, keeping child.stdout strictly parseable.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class CEngineService {
  constructor() {
    this.timeoutMs = parseInt(process.env.C_ENGINE_TIMEOUT_MS, 10) || 8000;
  }

  /**
   * Resolves platform-specific executable binary location.
   */
  getEngineBinaryPath() {
    const isWindows = process.platform === 'win32';
    const binaryName = isWindows ? 'casethread_engine.exe' : 'casethread_engine';
    
    // Check multiple candidate locations (root build, core-engine/bin, local bin)
    const candidates = [
      path.resolve(__dirname, '../../core-engine/bin', binaryName),
      path.resolve(__dirname, '../../core-engine', binaryName),
      path.resolve('/app/core-engine/bin', binaryName)
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0]; // Default fallback path
  }

  /**
   * Evaluates native binary operational readiness for health checks.
   * @returns {{ status: string, binary: string, available: boolean, error?: string }}
   */
  checkEngineReadiness() {
    const binaryPath = this.getEngineBinaryPath();
    const exists = fs.existsSync(binaryPath);
    if (!exists) {
      return {
        status: 'DOWN',
        binary: path.basename(binaryPath),
        available: false,
        error: 'Engine binary not compiled or missing on disk'
      };
    }
    return {
      status: 'UP',
      binary: path.basename(binaryPath),
      available: true
    };
  }

  /**
   * Dispatches case payload to C Algorithm Engine via stdin and awaits stdout response.
   * @param {Object} casePayload Structured investigation data for DSA processing
   * @returns {Promise<Object>} Processed results containing gaps, graph paths, and leads
   */
  async runAnalysis(casePayload) {
    const binaryPath = this.getEngineBinaryPath();

    if (!fs.existsSync(binaryPath)) {
      const errMsg = `[C-ENGINE CRITICAL] Binary not found at "${binaryPath}". The native C Algorithm Engine must be compiled first (run build.bat on Windows or make in core-engine/).`;
      console.error(errMsg);
      throw new Error(errMsg);
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdoutData = '';
      let stderrData = '';
      let isTimedOut = false;

      const child = spawn(binaryPath, ['--stdin'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const timer = setTimeout(() => {
        isTimedOut = true;
        child.kill('SIGKILL');
        reject(new Error(`[C-ENGINE] Execution timed out after ${this.timeoutMs}ms.`));
      }, this.timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`[C-ENGINE] Failed to start engine process: ${err.message}`));
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (isTimedOut) return;

        const duration = Date.now() - startTime;
        if (stderrData.length > 0) {
          console.log(`[C-ENGINE DIAGNOSTIC] ${stderrData.trim()}`);
        }

        if (code !== 0) {
          return reject(new Error(`[C-ENGINE] Process exited with failure code ${code}: ${stderrData}`));
        }

        try {
          const parsedResult = JSON.parse(stdoutData);
          parsedResult.execution_latency_ms = duration;
          resolve(parsedResult);
        } catch (jsonErr) {
          reject(new Error(`[C-ENGINE] Failed to parse output JSON: ${jsonErr.message}. Output was: ${stdoutData.slice(0, 300)}`));
        }
      });

      // Stream payload to child stdin
      try {
        const payloadStr = JSON.stringify(casePayload);
        child.stdin.write(payloadStr);
        child.stdin.end();
      } catch (writeErr) {
        clearTimeout(timer);
        child.kill();
        reject(new Error(`[C-ENGINE] Failed writing to stdin: ${writeErr.message}`));
      }
    });
  }
}

module.exports = new CEngineService();
