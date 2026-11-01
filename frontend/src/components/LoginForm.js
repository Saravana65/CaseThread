import React, { useState } from 'react';
import api from '../services/api';

/**
 * @component LoginForm
 * @description Secure officer authentication portal with badge verification, show/hide password, and JWT session establishment.
 */
export default function LoginForm({ onLoginSuccess }) {
  const [badgeNumber, setBadgeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errors = {};
    if (!badgeNumber.trim()) {
      errors.badgeNumber = 'Officer badge number / service ID is required.';
    }
    if (!password) {
      errors.password = 'Officer security passcode is required.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      const res = await api.login(badgeNumber.trim(), password);
      if (res && res.data && res.data.token) {
        // 1. Save returned token
        api.setToken(res.data.token);

        // 2. Retrieve verified officer profile
        let officerProfile = res.data.officer;
        try {
          const profileRes = await api.getProfile();
          if (profileRes && profileRes.data) {
            officerProfile = profileRes.data;
          }
        } catch (pErr) {
          console.warn('Profile sync fallback to login officer payload:', pErr.message);
        }

        // 3. Store authenticated officer and load dashboard
        if (onLoginSuccess) {
          onLoginSuccess(officerProfile);
        }
      } else {
        throw new Error('Authentication rejected: Missing session token in server response.');
      }
    } catch (err) {
      console.error('Login error:', err);
      const msg = err.message || '';
      if (msg.includes('suspended') || msg.includes('deactivated') || msg.includes('ACCOUNT_INACTIVE')) {
        setGeneralError('Account Inactive: Officer credentials have been suspended or deactivated. Contact Bureau Administration.');
      } else if (msg.includes('Invalid badge number') || msg.includes('INVALID_CREDENTIALS')) {
        setGeneralError('Invalid Credentials: Badge number or security passcode incorrect.');
      } else {
        setGeneralError(msg || 'Authentication failed. Please verify credentials or server connectivity.');
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div style={{
      minHeight: 'calc(100vh - 120px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div className="forensic-card accent-red-border" style={{
        maxWidth: '440px',
        width: '100%',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7)',
        padding: '2.5rem 2rem'
      }}>
        {/* Terminal Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            backgroundColor: 'rgba(211, 47, 47, 0.15)',
            border: '1px solid var(--accent-red)',
            marginBottom: '1rem',
            color: 'var(--accent-red)',
            fontSize: '1.6rem',
            boxShadow: '0 0 16px rgba(211, 47, 47, 0.3)'
          }}>
            🛡️
          </div>
          <h2 style={{
            fontSize: '1.4rem',
            fontWeight: '800',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: 'var(--text-primary)'
          }}>
            Officer <span style={{ color: 'var(--accent-red)' }}>Authentication</span>
          </h2>
          <p style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginTop: '0.4rem',
            letterSpacing: '0.5px'
          }}>
            CASETHREAD SECURE INVESTIGATION PORTAL
          </p>
        </div>

        {/* Global Error Banner */}
        {generalError && (
          <div style={{
            backgroundColor: 'rgba(211, 47, 47, 0.15)',
            border: '1px solid var(--accent-red)',
            borderRadius: '4px',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            fontSize: '0.8rem',
            color: '#ff5252',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem'
          }}>
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>⚠️</span>
            <span>{generalError}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: fieldErrors.badgeNumber ? '#ff5252' : 'var(--text-secondary)',
              marginBottom: '0.4rem',
              letterSpacing: '0.5px'
            }}>
              Badge Number / Service ID *
            </label>
            <input
              type="text"
              value={badgeNumber}
              onChange={(e) => {
                setBadgeNumber(e.target.value);
                if (fieldErrors.badgeNumber) {
                  setFieldErrors(prev => ({ ...prev, badgeNumber: null }));
                }
              }}
              placeholder="e.g. DET-8841"
              autoFocus
              className="mono"
              style={{
                width: '100%',
                padding: '0.75rem 0.9rem',
                backgroundColor: 'var(--bg-input)',
                border: `1px solid ${fieldErrors.badgeNumber ? '#ff5252' : 'var(--border-default)'}`,
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => {
                if (!fieldErrors.badgeNumber) e.target.style.borderColor = 'var(--accent-red)';
              }}
              onBlur={(e) => {
                if (!fieldErrors.badgeNumber) e.target.style.borderColor = 'var(--border-default)';
              }}
            />
            {fieldErrors.badgeNumber && (
              <div style={{ fontSize: '0.72rem', color: '#ff5252', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
                {fieldErrors.badgeNumber}
              </div>
            )}
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: fieldErrors.password ? '#ff5252' : 'var(--text-secondary)',
              marginBottom: '0.4rem',
              letterSpacing: '0.5px'
            }}>
              Officer Security Passcode *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors(prev => ({ ...prev, password: null }));
                  }
                }}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '0.75rem 2.8rem 0.75rem 0.9rem',
                  backgroundColor: 'var(--bg-input)',
                  border: `1px solid ${fieldErrors.password ? '#ff5252' : 'var(--border-default)'}`,
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => {
                  if (!fieldErrors.password) e.target.style.borderColor = 'var(--accent-red)';
                }}
                onBlur={(e) => {
                  if (!fieldErrors.password) e.target.style.borderColor = 'var(--border-default)';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  padding: '0.2rem',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={showPassword ? 'Hide passcode' : 'Show passcode'}
                aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {fieldErrors.password && (
              <div style={{ fontSize: '0.72rem', color: '#ff5252', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
                {fieldErrors.password}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              padding: '0.85rem',
              fontSize: '0.9rem',
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? '🔐 Authenticating Credentials...' : 'Sign In to Investigation Terminal'}
          </button>
        </form>


      </div>
    </div>
  );
}
