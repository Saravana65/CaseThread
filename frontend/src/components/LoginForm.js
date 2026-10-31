import React, { useState } from 'react';
import api from '../services/api';

/**
 * @component LoginForm
 * @description Secure officer authentication portal with badge verification and JWT session establishment.
 */
export default function LoginForm({ onLoginSuccess }) {
  const [badgeNumber, setBadgeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedBadge = badgeNumber.trim();
    if (!trimmedBadge) {
      setError('Officer badge number / service ID is required.');
      return;
    }
    if (!password) {
      setError('Officer security passcode is required.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.login(trimmedBadge, password);
      if (res && res.data && res.data.token) {
        api.setToken(res.data.token);

        let officerProfile = res.data.officer;
        try {
          const profileRes = await api.getProfile();
          if (profileRes && profileRes.data) {
            officerProfile = profileRes.data;
          }
        } catch (pErr) {
          console.warn('Profile sync fallback to login officer payload:', pErr.message);
        }

        if (onLoginSuccess) {
          onLoginSuccess(officerProfile);
        }
      } else {
        throw new Error('Authentication failed: Missing token in response payload.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid badge number or password combination.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setBadgeNumber('DET-8841');
    setPassword('Password123!');
    setError(null);
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
            width: '52px',
            height: '52px',
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

        {/* Error Notice */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(211, 47, 47, 0.15)',
            border: '1px solid var(--accent-red)',
            borderRadius: '4px',
            padding: '0.75rem 1rem',
            marginBottom: '1.5rem',
            fontSize: '0.8rem',
            color: '#ff5252',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <span>⚠️</span>
            <span>{error}</span>
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
              color: 'var(--text-secondary)',
              marginBottom: '0.4rem',
              letterSpacing: '0.5px'
            }}>
              Badge Number / Service ID
            </label>
            <input
              type="text"
              value={badgeNumber}
              onChange={(e) => setBadgeNumber(e.target.value)}
              placeholder="e.g. DET-8841"
              autoFocus
              className="mono"
              style={{
                width: '100%',
                padding: '0.75rem 0.9rem',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent-red)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-default)')}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              marginBottom: '0.4rem',
              letterSpacing: '0.5px'
            }}>
              Officer Security Passcode
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              style={{
                width: '100%',
                padding: '0.75rem 0.9rem',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent-red)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-default)')}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              padding: '0.8rem',
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

        {/* Demo Credentials Quick-Fill Aid */}
        <div style={{
          marginTop: '1.75rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Authorized Personnel Demo Credentials:
          </div>
          <button
            type="button"
            onClick={handleFillDemo}
            className="btn-secondary"
            style={{
              fontSize: '0.72rem',
              padding: '0.35rem 0.75rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-orange)',
              borderColor: 'var(--border-default)'
            }}
          >
            📋 Use DET-8841 (Lead Detective)
          </button>
        </div>
      </div>
    </div>
  );
}
