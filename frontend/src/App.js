import { useState } from 'react';
import {
  BrowserRouter as Router, Routes, Route, Navigate, useNavigate,
} from 'react-router-dom';

import DriverPortal   from './pages/driver/DriverPortal';
import GuardPortal    from './pages/watchman/GuardPortal';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLogin     from './pages/admin/AdminLogin';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const PHONE_LIMITS = { '+254': 9, '+1': 10, '+44': 10 };

// ── Protected route: only lets admin token through ──
function AdminRoute({ children }) {
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || '{}');
  if (!token || user.role !== 'admin') return <Navigate to="/admin-login" replace />;
  return children;
}

function MainPage() {
  const navigate = useNavigate();

  // ── Main form state ──
  const [tab, setTab]                         = useState('login');
  const [name, setName]                       = useState('');
  const [countryCode, setCountryCode]         = useState('+254');
  const [phoneNumber, setPhoneNumber]         = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole]       = useState('driver');
  const [plateNumber, setPlateNumber]         = useState('');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [showPass, setShowPass]               = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);

  // ── Forgot password flow state ──
  const [fpStep, setFpStep]       = useState(null);
  const [fpCC, setFpCC]           = useState('+254');
  const [fpPhone, setFpPhone]     = useState('');
  const [fpOtp, setFpOtp]         = useState('');
  const [fpNewPass, setFpNewPass] = useState('');
  const [fpConfirm, setFpConfirm] = useState('');
  const [fpShowPass, setFpShowPass] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError]     = useState('');
  const [fpSuccess, setFpSuccess] = useState('');

  const maxDigits       = PHONE_LIMITS[countryCode] || 10;
  const fullPhone       = countryCode + phoneNumber;
  const fpMaxDigits     = PHONE_LIMITS[fpCC] || 10;

  const hasMinLength    = password.length >= 8;
  const hasUppercase    = /[A-Z]/.test(password);
  const hasNumber       = /[0-9]/.test(password);
  const hasSpecial      = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecial;

  const showRegister = !(selectedRole === 'watchman');

  const resetFp = () => {
    setFpStep(null); setFpPhone(''); setFpCC('+254');
    setFpOtp(''); setFpNewPass(''); setFpConfirm('');
    setFpError(''); setFpSuccess(''); setFpLoading(false);
  };

  // ── Step 1: Check phone exists ──
  const handleFpSendOtp = async () => {
    if (fpPhone.length !== fpMaxDigits) { setFpError(`Enter a valid ${fpMaxDigits}-digit phone number`); return; }
    setFpLoading(true); setFpError('');
    try {
      const res  = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fpCC + fpPhone }),
      });
      const data = await res.json();
      if (res.ok) { setFpStep('otp'); }
      else         { setFpError(data.message || 'Phone number not found'); }
    } catch { setFpError('Cannot connect to backend'); }
    finally  { setFpLoading(false); }
  };

  // ── Step 2: Verify OTP ──
  const handleFpVerifyOtp = async () => {
    if (fpOtp.length !== 4) { setFpError('Enter the 4-digit OTP'); return; }
    setFpLoading(true); setFpError('');
    try {
      const res  = await fetch(`${API}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fpCC + fpPhone, otp: fpOtp }),
      });
      const data = await res.json();
      if (res.ok) { setFpStep('newpass'); }
      else         { setFpError(data.message || 'Invalid OTP'); }
    } catch { setFpError('Cannot connect to backend'); }
    finally  { setFpLoading(false); }
  };

  // ── Step 3: Set new password ──
  const handleFpReset = async () => {
    if (fpNewPass.length < 8)    { setFpError('Password must be at least 8 characters'); return; }
    if (fpNewPass !== fpConfirm) { setFpError('Passwords do not match'); return; }
    setFpLoading(true); setFpError('');
    try {
      const res  = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fpCC + fpPhone, newPassword: fpNewPass }),
      });
      const data = await res.json();
      if (res.ok) {
        setFpSuccess('✅ Password reset! You can now sign in.');
        setTimeout(() => resetFp(), 2500);
      } else { setFpError(data.message || 'Reset failed'); }
    } catch { setFpError('Cannot connect to backend'); }
    finally  { setFpLoading(false); }
  };

  // ── Main submit ──
  const handleSubmit = async () => {
    if (!phoneNumber || !password) { setError('Phone and password are required'); return; }
    if (tab === 'register') {
      if (!name)                        { setError('Full name is required'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match'); return; }
      if (!isPasswordValid)             { setError('Please satisfy all password requirements'); return; }
      if (selectedRole === 'driver' && !plateNumber.trim()) { setError('Car plate number is required for drivers'); return; }
    }
    setLoading(true); setError('');
    const url = tab === 'login' ? `${API}/api/auth/login` : `${API}/api/auth/register`;
    try {
      const res  = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        tab === 'register' ? name : undefined,
          phone:       fullPhone,
          password,
          role:        selectedRole,
          plateNumber: tab === 'register' && selectedRole === 'driver' ? plateNumber.toUpperCase() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate(selectedRole === 'driver' ? '/driver' : '/watchman');
      } else { setError(data.message || 'Failed'); }
    } catch { setError('Cannot connect to backend'); }
    finally  { setLoading(false); }
  };

  const stepIndex = { phone: 0, otp: 1, newpass: 2 };

  const ForgotPasswordView = () => (
    <div style={{ padding: '28px 36px 36px' }}>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
        {[0, 1, 2].map((i) => {
          const active = stepIndex[fpStep] >= i;
          const passed = stepIndex[fpStep] >  i;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, transition: 'all 0.3s',
                background: active ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : 'rgba(255,255,255,0.06)',
                color: active ? '#fff' : 'rgba(255,255,255,0.25)',
                border: active ? '2px solid rgba(59,130,246,0.4)' : '2px solid rgba(255,255,255,0.08)',
                boxShadow: active ? '0 4px 12px rgba(59,130,246,0.3)' : 'none',
              }}>{passed ? '✓' : i + 1}</div>
              {i < 2 && (
                <div style={{ width: '36px', height: '2px', borderRadius: '1px', transition: 'all 0.3s',
                  background: stepIndex[fpStep] > i ? '#3b82f6' : 'rgba(255,255,255,0.08)' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: Phone ── */}
      {fpStep === 'phone' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>📱</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, color: '#fff' }}>Verify Your Phone</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>Enter the phone you registered with</div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Phone Number</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select value={fpCC} onChange={e => { setFpCC(e.target.value); setFpPhone(''); }} style={{ ...inputStyle, width: 'auto' }}>
                <option value="+254">🇰🇪 +254</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
              </select>
              <input type="tel" value={fpPhone} placeholder={`${fpMaxDigits} digits`}
                onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= fpMaxDigits) setFpPhone(v); }}
                style={{ ...inputStyle, flex: 1 }}
                onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '5px' }}>{fpPhone.length}/{fpMaxDigits} digits entered</div>
          </div>
        </div>
      )}

      {/* ── STEP 2: OTP ── */}
      {fpStep === 'otp' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔐</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, color: '#fff' }}>Enter OTP</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>
              Code sent to <span style={{ color: '#60a5fa', fontWeight: 600 }}>{fpCC + fpPhone}</span>
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>One-Time Password</label>
            <input type="text" value={fpOtp} maxLength={4}
              onChange={e => setFpOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="• • • •"
              style={{ ...inputStyle, fontSize: '32px', fontWeight: 800, textAlign: 'center', letterSpacing: '16px', paddingTop: '16px', paddingBottom: '16px' }}
              onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
              onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
          </div>
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '12px', color: '#fbbf24', textAlign: 'center', marginBottom: '4px' }}>
            💡 Demo OTP is <strong style={{ letterSpacing: '3px' }}>1234</strong>
          </div>
        </div>
      )}

      {/* ── STEP 3: New Password ── */}
      {fpStep === 'newpass' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔑</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, color: '#fff' }}>Set New Password</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>Choose a strong password</div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>New Password</label>
            <div style={{ position: 'relative' }}>
              <input type={fpShowPass ? 'text' : 'password'} value={fpNewPass}
                onChange={e => setFpNewPass(e.target.value)}
                placeholder="At least 8 characters"
                style={{ ...inputStyle, paddingRight: '44px' }}
                onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
              <button onClick={() => setFpShowPass(p => !p)} style={eyeBtn}>{fpShowPass ? '🙈' : '👁️'}</button>
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Confirm New Password</label>
            <input type="password" value={fpConfirm}
              onChange={e => setFpConfirm(e.target.value)}
              placeholder="Repeat password"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
              onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
          </div>
        </div>
      )}

      {/* Messages */}
      {fpError   && <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '12px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: '13px', textAlign: 'center' }}>{fpError}</div>}
      {fpSuccess && <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '12px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: '13px', textAlign: 'center' }}>{fpSuccess}</div>}

      {/* Action button */}
      {!fpSuccess && (
        <button
          onClick={fpStep === 'phone' ? handleFpSendOtp : fpStep === 'otp' ? handleFpVerifyOtp : handleFpReset}
          disabled={fpLoading}
          style={{
            width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
            background: fpLoading ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
            color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '15px', fontWeight: 600,
            cursor: fpLoading ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 24px rgba(59,130,246,0.3)', marginBottom: '10px',
          }}>
          {fpLoading ? 'Please wait...'
            : fpStep === 'phone'   ? 'Send OTP →'
            : fpStep === 'otp'     ? 'Verify OTP →'
            : 'Reset Password →'}
        </button>
      )}

      <button onClick={resetFp} style={{ width: '100%', padding: '11px', borderRadius: '14px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Sans',sans-serif", fontSize: '13px', cursor: 'pointer' }}>
        ← Back to Sign In
      </button>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh', width: '100%', position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden',
    }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: "url('/Images/login-bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(135deg,rgba(5,10,25,0.82),rgba(10,20,50,0.75))', zIndex: 1 }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 10, width: '100%', maxWidth: '440px',
        background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '28px', overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
        animation: 'slideUp 0.5s cubic-bezier(.4,0,.2,1)',
      }}>

        {/* Header */}
        <div style={{ padding: '36px 36px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', borderRadius: '16px', fontSize: '22px', marginBottom: '16px', boxShadow: '0 8px 24px rgba(59,130,246,0.4)' }}>🅿️</div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '26px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>Two Rivers Mall</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '4px', letterSpacing: '1px', textTransform: 'uppercase' }}>Smart Parking System</p>
        </div>

        {/* ── FORGOT PASSWORD FLOW ── */}
        {fpStep !== null ? <ForgotPasswordView /> : (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => setTab('login')} style={{ flex: 1, padding: '16px', background: 'transparent', border: 'none', color: tab === 'login' ? '#fff' : 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', fontWeight: tab === 'login' ? 600 : 400, cursor: 'pointer', borderBottom: tab === 'login' ? '2px solid #3b82f6' : '2px solid transparent', transition: 'all 0.2s' }}>Sign In</button>
              {showRegister && (
                <button onClick={() => setTab('register')} style={{ flex: 1, padding: '16px', background: 'transparent', border: 'none', color: tab === 'register' ? '#fff' : 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', fontWeight: tab === 'register' ? 600 : 400, cursor: 'pointer', borderBottom: tab === 'register' ? '2px solid #3b82f6' : '2px solid transparent', transition: 'all 0.2s' }}>Register</button>
              )}
            </div>

            {/* Form */}
            <div style={{ padding: '28px 36px 36px' }}>

              {tab === 'register' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Full Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Bruce Wayne" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                    onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
              )}

              {/* Phone */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Phone Number</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select value={countryCode} onChange={e => { setCountryCode(e.target.value); setPhoneNumber(''); }} style={{ ...inputStyle, width: 'auto', paddingRight: '12px' }}>
                    <option value="+254">🇰🇪 +254</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                  </select>
                  <input type="tel" value={phoneNumber}
                    onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= maxDigits) setPhoneNumber(v); }}
                    placeholder={`${'0'.repeat(maxDigits)} (${maxDigits} digits)`} maxLength={maxDigits}
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                    onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '5px' }}>{phoneNumber.length}/{maxDigits} digits entered</div>
              </div>

              {/* Car Plate */}
              {tab === 'register' && selectedRole === 'driver' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Car Plate Number</label>
                  <input type="text" value={plateNumber} onChange={e => setPlateNumber(e.target.value.toUpperCase())} placeholder="e.g. KCA 123A"
                    style={{ ...inputStyle, letterSpacing: '3px', fontWeight: 600 }}
                    onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                    onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '5px' }}>Used to identify your vehicle in the parking system</div>
                </div>
              )}

              {/* Password */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" style={{ ...inputStyle, paddingRight: '44px' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                    onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                  <button onClick={() => setShowPass(p => !p)} style={eyeBtn}>{showPass ? '🙈' : '👁️'}</button>
                </div>
                {tab === 'register' && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                      [hasMinLength, 'At least 8 characters'],
                      [hasUppercase, 'One uppercase letter (A-Z)'],
                      [hasNumber,    'One number (0-9)'],
                      [hasSpecial,   'One special character (!@#$ etc)'],
                    ].map(([ok, lbl]) => (
                      <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: ok ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
                        <span>{ok ? '✅' : '○'}</span> {lbl}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              {tab === 'register' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ ...inputStyle, paddingRight: '44px' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                      onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                    <button onClick={() => setShowConfirm(p => !p)} style={eyeBtn}>{showConfirm ? '🙈' : '👁️'}</button>
                  </div>
                </div>
              )}

              {/* Role selector */}
              <div style={{ marginBottom: tab === 'login' ? '8px' : '24px' }}>
                <label style={labelStyle}>I am a</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    { value: 'driver',   icon: '🚗', label: 'Driver'  },
                    { value: 'watchman', icon: '👮', label: 'Guard'   },
                  ].map(r => (
                    <button key={r.value} onClick={() => { setSelectedRole(r.value); setPlateNumber(''); if (r.value === 'watchman') setTab('login'); }} style={{
                      padding: '16px', borderRadius: '14px',
                      border: selectedRole === r.value ? '2px solid rgba(59,130,246,0.8)' : '2px solid rgba(255,255,255,0.08)',
                      background: selectedRole === r.value ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                      color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                      transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                      boxShadow: selectedRole === r.value ? '0 0 20px rgba(59,130,246,0.2)' : 'none',
                    }}>
                      <span style={{ fontSize: '24px' }}>{r.icon}</span>
                      {r.label}
                      {r.value === 'watchman' && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>Login only</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Forgot password link */}
              {tab === 'login' && (
                <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                  <button onClick={() => { setFpStep('phone'); setFpError(''); }} style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", padding: 0 }}>
                    Forgot password?
                  </button>
                </div>
              )}

              {error && <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: '13px', textAlign: 'center' }}>{error}</div>}

              <button onClick={handleSubmit} disabled={loading || (tab === 'register' && !isPasswordValid)} style={{
                width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
                background: loading || (tab === 'register' && !isPasswordValid) ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '15px', fontWeight: 600,
                cursor: loading || (tab === 'register' && !isPasswordValid) ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 24px rgba(59,130,246,0.35)', transition: 'all 0.2s',
              }}>
                {loading ? 'Processing...' : tab === 'login' ? 'Sign In →' : 'Create Account →'}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        input::placeholder { color: rgba(255,255,255,0.2); }
        select option { background:#1a1e2e; color:#fff; }
        * { box-sizing:border-box; }
      `}</style>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: '12px', fontWeight: 500,
  color: 'rgba(255,255,255,0.5)', marginBottom: '8px',
  letterSpacing: '0.5px', textTransform: 'uppercase',
};
const inputStyle = {
  width: '100%', padding: '13px 16px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px', color: '#fff',
  fontFamily: "'DM Sans',sans-serif", fontSize: '14px',
  outline: 'none', transition: 'border-color 0.2s',
};
const eyeBtn = {
  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontSize: '16px', padding: '4px', lineHeight: 1,
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"            element={<MainPage />}       />
        <Route path="/driver"      element={<DriverPortal />}   />
        <Route path="/watchman"    element={<GuardPortal />}    />
        <Route path="/admin-login" element={<AdminLogin />}     />
        <Route path="/admin"       element={
          <AdminRoute><AdminDashboard /></AdminRoute>
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
