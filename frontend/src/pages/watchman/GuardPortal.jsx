import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const API    = process.env.REACT_APP_API_URL    || 'http://localhost:5000';
const SOCKET = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const GuardPortal = () => {
  const [user, setUser]                   = useState(null);
  const [slots, setSlots]                 = useState([]);
  const [filteredSlots, setFilteredSlots] = useState([]);
  const [searchTerm, setSearchTerm]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('all');
  const [showProfile, setShowProfile]     = useState(false);
  const [loading, setLoading]             = useState(true);

  const socketRef = useRef(null);

  // ── Role guard: redirect if not a watchman ──
  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (!saved) {
      window.location.href = '/';
      return;
    }
    const parsed = JSON.parse(saved);
    if (parsed.role !== 'watchman') {
      // Wrong portal — kick back to login
      window.location.href = '/';
      return;
    }
    setUser(parsed);
  }, []);

  // ── Fetch real slots from MongoDB ──
  const fetchSlots = async () => {
    try {
      const res  = await fetch(`${API}/api/slots`);
      const data = await res.json();
      if (data.success) {
        const normalized = data.data.map(s => ({
          id:        s._id,
          number:    s.slotCode,
          floor:     s.floor   || 'Level 1',
          section:   s.section || 'A',
          type:      s.type    || 'Standard',
          available: s.status === 'available',
        }));
        setSlots(normalized);
        setFilteredSlots(normalized);
      }
    } catch (err) {
      console.error('Failed to fetch slots:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Socket for real-time updates from driver bookings ──
  useEffect(() => {
    fetchSlots();
    const socket = io(SOCKET);
    socketRef.current = socket;
    socket.on('slotStatusUpdate', ({ slotCode, status }) => {
      setSlots(prev =>
        prev.map(s => s.number === slotCode ? { ...s, available: status === 'available' } : s)
      );
    });
    return () => socket.disconnect();
  }, []);

  // ── Filter ──
  useEffect(() => {
    let result = slots.filter(slot => {
      if (searchTerm && !slot.number.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterStatus === 'available') return slot.available;
      if (filterStatus === 'occupied')  return !slot.available;
      return true;
    });
    setFilteredSlots(result);
  }, [slots, searchTerm, filterStatus]);

  // ── Guard toggles a slot ──
  const toggleSlotStatus = async (slot) => {
    try {
      const res  = await fetch(`${API}/api/slots/${slot.number}/toggle`, { method: 'PUT' });
      const data = await res.json();
      if (data.success) {
        setSlots(prev =>
          prev.map(s => s.number === slot.number ? { ...s, available: data.newStatus === 'available' } : s)
        );
      } else {
        alert('Failed to update slot');
      }
    } catch {
      alert('Cannot connect to backend');
    }
  };

  const handleLogout = () => {
    // Only clear THIS user's keys, not everything
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const availableCount = slots.filter(s => s.available).length;
  const occupiedCount  = slots.filter(s => !s.available).length;

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0f14', color: '#fff', fontFamily: "'DM Sans',sans-serif", flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '40px' }}>👮</div>
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading Guard Portal...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0f14', fontFamily: "'DM Sans',sans-serif", color: '#f0f2f5' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#2a2f3d; border-radius:99px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .slot-card  { transition:transform 0.18s; }
        .slot-card:hover { transform:translateY(-2px); }
        .filter-btn { transition:all 0.18s; cursor:pointer; border:none; font-family:'DM Sans',sans-serif; }
        .toggle-btn { transition:all 0.18s; cursor:pointer; border:none; font-family:'DM Sans',sans-serif; }
        .toggle-btn:hover { opacity:0.85; }
        input:focus { outline:none; border-color:rgba(59,130,246,0.6) !important; }
      `}</style>

      {/* ══ HERO ══ */}
      <div style={{ position: 'relative', height: '280px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/Images/guard-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center 35%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(8,12,22,0.55) 0%,rgba(8,12,22,0.88) 70%,#0d0f14 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg,transparent,rgba(239,68,68,0.6),transparent)' }} />

        {/* Nav */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '46px', height: '46px', background: 'linear-gradient(135deg,#dc2626,#991b1b)', borderRadius: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 4px 16px rgba(220,38,38,0.4)' }}>👮</div>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '26px', color: '#fff', letterSpacing: '-0.5px' }}>Two Rivers</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>Security Control</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowProfile(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: "'DM Sans',sans-serif" }}>👮 {user.name}</button>
            <button onClick={handleLogout} style={{ padding: '8px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: "'DM Sans',sans-serif" }}>Logout</button>
          </div>
        </div>

        {/* Hero text */}
        <div style={{ position: 'absolute', bottom: '32px', left: '40px', zIndex: 10 }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '48px', fontWeight: 800, color: '#fff', letterSpacing: '-1px', lineHeight: 1.1 }}>Guard Control Panel</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', marginTop: '8px' }}>{availableCount} slots available · Manage in real-time</p>
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px 60px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginTop: '28px', marginBottom: '28px' }}>
          {[
            { icon: '🟢', label: 'Available', val: availableCount, color: '#22c55e', bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.2)'  },
            { icon: '🔴', label: 'Occupied',  val: occupiedCount,  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'  },
            { icon: '🅿️', label: 'Total',     val: slots.length,   color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '16px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', animation: 'fadeUp 0.4s ease both' }}>
              <span style={{ fontSize: '28px' }}>{s.icon}</span>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Banner strip */}
        <div style={{ width: '100%', height: '180px', borderRadius: '16px', overflow: 'hidden', marginBottom: '28px', position: 'relative', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/Images/guard-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center 60%' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(8,12,22,0.88) 0%,rgba(8,12,22,0.4) 60%,transparent 100%)', display: 'flex', alignItems: 'center', padding: '0 28px' }}>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700, color: '#fff' }}>Two Rivers Security</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>3 levels · 24/7 surveillance · Real-time slot control</div>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <input
            type="text" placeholder="🔍  Search by slot number..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '13px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '14px', fontFamily: "'DM Sans',sans-serif" }}
          />
          {[
            { val: 'all',       label: 'All'        },
            { val: 'available', label: '✓ Free'     },
            { val: 'occupied',  label: '✗ Occupied' },
          ].map(f => (
            <button key={f.val} className="filter-btn" onClick={() => setFilterStatus(f.val)} style={{
              padding: '13px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 500,
              background: filterStatus === f.val ? (f.val === 'available' ? '#22c55e' : f.val === 'occupied' ? '#ef4444' : '#3b82f6') : 'rgba(255,255,255,0.05)',
              color: filterStatus === f.val ? '#fff' : 'rgba(255,255,255,0.4)',
              border: '1px solid ' + (filterStatus === f.val ? 'transparent' : 'rgba(255,255,255,0.08)'),
            }}>{f.label}</button>
          ))}
        </div>

        {/* Slots grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: '14px' }}>
          {filteredSlots.map((slot, i) => (
            <div key={slot.id} className="slot-card" style={{
              padding: '22px 20px', borderRadius: '16px',
              border: slot.available ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)',
              background: slot.available ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)',
              animation: `fadeUp 0.4s ${i * 0.04}s ease both`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '26px', fontWeight: 800, color: slot.available ? '#fff' : 'rgba(255,255,255,0.4)' }}>{slot.number}</div>
                <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: slot.available ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)', color: slot.available ? '#4ade80' : '#f87171' }}>
                  {slot.available ? 'FREE' : 'OCCUPIED'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '4px' }}>{slot.floor} · {slot.section}</div>
              <div style={{ display: 'inline-block', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', marginBottom: '14px', background: slot.type === 'EV' ? 'rgba(34,197,94,0.1)' : slot.type === 'Premium' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', color: slot.type === 'EV' ? '#4ade80' : slot.type === 'Premium' ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>{slot.type}</div>
              <button className="toggle-btn" onClick={() => toggleSlotStatus(slot)} style={{
                width: '100%', padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                background: slot.available ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                color: slot.available ? '#f87171' : '#4ade80',
                border: `1px solid ${slot.available ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
              }}>
                {slot.available ? '✗ Mark Occupied' : '✓ Mark Available'}
              </button>
            </div>
          ))}
        </div>

        {filteredSlots.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.25)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
            <p>No slots match your filters</p>
          </div>
        )}
      </div>

      {/* ══ PROFILE MODAL ══ */}
      {showProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div style={{ background: '#13161b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '36px', width: '100%', maxWidth: '380px' }}>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 800, marginBottom: '24px' }}>My Profile</h2>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ width: '72px', height: '72px', margin: '0 auto 12px', background: 'linear-gradient(135deg,#dc2626,#7c3aed)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>👮</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700 }}>{user.name}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Security Guard</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '6px' }}>{user.phone}</div>
            </div>
            <button onClick={() => setShowProfile(false)} style={{ width: '100%', padding: '13px', borderRadius: '14px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuardPortal;