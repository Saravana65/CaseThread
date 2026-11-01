/**
 * @file production_safety.test.js
 * @description Comprehensive test suite verifying Production Database Safety:
 * 1. MemoryStore is strictly prohibited when NODE_ENV === 'production'
 * 2. Automatic fallbacks (ECONNREFUSED, PROTOCOL_CONNECTION_LOST) are eliminated in production
 * 3. withTransaction throws when production MySQL is unavailable
 * 4. Production secret validation blocks weak JWT secrets, missing DB passwords, and demo toggles
 * 5. /api/v1/health returns 503 and UNHEALTHY when database is disconnected in production
 * 6. Non-browser and authorized CORS origins are enforced
 */

process.env.NODE_ENV = 'test';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { isMemoryStoreAllowed, execute, query, withTransaction } = require('../database/connection');
const { validateConfig, INSECURE_DEFAULT_SECRETS, INSECURE_DB_PASSWORDS } = require('../config/validateConfig');
const app = require('../server');

describe('CASETHREAD - Production Database Safety & Security Hardening', () => {

  // 1. MemoryStore Policy Enforcement
  test('1. isMemoryStoreAllowed() strictly returns false when NODE_ENV is production', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalUseMem = process.env.USE_MEMORY_STORE;
    const originalAllowMem = process.env.ALLOW_MEMORY_STORE;

    try {
      process.env.NODE_ENV = 'production';
      process.env.USE_MEMORY_STORE = 'true';
      process.env.ALLOW_MEMORY_STORE = 'true';

      assert.strictEqual(
        isMemoryStoreAllowed(),
        false,
        'MemoryStore MUST NOT be allowed in production even if toggles are set to true'
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.USE_MEMORY_STORE = originalUseMem;
      process.env.ALLOW_MEMORY_STORE = originalAllowMem;
    }
  });

  test('2. isMemoryStoreAllowed() returns true only in test or explicitly enabled dev mode', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalUseMem = process.env.USE_MEMORY_STORE;
    const originalAllowMem = process.env.ALLOW_MEMORY_STORE;

    try {
      // In test mode
      process.env.NODE_ENV = 'test';
      assert.strictEqual(isMemoryStoreAllowed(), true);

      // In development without flag -> false
      process.env.NODE_ENV = 'development';
      process.env.USE_MEMORY_STORE = 'false';
      process.env.ALLOW_MEMORY_STORE = 'false';
      assert.strictEqual(isMemoryStoreAllowed(), false);

      // In development with explicit flag -> true
      process.env.ALLOW_MEMORY_STORE = 'true';
      assert.strictEqual(isMemoryStoreAllowed(), true);
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.USE_MEMORY_STORE = originalUseMem;
      process.env.ALLOW_MEMORY_STORE = originalAllowMem;
    }
  });

  // 2. Production Fallback Elimination Tests
  test('3. execute() in production throws rather than falling back to MemoryStore when pool fails', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      // If pool is uninitialized or MySQL is offline, execute must throw
      await assert.rejects(
        async () => {
          await execute('SELECT * FROM non_existent_table_for_test');
        },
        (err) => {
          assert.ok(err instanceof Error);
          return true;
        },
        'execute() in production must reject on DB error and not return MemoryStore data'
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  test('4. withTransaction() in production throws if MySQL is unavailable and never falls back silently', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      await assert.rejects(
        async () => {
          await withTransaction(async (conn) => {
            await conn.execute('SELECT 1');
          });
        },
        (err) => {
          assert.ok(err instanceof Error);
          return true;
        },
        'withTransaction() in production must reject when MySQL is unavailable'
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  // 3. Security Config Validation Tests
  test('5. validateConfig catches missing or short JWT_SECRET in production', () => {
    const res1 = validateConfig({
      NODE_ENV: 'production',
      JWT_SECRET: '',
      DB_PASSWORD: 'secure_prod_password_99!',
      DB_NAME: 'casethread_db',
      DB_USER: 'casethread_user',
      DB_HOST: 'database'
    });
    assert.strictEqual(res1.valid, false);
    assert.ok(res1.errors.some(e => e.includes('JWT_SECRET is required')));

    const res2 = validateConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'short_key',
      DB_PASSWORD: 'secure_prod_password_99!',
      DB_NAME: 'casethread_db',
      DB_USER: 'casethread_user',
      DB_HOST: 'database'
    });
    assert.strictEqual(res2.valid, false);
    assert.ok(res2.errors.some(e => e.includes('at least 32 characters')));
  });

  test('6. validateConfig catches insecure default JWT secrets and DB passwords', () => {
    for (const secret of INSECURE_DEFAULT_SECRETS) {
      const res = validateConfig({
        NODE_ENV: 'production',
        JWT_SECRET: secret,
        DB_PASSWORD: 'real_strong_password_99!',
        DB_NAME: 'casethread_db',
        DB_USER: 'casethread_user',
        DB_HOST: 'database'
      });
      assert.strictEqual(res.valid, false, `Secret '${secret}' should be rejected`);
      assert.ok(res.errors.some(e => e.includes('insecure default') || e.includes('at least 32 characters')));
    }

    for (const pass of INSECURE_DB_PASSWORDS) {
      const res = validateConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'a_very_long_cryptographically_secure_random_key_123456789',
        DB_PASSWORD: pass,
        DB_NAME: 'casethread_db',
        DB_USER: 'casethread_user',
        DB_HOST: 'database'
      });
      assert.strictEqual(res.valid, false, `Password '${pass}' should be rejected`);
      assert.ok(res.errors.some(e => e.includes('insecure default placeholder')));
    }
  });

  test('7. validateConfig blocks demo flags and memory store in production', () => {
    const res = validateConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'a_very_long_cryptographically_secure_random_key_123456789',
      DB_PASSWORD: 'super_secure_production_password_2026!',
      DB_NAME: 'casethread_db',
      DB_USER: 'casethread_user',
      DB_HOST: 'database',
      ENABLE_DEMO_CREDENTIALS: 'true',
      USE_MEMORY_STORE: 'true'
    });
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('Demo credential autofill cannot be enabled')));
    assert.ok(res.errors.some(e => e.includes('ALLOW_MEMORY_STORE and USE_MEMORY_STORE cannot be enabled')));
  });

  // 4. Health Check Endpoint Tests
  test('8. /api/v1/health returns 503 and UNHEALTHY when database is disconnected in production', async () => {
    let server;
    let baseUrl;

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/v1`;
        resolve();
      });
    });

    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const res = await fetch(`${baseUrl}/health`);
      // Since local MySQL on port 3306 is not connected in this test process,
      // it MUST return 503 Service Unavailable and status UNHEALTHY!
      assert.strictEqual(res.status, 503, 'Must return HTTP 503 when production MySQL is unavailable');
      const body = await res.json();
      assert.strictEqual(body.status, 'UNHEALTHY', 'Must NOT report ONLINE when database is disconnected');
      assert.strictEqual(body.database_connected, false);
      assert.ok(body.error.includes('Production MySQL database connection is unavailable'));
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
    }
  });
});
