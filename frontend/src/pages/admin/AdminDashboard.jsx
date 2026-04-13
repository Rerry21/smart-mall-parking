import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// ══════════════════════════════════════════
// GUARDS SECTION COMPONENT
// ══════════════════════════════════════════
function GuardsSection() {
  const [guards, setGuards]             = useState([]);
  const [loading, setLoading]           = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [editGuard, setEditGuard]       = useState(null);
  const [msg, setMsg]                   = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Phone: separate country code + digits (same as login page)
  const [countryCode, setCountryCode]   = useState('+254');
  const [phoneDigits, setPhoneDigits]   = useState('');
  const PHONE_LIMITS = { '+254': 9, '+1': 10, '+44': 10 };
  const maxDigits = PHONE_LIMITS[countryCode] || 10;

  // Password visibility toggles
  const [showPass, setShowPass]           = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);

  const emptyForm = { name: '', nationalId: '', assignedFloor: 'Level 1', password: '', confirmPassword: '', photo: null };
  const [form, setForm] = useState(emptyForm);

  // Password rules (same as login page)
  const hasMinLength = form.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(form.password);
  const hasNumber    = /[0-9]/.test(form.password);
  const hasSpecial   = /[!@#$%^&*(),.?":{}|<>]/.test(form.password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecial;
  const passwordsMatch  = form.password === form.confirmPassword && form.confirmPassword !== '';

  const fetchGuards = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/admin/guards`);
      const data = await res.json();
      if (data.success) setGuards(data.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchGuards(); }, []);

  const openAdd = () => {
    setEditGuard(null);
    setForm(emptyForm);
    setPhoneDigits('');
    setCountryCode('+254');
    setPhotoPreview(null);
    setShowPass(false);
    setShowConfirm(false);
    setMsg(null);
    setShowForm(true);
  };

  const openEdit = (g) => {
    setEditGuard(g);
    // Parse stored phone back into country code + digits
    let cc = '+254', digits = '';
    if (g.phone) {
      const match = g.phone.match(/^(\+\d{1,3})(\d+)$/);
      if (match) { cc = match[1]; digits = match[2]; }
      else digits = g.phone;
    }
    setCountryCode(cc);
    setPhoneDigits(digits);
    setForm({ name: g.name, nationalId: g.nationalId, assignedFloor: g.assignedFloor || 'Level 1', password: '', confirmPassword: '', photo: null });
    setPhotoPreview(g.photoUrl ? `${API}${g.photoUrl}` : null);
    setShowPass(false);
    setShowConfirm(false);
    setMsg(null);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditGuard(null); setMsg(null); setPhotoPreview(null); setPhoneDigits(''); };

  const handleChange = (e) => {
    if (e.target.name === 'photo') {
      const file = e.target.files[0];
      setForm(f => ({ ...f, photo: file }));
      if (file) setPhotoPreview(URL.createObjectURL(file));
    } else if (e.target.name === 'nationalId') {
      // National ID: digits only, max 8
      const val = e.target.value.replace(/\D/g, '').slice(0, 8);
      setForm(f => ({ ...f, nationalId: val }));
    } else {
      setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    }
  };

  const handleSubmit = async () => {
    const fullPhone = countryCode + phoneDigits;

    if (!form.name || phoneDigits.length < maxDigits || !form.nationalId) {
      setMsg({ type: 'error', text: `Name, a full ${maxDigits}-digit phone number, and national ID are required.` });
      return;
    }
    if (form.nationalId.length !== 8) {
      setMsg({ type: 'error', text: 'National ID must be exactly 8 digits.' });
      return;
    }
    // For new guards password is required and must be valid
    if (!editGuard) {
      if (!isPasswordValid) {
        setMsg({ type: 'error', text: 'Password does not meet all requirements.' });
        return;
      }
      if (!passwordsMatch) {
        setMsg({ type: 'error', text: 'Passwords do not match.' });
        return;
      }
    }
    // For edits, only validate password if they typed one
    if (editGuard && form.password) {
      if (!isPasswordValid) {
        setMsg({ type: 'error', text: 'New password does not meet all requirements.' });
        return;
      }
      if (!passwordsMatch) {
        setMsg({ type: 'error', text: 'Passwords do not match.' });
        return;
      }
    }

    setSubmitting(true);
    setMsg(null);
    try {
      const body = new FormData();
      body.append('name', form.name);
      body.append('phone', fullPhone);
      body.append('nationalId', form.nationalId);
      body.append('assignedFloor', form.assignedFloor);
      if (form.password) body.append('password', form.password);
      if (form.photo)    body.append('photo', form.photo);

      const url    = editGuard ? `${API}/api/admin/guards/${editGuard._id}` : `${API}/api/admin/guards`;
      const method = editGuard ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, body });
      const data   = await res.json();

      if (data.success) {
        setMsg({ type: 'ok', text: editGuard ? 'Guard updated successfully!' : 'Guard registered successfully!' });
        setTimeout(() => { closeForm(); fetchGuards(); }, 900);
      } else {
        setMsg({ type: 'error', text: data.error || 'Operation failed.' });
      }
    } catch (e) {
      setMsg({ type: 'error', text: 'Network error. Is the backend running?' });
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    try {
      const res  = await fetch(`${API}/api/admin/guards/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { setDeleteConfirm(null); fetchGuards(); }
      else alert(data.error || 'Delete failed.');
    } catch (e) { alert('Network error.'); }
  };

  // ── Styles ──
  const inp = {
    width: '100%', background: '#1a1e25', border: '1px solid #252a33',
    borderRadius: '10px', padding: '10px 14px', color: '#f0f2f5',
    fontFamily: "'DM Sans',sans-serif", fontSize: '14px',
    boxSizing: 'border-box', outline: 'none',
  };
  const lbl = { fontSize: '12px', color: '#9ca3af', marginBottom: '6px', display: 'block', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 800 }}>Guards</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{guards.length} registered guard{guards.length !== 1 ? 's' : ''}</div>
        </div>
        {!showForm && (
          <button onClick={openAdd} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 22px', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            + Register Guard
          </button>
        )}
      </div>

      {/* ── FORM (Add / Edit) ── */}
      {showForm && (
        <div style={{ background: '#13161b', border: '1px solid #3b82f6', borderRadius: '18px', padding: '28px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700 }}>
              {editGuard ? 'Edit Guard' : 'Register New Guard'}
            </div>
            <button onClick={closeForm} style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>

          {/* Message */}
          {msg && (
            <div style={{ marginBottom: '18px', padding: '11px 16px', borderRadius: '10px', background: msg.type === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: msg.type === 'ok' ? '#4ade80' : '#f87171', fontSize: '14px' }}>
              {msg.type === 'ok' ? '✅' : '❌'} {msg.text}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            {/* Name */}
            <div>
              <label style={lbl}>Full Name *</label>
              <input name="name" type="text" placeholder="e.g. John Kamau" value={form.name} onChange={handleChange} style={inp} />
            </div>

            {/* Phone — same as login page */}
            <div>
              <label style={lbl}>Phone Number *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={countryCode}
                  onChange={e => { setCountryCode(e.target.value); setPhoneDigits(''); }}
                  style={{ ...inp, width: 'auto', paddingRight: '10px', flexShrink: 0, cursor: 'pointer' }}
                >
                  <option value="+254">🇰🇪 +254</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                </select>
                <input
                  type="tel"
                  value={phoneDigits}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val.length <= maxDigits) setPhoneDigits(val);
                  }}
                  placeholder={`${'0'.repeat(maxDigits)}`}
                  maxLength={maxDigits}
                  style={{ ...inp, flex: 1 }}
                />
              </div>
              <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '4px' }}>
                {phoneDigits.length}/{maxDigits} digits entered
              </div>
            </div>

            {/* National ID — 8 digits max */}
            <div>
              <label style={lbl}>National ID * (8 digits)</label>
              <input
                name="nationalId" type="text" placeholder="e.g. 12345678"
                value={form.nationalId} onChange={handleChange}
                maxLength={8} style={inp}
              />
              <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '4px' }}>
                {form.nationalId.length}/8 digits
              </div>
            </div>

            {/* Assigned Floor */}
            <div>
              <label style={lbl}>Assigned Floor *</label>
              <select name="assignedFloor" value={form.assignedFloor} onChange={handleChange} style={{ ...inp, cursor: 'pointer' }}>
                <option value="Level 1">Level 1 — Section A</option>
                <option value="Level 2">Level 2 — Section B</option>
                <option value="Level 3">Level 3 — Section C</option>
              </select>
            </div>

            {/* Password with eye toggle + requirements */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>{editGuard ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
              <div style={{ position: 'relative' }}>
                <input
                  name="password" type={showPass ? 'text' : 'password'}
                  placeholder={editGuard ? 'Leave blank to keep current password' : 'Set a strong password'}
                  value={form.password} onChange={handleChange}
                  style={{ ...inp, paddingRight: '44px' }}
                />
                <button
                  type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', lineHeight: 1 }}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
              {/* Password requirements — show when typing */}
              {(form.password.length > 0 || !editGuard) && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {[
                    [hasMinLength, 'At least 8 characters'],
                    [hasUppercase, 'One uppercase letter (A-Z)'],
                    [hasNumber,    'One number (0-9)'],
                    [hasSpecial,   'One special character (!@#$ etc)'],
                  ].map(([ok, text]) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: ok ? '#4ade80' : '#4b5563' }}>
                      <span>{ok ? '✅' : '○'}</span> {text}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password with eye toggle */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Confirm Password {editGuard && !form.password ? '(only if changing password)' : '*'}</label>
              <div style={{ position: 'relative' }}>
                <input
                  name="confirmPassword" type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={form.confirmPassword} onChange={handleChange}
                  style={{ ...inp, paddingRight: '44px', borderColor: form.confirmPassword ? (passwordsMatch ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)') : '#252a33' }}
                />
                <button
                  type="button" onClick={() => setShowConfirm(p => !p)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', lineHeight: 1 }}
                >
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
              {form.confirmPassword.length > 0 && (
                <div style={{ fontSize: '12px', marginTop: '5px', color: passwordsMatch ? '#4ade80' : '#f87171' }}>
                  {passwordsMatch ? '✅ Passwords match' : '❌ Passwords do not match'}
                </div>
              )}
            </div>

            {/* Passport Photo */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Passport Photo (optional)</label>
              <input type="file" name="photo" accept="image/*" onChange={handleChange} style={{ ...inp, padding: '8px 14px', cursor: 'pointer' }} />
            </div>
          </div>

          {/* Photo Preview */}
          {photoPreview && (
            <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img src={photoPreview} alt="preview" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #3b82f6' }} />
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Photo preview</div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              onClick={handleSubmit} disabled={submitting}
              style={{ background: submitting ? '#374151' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 32px', fontFamily: "'DM Sans',sans-serif", fontSize: '15px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'Saving...' : editGuard ? 'Save Changes' : 'Register Guard'}
            </button>
            <button onClick={closeForm} style={{ background: 'transparent', color: '#6b7280', border: '1px solid #252a33', borderRadius: '12px', padding: '12px 24px', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#13161b', border: '1px solid #ef4444', borderRadius: '18px', padding: '32px', maxWidth: '380px', width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>Remove Guard?</div>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '24px' }}>This will permanently delete the guard's account. They will no longer be able to log in.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Yes, Remove</button>
              <button onClick={() => setDeleteConfirm(null)} style={{ background: '#1a1e25', color: '#f0f2f5', border: '1px solid #252a33', borderRadius: '10px', padding: '10px 24px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── GUARDS LIST ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>👮</div>
          <p>Loading guards...</p>
        </div>
      ) : guards.length === 0 ? (
        <div style={{ background: '#13161b', border: '1px solid #252a33', borderRadius: '18px', padding: '60px', textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>👮</div>
          <p style={{ fontSize: '15px', fontWeight: 500 }}>No guards registered yet</p>
          <p style={{ fontSize: '13px', marginTop: '8px' }}>Click "Register Guard" to add your first guard</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '16px' }}>
          {guards.map(g => (
            <div key={g._id} style={{ background: '#13161b', border: '1px solid #252a33', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#353c4a'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#252a33'}>
              {/* Top row: avatar + info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {g.photoUrl
                  ? <img src={`${API}${g.photoUrl}`} alt={g.name} style={{ width: '58px', height: '58px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b82f6', flexShrink: 0 }} />
                  : <div style={{ width: '58px', height: '58px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>👮</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                  <div style={{ fontSize: '11px', background: 'rgba(59,130,246,0.12)', color: '#60a5fa', padding: '2px 8px', borderRadius: '20px', display: 'inline-block', marginTop: '4px', fontWeight: 600 }}>WATCHMAN</div>
                </div>
              </div>

              {/* Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ fontSize: '13px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📱</span> {g.phone}
                </div>
                <div style={{ fontSize: '13px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🪪</span> ID: {g.nationalId}
                </div>
                <div style={{ fontSize: '13px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🏢</span> {g.assignedFloor || 'Not assigned'}
                </div>
                <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '2px' }}>
                  Registered {new Date(g.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button onClick={() => openEdit(g)} style={{ flex: 1, background: '#1a1e25', color: '#f0f2f5', border: '1px solid #252a33', borderRadius: '9px', padding: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                  ✏️ Edit
                </button>
                <button onClick={() => setDeleteConfirm(g._id)} style={{ flex: 1, background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '9px', padding: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                  🗑️ Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// MAIN ADMIN DASHBOARD
// ══════════════════════════════════════════
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav]   = useState('overview');
  const [liveDate, setLiveDate]     = useState('');
  const [user, setUser]             = useState({ name: 'Admin' });
  const [stats, setStats]           = useState(null);
  const [slots, setSlots]           = useState([]);
  const barChartRef = useRef(null);
  const activityRef = useRef(null);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setLiveDate(
        d.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        + ' · '
        + d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res  = await fetch(`${API}/api/admin/dashboard`);
        const data = await res.json();
        if (data.success) setStats(data.dashboard);
      } catch (err) { console.error('Failed to fetch stats:', err); }
    };
    fetchStats();
    const id = setInterval(fetchStats, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (activeNav !== 'slots') return;
    const fetchSlots = async () => {
      try {
        const res  = await fetch(`${API}/api/slots`);
        const data = await res.json();
        if (data.success) setSlots(data.data);
      } catch (err) { console.error('Failed to fetch slots:', err); }
    };
    fetchSlots();
  }, [activeNav]);

  useEffect(() => {
    if (activeNav !== 'overview' || !barChartRef.current) return;
    const hours   = ['6am','7am','8am','9am','10a','11a','12p','1pm','2pm','3pm','4pm','5pm','6pm'];
    const occData = [10, 25, 62, 90, 118, 142, 162, 155, 138, 128, 115, 90, 68];
    const total   = stats?.totalSlots || 248;
    const maxVal  = Math.max(...occData);
    barChartRef.current.innerHTML = '';
    hours.forEach((h, i) => {
      const occ  = occData[i];
      const avl  = total - occ;
      const occH = Math.round((occ / maxVal) * 140);
      const avlH = Math.round((avl / maxVal) * 80);
      const g = document.createElement('div');
      g.className = 'bar-group';
      g.innerHTML = `<div class="bars"><div class="bar occ" style="height:${occH}px"></div><div class="bar avail" style="height:${avlH}px"></div></div><div class="bar-label">${h}</div>`;
      barChartRef.current.appendChild(g);
    });
  }, [activeNav, stats]);

  useEffect(() => {
    if (activeNav !== 'overview' || !activityRef.current) return;
    const activities = [
      { type:'entry',   icon:'🟢', action:'Vehicle entered',         detail:'Slot P203 · Level 2',   time:'2 min ago'  },
      { type:'payment', icon:'💳', action:'M-Pesa payment received', detail:'KSh 200 · KBA 123X',     time:'5 min ago'  },
      { type:'exit',    icon:'🔴', action:'Vehicle exited',          detail:'Slot P101 · Level 1',    time:'9 min ago'  },
      { type:'alert',   icon:'⚠️', action:'Slot P302 flagged',       detail:'Overstay · Level 3',     time:'14 min ago' },
      { type:'entry',   icon:'🟢', action:'Vehicle entered',         detail:'Slot P102 · Level 1',    time:'18 min ago' },
      { type:'payment', icon:'💳', action:'M-Pesa payment received', detail:'KSh 200 · KCB 881Z',     time:'22 min ago' },
    ];
    activityRef.current.innerHTML = '';
    activities.forEach(a => {
      const item = document.createElement('div');
      item.className = 'act-item';
      item.innerHTML = `<div class="act-dot ${a.type}">${a.icon}</div><div><div class="act-action">${a.action}</div><div class="act-meta">${a.detail} · ${a.time}</div></div>`;
      activityRef.current.appendChild(item);
    });
  }, [activeNav]);

  const handleLogout = () => {
    if (window.confirm('Log out of admin panel?')) {
      localStorage.clear();
      navigate('/');
    }
  };

  const navSections = [
    { section: 'Main', items: [
      { id: 'overview',  icon: '🏠', label: 'Overview'      },
      { id: 'slots',     icon: '🅿️', label: 'Parking Slots' },
      { id: 'payments',  icon: '💳', label: 'Payments'      },
      { id: 'reports',   icon: '📊', label: 'Reports'       },
    ]},
    { section: 'Management', items: [
      { id: 'guards',    icon: '👮', label: 'Guards'        },
      { id: 'drivers',   icon: '🚗', label: 'Drivers'       },
      { id: 'alerts',    icon: '🔔', label: 'Alerts', badge: stats?.unpaidFines || 0 },
    ]},
  ];

  const statCards = stats ? [
    { icon: '🅿️', val: stats.totalSlots,           label: 'Total Parking Slots',  delta: `${stats.availableSlots} available`,   dt: 'neutral', glow: '#3b82f6' },
    { icon: '🚗', val: stats.occupiedSlots,          label: 'Currently Occupied',    delta: stats.occupancyRate + ' occupancy',    dt: 'warn',    glow: '#ef4444' },
    { icon: '💰', val: `KSh ${stats.totalRevenue}`,  label: 'Total Revenue',         delta: `${stats.activeBookings} active now`,  dt: 'up',      glow: '#22c55e' },
    { icon: '👮', val: stats.unpaidFines,            label: 'Unpaid Fines',          delta: `KSh ${stats.totalFines} total fines`, dt: 'warn',    glow: '#f59e0b' },
  ] : [
    { icon: '🅿️', val: '—', label: 'Total Parking Slots',  delta: 'Loading...', dt: 'neutral', glow: '#3b82f6' },
    { icon: '🚗', val: '—', label: 'Currently Occupied',    delta: 'Loading...', dt: 'warn',    glow: '#ef4444' },
    { icon: '💰', val: '—', label: 'Total Revenue',         delta: 'Loading...', dt: 'up',      glow: '#22c55e' },
    { icon: '👮', val: '—', label: 'Unpaid Fines',          delta: 'Loading...', dt: 'warn',    glow: '#f59e0b' },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: '#0d0f12', color: '#f0f2f5', display: 'flex', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#252a33; border-radius:99px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.3} }

        .stat-card { transition:transform 0.2s,border-color 0.2s; cursor:default; animation:fadeUp 0.45s ease both; }
        .stat-card:hover { transform:translateY(-3px); border-color:#353c4a !important; }
        .stat-card:nth-child(1){animation-delay:0.05s}
        .stat-card:nth-child(2){animation-delay:0.10s}
        .stat-card:nth-child(3){animation-delay:0.15s}
        .stat-card:nth-child(4){animation-delay:0.20s}

        .bar-chart { display:flex; align-items:flex-end; gap:8px; height:160px; margin-top:4px; }
        .bar-group { flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; height:100%; justify-content:flex-end; }
        .bars { display:flex; gap:3px; align-items:flex-end; }
        .bar  { width:18px; border-radius:4px 4px 0 0; cursor:pointer; transition:opacity 0.15s; }
        .bar:hover { opacity:0.7; }
        .bar.occ   { background:#3b82f6; }
        .bar.avail { background:rgba(59,130,246,0.18); }
        .bar-label { font-size:10px; color:#6b7280; }

        .act-item { display:flex; gap:13px; padding:13px 0; border-bottom:1px solid #252a33; align-items:flex-start; }
        .act-item:last-child { border-bottom:none; }
        .act-dot  { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; margin-top:1px; }
        .act-dot.entry   { background:rgba(34,197,94,0.12); }
        .act-dot.exit    { background:rgba(239,68,68,0.1); }
        .act-dot.payment { background:rgba(245,158,11,0.1); }
        .act-dot.alert   { background:rgba(239,68,68,0.12); }
        .act-action { font-size:13px; font-weight:500; }
        .act-meta   { font-size:12px; color:#6b7280; margin-top:2px; }

        .nav-link { transition:all 0.18s; }
        .nav-link:hover { background:#1a1e25; color:#f0f2f5 !important; }
        .action-btn { transition:all 0.18s; }
        .action-btn:hover { background:#252a33 !important; border-color:#3b82f6 !important; }
      `}</style>

      {/* ══ SIDEBAR ══ */}
      <aside style={{ width: '260px', background: '#13161b', borderRight: '1px solid #252a33', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100 }}>
        <div style={{ padding: '30px 28px 26px', borderBottom: '1px solid #252a33' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '21px', letterSpacing: '-0.5px' }}>Two Rivers</div>
          <div style={{ fontSize: '10px', color: '#6b7280', letterSpacing: '2.5px', textTransform: 'uppercase', marginTop: '3px' }}>Smart Parking · Admin</div>
        </div>

        <nav style={{ padding: '22px 14px', flex: 1, overflowY: 'auto' }}>
          {navSections.map(section => (
            <div key={section.section}>
              <div style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b7280', padding: '0 12px', marginBottom: '6px', marginTop: '18px' }}>{section.section}</div>
              {section.items.map(item => (
                <div key={item.id} className="nav-link" onClick={() => setActiveNav(item.id)} style={{
                  display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 13px', borderRadius: '10px',
                  color: activeNav === item.id ? '#fff' : '#6b7280',
                  fontSize: '14px', fontWeight: 500, cursor: 'pointer', marginBottom: '2px',
                  background: activeNav === item.id ? '#3b82f6' : 'transparent', userSelect: 'none',
                }}>
                  <span style={{ fontSize: '16px', width: '20px', textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                  {item.badge > 0 && (
                    <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', borderRadius: '20px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{item.badge}</span>
                  )}
                </div>
              ))}
            </div>
          ))}

          <div>
            <div style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: '#6b7280', padding: '0 12px', marginBottom: '6px', marginTop: '18px' }}>System</div>
            <div className="nav-link" onClick={() => setActiveNav('settings')} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 13px', borderRadius: '10px', color: activeNav === 'settings' ? '#fff' : '#6b7280', fontSize: '14px', fontWeight: 500, cursor: 'pointer', marginBottom: '2px', background: activeNav === 'settings' ? '#3b82f6' : 'transparent' }}>
              <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>⚙️</span> Settings
            </div>
            <div className="nav-link" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 13px', borderRadius: '10px', color: '#ef4444', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>🚪</span> Logout
            </div>
          </div>
        </nav>

        <div style={{ padding: '18px 14px', borderTop: '1px solid #252a33' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 12px', borderRadius: '12px', background: '#1a1e25' }}>
            <div style={{ width: '34px', height: '34px', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>👤</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{user.name}</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Two Rivers HQ</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <main style={{ marginLeft: '260px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* Topbar */}
        <div style={{ background: '#13161b', borderBottom: '1px solid #252a33', padding: '18px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, textTransform: 'capitalize' }}>
              {activeNav === 'overview' ? 'Overview' : activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{liveDate}</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#22c55e', background: 'rgba(34,197,94,0.08)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.8s infinite' }} />
              System Live
            </div>
            <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid #252a33', color: '#9ca3af', borderRadius: '10px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
              ↩ Export
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '36px 40px', flex: 1 }}>

          {/* ── OVERVIEW ── */}
          {activeNav === 'overview' && (
            <>
              <div style={{ marginBottom: '32px' }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 800 }}>{greeting}, {user.name} 👋</div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '6px' }}>Here's what's happening at Two Rivers today.</div>
              </div>

              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '18px', marginBottom: '28px' }}>
                {statCards.map(s => (
                  <div key={s.label} className="stat-card" style={{ background: '#13161b', border: '1px solid #252a33', borderRadius: '18px', padding: '22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: `${s.glow}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{s.icon}</div>
                    </div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 800, lineHeight: 1, marginBottom: '6px' }}>{s.val}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>{s.label}</div>
                    <div style={{ marginTop: '14px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '20px', background: s.dt === 'up' ? 'rgba(34,197,94,0.1)' : s.dt === 'neutral' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)', color: s.dt === 'up' ? '#22c55e' : s.dt === 'neutral' ? '#3b82f6' : '#f59e0b' }}>
                      {s.delta}
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                  {/* Bar chart */}
                  <div style={{ background: '#13161b', border: '1px solid #252a33', borderRadius: '18px', padding: '28px', animation: 'fadeUp 0.5s 0.25s ease both' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                      <div>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700 }}>Hourly Occupancy</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>Today · All Levels</div>
                      </div>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        {[['#3b82f6','Occupied'],['rgba(59,130,246,0.3)','Available']].map(([c,l]) => (
                          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />{l}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div ref={barChartRef} className="bar-chart" />
                  </div>

                  {/* Floor utilization */}
                  <div style={{ background: '#13161b', border: '1px solid #252a33', borderRadius: '18px', padding: '28px', animation: 'fadeUp 0.5s 0.25s ease both' }}>
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700 }}>Floor Utilization</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>Live · 3 active levels</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {[['Level 1 — Section A', 78, '#ef4444'], ['Level 2 — Section B', 55, '#f59e0b'], ['Level 3 — Section C', 42, '#22c55e']].map(([name, pct, color]) => (
                        <div key={name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                            <span style={{ fontWeight: 500 }}>{name}</span>
                            <span style={{ color: '#6b7280', fontSize: '12px' }}>{pct}%</span>
                          </div>
                          <div style={{ background: '#1a1e25', borderRadius: '99px', height: '6px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: '99px', background: color, width: `${pct}%`, transition: 'width 1.2s cubic-bezier(.4,0,.2,1)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Activity feed */}
                  <div style={{ background: '#13161b', border: '1px solid #252a33', borderRadius: '18px', padding: '28px', animation: 'fadeUp 0.5s 0.25s ease both' }}>
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700 }}>Recent Activity</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>Live feed</div>
                    </div>
                    <div ref={activityRef} />
                  </div>
                </div>

                {/* Right col */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Donut */}
                  <div style={{ background: '#13161b', border: '1px solid #252a33', borderRadius: '18px', padding: '28px', animation: 'fadeUp 0.5s 0.25s ease both' }}>
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700 }}>Slot Overview</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>Live breakdown</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', marginBottom: '22px' }}>
                      <svg width="150" height="150" viewBox="0 0 150 150">
                        <circle cx="75" cy="75" r="55" fill="none" stroke="#1a1e25" strokeWidth="20"/>
                        <circle cx="75" cy="75" r="55" fill="none" stroke="#3b82f6" strokeWidth="20" strokeDasharray="224 122" strokeDashoffset="0" strokeLinecap="round" transform="rotate(-90 75 75)"/>
                        <circle cx="75" cy="75" r="55" fill="none" stroke="#22c55e" strokeWidth="20" strokeDasharray="46 300" strokeDashoffset="-224" strokeLinecap="round" transform="rotate(-90 75 75)"/>
                        <circle cx="75" cy="75" r="55" fill="none" stroke="#f59e0b" strokeWidth="20" strokeDasharray="22 324" strokeDashoffset="-270" strokeLinecap="round" transform="rotate(-90 75 75)"/>
                      </svg>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 800, lineHeight: 1 }}>
                          {stats ? stats.occupancyRate : '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Occupied</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[
                        ['#3b82f6', 'Occupied',  stats?.occupiedSlots  ?? '—'],
                        ['#1a1e25', 'Available', stats?.availableSlots ?? '—', true],
                        ['#22c55e', 'EV Slots',  24],
                        ['#f59e0b', 'Premium',   16],
                      ].map(([color, label, count, border]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#6b7280' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: color, border: border ? '1px solid #252a33' : 'none', flexShrink: 0 }} />
                            {label}
                          </div>
                          <span style={{ fontWeight: 700 }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div style={{ background: '#13161b', border: '1px solid #252a33', borderRadius: '18px', padding: '28px', animation: 'fadeUp 0.5s 0.25s ease both' }}>
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700 }}>Quick Actions</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>Admin controls</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {[
                        { icon: '🅿️', label: 'Manage Slots',  nav: 'slots'    },
                        { icon: '👮', label: 'View Guards',   nav: 'guards'   },
                        { icon: '📊', label: 'Run Report',    nav: 'reports'  },
                        { icon: '💳', label: 'View Payments', nav: 'payments' },
                      ].map(a => (
                        <button key={a.label} className="action-btn" onClick={() => setActiveNav(a.nav)} style={{ padding: '14px', borderRadius: '12px', background: '#1a1e25', border: '1px solid #252a33', color: '#f0f2f5', fontFamily: "'DM Sans',sans-serif", fontSize: '13px', fontWeight: 500, cursor: 'pointer', textAlign: 'center' }}>
                          <span style={{ fontSize: '20px', marginBottom: '6px', display: 'block' }}>{a.icon}</span>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── PARKING SLOTS ── */}
          {activeNav === 'slots' && (
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 800, marginBottom: '28px' }}>Parking Slots</div>
              {slots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🅿️</div>
                  <p>Loading slots from database...</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '14px' }}>
                  {slots.map(slot => (
                    <div key={slot._id} style={{ background: '#13161b', border: `1px solid ${slot.status === 'available' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: '16px', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 800 }}>{slot.slotCode}</div>
                        <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: slot.status === 'available' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)', color: slot.status === 'available' ? '#4ade80' : '#f87171' }}>
                          {slot.status === 'available' ? 'FREE' : 'OCCUPIED'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{slot.floor} · {slot.section}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{slot.type || 'Standard'}</div>
                      {slot.currentDriverPhone && (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#f59e0b' }}>📱 {slot.currentDriverPhone}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {activeNav === 'payments' && (
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>Payments</div>
              <p style={{ color: '#6b7280', marginBottom: '28px' }}>M-Pesa transaction history</p>
              <div style={{ background: '#13161b', border: '1px solid #252a33', borderRadius: '18px', padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>💳</div>
                <p style={{ fontSize: '15px', fontWeight: 500 }}>Payment history will appear here</p>
                <p style={{ fontSize: '13px', marginTop: '8px' }}>Transactions are recorded when drivers complete M-Pesa payments</p>
              </div>
            </div>
          )}

          {/* ── REPORTS ── */}
          {activeNav === 'reports' && (
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 800, marginBottom: '28px' }}>Reports</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '18px' }}>
                {[
                  { icon: '💰', title: 'Revenue Report',   sub: `Total: KSh ${stats?.totalRevenue || 0}`,        color: '#22c55e' },
                  { icon: '🅿️', title: 'Occupancy Report', sub: `Rate: ${stats?.occupancyRate || '0%'}`,          color: '#3b82f6' },
                  { icon: '⚠️', title: 'Fines Report',     sub: `Unpaid: ${stats?.unpaidFines || 0} fines`,       color: '#f59e0b' },
                  { icon: '🚗', title: 'Bookings Report',  sub: `Active: ${stats?.activeBookings || 0} bookings`, color: '#a78bfa' },
                ].map(r => (
                  <div key={r.title} style={{ background: '#13161b', border: '1px solid #252a33', borderRadius: '18px', padding: '28px', cursor: 'pointer' }}>
                    <div style={{ fontSize: '28px', marginBottom: '12px' }}>{r.icon}</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>{r.title}</div>
                    <div style={{ fontSize: '13px', color: r.color, fontWeight: 600 }}>{r.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── GUARDS ── */}
          {activeNav === 'guards' && <GuardsSection />}

          {/* ── DRIVERS ── */}
          {activeNav === 'drivers' && (
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 800, marginBottom: '28px' }}>Drivers</div>
              <div style={{ background: '#13161b', border: '1px solid #252a33', borderRadius: '18px', padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚗</div>
                <p style={{ fontSize: '15px', fontWeight: 500 }}>Driver directory coming soon</p>
                <p style={{ fontSize: '13px', marginTop: '8px' }}>Registered drivers and their booking history will appear here</p>
              </div>
            </div>
          )}

          {/* ── ALERTS ── */}
          {activeNav === 'alerts' && (
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>Alerts</div>
              <p style={{ color: '#6b7280', marginBottom: '28px' }}>{stats?.unpaidFines || 0} unpaid fines requiring attention</p>
              <div style={{ background: '#13161b', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '18px', padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>⚠️</span>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700 }}>Unpaid Fines</div>
                </div>
                <p style={{ color: '#6b7280', fontSize: '13px' }}>
                  There are {stats?.unpaidFines || 0} outstanding fines totalling KSh {stats?.totalFines || 0}.
                  Fine payment details will be listed here once drivers are linked.
                </p>
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeNav === 'settings' && (
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 800, marginBottom: '28px' }}>Settings</div>
              <div style={{ background: '#13161b', border: '1px solid #252a33', borderRadius: '18px', padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚙️</div>
                <p style={{ fontSize: '15px', fontWeight: 500 }}>System settings</p>
                <p style={{ fontSize: '13px', marginTop: '8px' }}>Rate configuration, notifications, and system preferences</p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
