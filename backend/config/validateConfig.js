/**
 * @file validateConfig.js
 * @description Production security and environment configuration validator.
 * Enforces production secrets, blocks demo bypasses, and prevents insecure defaults.
 */

const INSECURE_DEFAULT_SECRETS = [
  'dev_forensic_secret_key_3892',
  'secret',
  'changeme',
  'password',
  '123456',
  'your_minimum_32_char_cryptographically_secure_jwt_secret_here'
];

const INSECURE_DB_PASSWORDS = [
  'casethread_password',
  'rootpassword',
  'password',
  '123456',
  'your_secure_db_password_here'
];

/**
 * Validates environment variables for production readiness.
 * @param {Object} [env=process.env]
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateConfig(env = process.env) {
  const errors = [];
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction) {
    // 1. JWT Secret Validation
    if (!env.JWT_SECRET) {
      errors.push('JWT_SECRET is required in production environment.');
    } else if (env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long for production cryptographic security.');
    } else if (INSECURE_DEFAULT_SECRETS.includes(env.JWT_SECRET)) {
      errors.push('JWT_SECRET is set to an insecure default/sample secret key.');
    }

    // 2. Database Password & Credentials
    if (!env.DB_PASSWORD) {
      errors.push('DB_PASSWORD is required in production environment.');
    } else if (INSECURE_DB_PASSWORDS.includes(env.DB_PASSWORD)) {
      errors.push('DB_PASSWORD is set to an insecure default placeholder password.');
    }

    if (!env.DB_USER) {
      errors.push('DB_USER is required in production environment.');
    }
    if (!env.DB_NAME) {
      errors.push('DB_NAME is required in production environment.');
    }
    if (!env.DB_HOST) {
      errors.push('DB_HOST is required in production environment.');
    }

    // 3. Strict MemoryStore & Offline Fallback Block
    if (env.ALLOW_MEMORY_STORE === 'true' || env.USE_MEMORY_STORE === 'true') {
      errors.push('ALLOW_MEMORY_STORE and USE_MEMORY_STORE cannot be enabled in production.');
    }

    // 4. Strict Demo Credentials & Mocking Block
    if (env.ENABLE_DEMO_CREDENTIALS === 'true' || env.REACT_APP_ENABLE_DEMO === 'true') {
      errors.push('Demo credential autofill cannot be enabled in production.');
    }
    if (env.SEED_DEMO_DATA === 'true') {
      errors.push('SEED_DEMO_DATA cannot be enabled in production.');
    }

    // 5. CORS Origin Sanitization
    if (env.CLIENT_ORIGIN === '*') {
      errors.push('CLIENT_ORIGIN cannot be wildcard "*" in production when credentials are enabled.');
    }

    // 6. Evidence Vault & Storage Limits
    if (env.MAX_FILE_SIZE_MB && (isNaN(Number(env.MAX_FILE_SIZE_MB)) || Number(env.MAX_FILE_SIZE_MB) <= 0)) {
      errors.push('MAX_FILE_SIZE_MB must be a positive number.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateConfig,
  INSECURE_DEFAULT_SECRETS,
  INSECURE_DB_PASSWORDS
};
