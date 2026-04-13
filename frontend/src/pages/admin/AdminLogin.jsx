import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res  = await fetch(`${API}/api/admin-auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/admin');
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch {
      setError('Cannot connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0f12',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'DM Sans', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .admin-login-bg::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          z-index: 0;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }

        .admin-input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid #252a33;
          border-radius: 12px;
          color: #f0f2f5;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .admin-input:focus {
          border-color: rgba(59,130,246,0.6);
          background: rgba(59,130,246,0.04);
        }
        .admin-input::placeholder { color: #3d4455; }

        .login-btn {
          width: 100%;
          padding: 15px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.3px;
          box-shadow: 0 8px 24px rgba(59,130,246,0.3);
          transition: opacity 0.2s, transform 0.2s;
        }
        .login-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .login-btn:disabled {
          background: #1a1e25;
          color: #3d4455;
          cursor: not-allowed;
          box-shadow: none;
        }

        .eye-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 17px;
          padding: 4px;
          line-height: 1;
          color: #6b7280;
          transition: color 0.2s;
        }
        .eye-btn:hover { color: #9ca3af; }
      `}</style>

      <div className="admin-login-bg" style={{ position: 'fixed', inset: 0, zIndex: 0 }} />

      <div style={{
        position: 'fixed', top: '-120px', right: '-120px',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{
        position: 'fixed', bottom: '-100px', left: '-100px',
        width: '350px', height: '350px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* LOGIN CARD */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: '420px',
        background: '#13161b',
        border: '1px solid #252a33',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.06)',
        animation: 'slideUp 0.45s cubic-bezier(.4,0,.2,1)',
      }}>

        {/* Top accent bar */}
        <div style={{
          height: '3px',
          background: 'linear-gradient(90deg, transparent, #3b82f6, #7c3aed, transparent)',
        }} />

        {/* Header */}
        <div style={{
          padding: '36px 36px 28px',
          borderBottom: '1px solid #252a33',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px',
            background: 'linear-gradient(135deg, #1e3a5f, #1d4ed8)',
            borderRadius: '16px',
            fontSize: '24px',
            marginBottom: '18px',
            boxShadow: '0 8px 24px rgba(59,130,246,0.25)',
            border: '1px solid rgba(59,130,246,0.2)',
          }}>🛡️</div>

          <h1 style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: '24px', fontWeight: 800,
            color: '#f0f2f5', letterSpacing: '-0.5px',
            margin: 0,
          }}>Admin Access</h1>
          <p style={{
            color: '#6b7280', fontSize: '13px',
            marginTop: '6px', letterSpacing: '0.3px',
          }}>Two Rivers Mall · Restricted Area</p>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            marginTop: '14px',
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: '20px', padding: '5px 12px',
            fontSize: '12px', color: '#22c55e',
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#22c55e', animation: 'pulse 1.8s infinite',
            }} />
            System Online
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: '28px 36px 36px' }}>

          {/* Username */}
          <div style={{ marginBottom: '18px' }}>
            <label style={labelStyle}>Username</label>
            <input
              className="admin-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter admin username"
              autoComplete="username"
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="admin-input"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter admin password"
                autoComplete="current-password"
                style={{ paddingRight: '44px' }}
              />
              <button className="eye-btn" onClick={() => setShowPass(p => !p)}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: '18px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#fca5a5',
              fontSize: '13px',
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <button className="login-btn" onClick={handleLogin} disabled={loading}>
            {loading ? 'Authenticating...' : 'Access Dashboard →'}
          </button>

          <p style={{
            textAlign: 'center', marginTop: '20px',
            fontSize: '12px', color: '#3d4455',
          }}>
            Authorised personnel only · Two Rivers HQ
          </p>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: '#6b7280',
  marginBottom: '8px',
  letterSpacing: '1px',
  textTransform: 'uppercase',
};
