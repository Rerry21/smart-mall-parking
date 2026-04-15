import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const API    = process.env.REACT_APP_API_URL    || 'http://localhost:5000';
const SOCKET = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

function formatCountdown(seconds) {
  if (seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function playBeep() {
  try {
    const ctx        = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode   = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

// ── Ask a Question floating widget ──
function AskQuestion({ user }) {
  const [open, setOpen]       = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent]       = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await fetch(`${API}/api/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName:  user?.name  || 'Guard',
          senderPhone: user?.phone || '',
          senderRole:  'watchman',
          message:     message.trim(),
        }),
      });
      setSent(true);
      setMessage('');
      setTimeout(() => { setSent(false); setOpen(false); }, 2000);
    } catch (e) { console.error(e); }
    setSending(false);
  };

  return (
    <>
      <button onClick={() => setOpen(o => !o)} style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 200, width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg,#dc2626,#991b1b)', border: 'none', cursor: 'pointer', fontSize: '24px', boxShadow: '0 8px 24px rgba(220,38,38,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {open ? '✕' : '💬'}
      </button>
      {open && (
        <div style={{ position: 'fixed', bottom: '100px', right: '32px', zIndex: 200, width: '320px', background: '#13161b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Ask a Question</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '14px' }}>Sending as {user?.name} · {user?.phone}</div>
          {sent ? (
            <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: '13px', textAlign: 'center' }}>✅ Message sent to admin!</div>
          ) : (
            <>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your question here..." rows={4} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '13px', resize: 'none', outline: 'none' }} />
              <button onClick={handleSend} disabled={sending || !message.trim()} style={{ marginTop: '10px', width: '100%', padding: '11px', borderRadius: '12px', border: 'none', background: sending || !message.trim() ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#dc2626,#991b1b)', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', fontWeight: 600, cursor: sending || !message.trim() ? 'not-allowed' : 'pointer' }}>
                {sending ? 'Sending...' : 'Send Message →'}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

const GuardPortal = () => {
  const [user, setUser]                   = useState(null);
  const [slots, setSlots]                 = useState([]);
  const [filteredSlots, setFilteredSlots] = useState([]);
  const [searchTerm, setSearchTerm]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('all');
  const [filterFloor, setFilterFloor]     = useState('all');
  const [showProfile, setShowProfile]     = useState(false);
  const [loading, setLoading]             = useState(true);
  const [detailSlot, setDetailSlot]       = useState(null); // slot details modal

  // bookingMap: { [slotCode]: { expiryTime, driverPhone, driverName, plateNumber, bookingId, amountPaid, duration } }
  const [bookingMap, setBookingMap]   = useState({});
  const [secondsMap, setSecondsMap]   = useState({});
  const beepedRef                     = useRef({});
  const socketRef                     = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (!saved) { window.location.href = '/'; return; }
    const parsed = JSON.parse(saved);
    if (parsed.role !== 'watchman') { window.location.href = '/'; return; }
    setUser(parsed);
  }, []);

  const fetchSlots = async () => {
    try {
      const res  = await fetch(`${API}/api/slots`);
      const data = await res.json();
      if (data.success) {
        const normalized = data.data.map(s => ({
          id: s._id, number: s.slotCode,
          floor:       s.floor    || 'Level A',
          section:     s.section  || 'A',
          type:        s.type     || 'Standard',
          available:   s.status === 'available',
          driverPhone: s.currentDriverPhone || null,
          driverName:  s.currentDriverName  || null,
          plateNumber: s.currentPlateNumber || null,
          expiryTime:  s.currentExpiryTime  || null,
          bookingId:   s.currentBookingId   || null,
        }));
        setSlots(normalized);
        setFilteredSlots(normalized);
      }
    } catch (err) { console.error('Failed to fetch slots:', err); }
    finally { setLoading(false); }
  };

  const fetchActiveBookings = async () => {
    try {
      const res  = await fetch(`${API}/api/bookings/active/all`);
      const data = await res.json();
      if (data.success) {
        const map = {};
        data.data.forEach(b => {
          map[b.slotCode] = {
            expiryTime:  b.expiryTime,
            driverPhone: b.driverPhone,
            driverName:  b.driverName  || '',
            plateNumber: b.plateNumber || '',
            bookingId:   b._id,
            amountPaid:  b.amountPaid,
            duration:    b.duration,
            entryTime:   b.entryTime,
          };
        });
        setBookingMap(map);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchSlots();
    fetchActiveBookings();

    const socket = io(SOCKET);
    socketRef.current = socket;

    socket.on('slotStatusUpdate', ({ slotCode, status, driverPhone, driverName, plateNumber, expiryTime, bookingId }) => {
      setSlots(prev => prev.map(s =>
        s.number === slotCode
          ? { ...s, available: status === 'available', driverPhone: driverPhone || null, driverName: driverName || null, plateNumber: plateNumber || null, expiryTime: expiryTime || null, bookingId: bookingId || null }
          : s
      ));
      fetchActiveBookings();
    });

    return () => socket.disconnect();
  }, []);

  // ── Countdown tick ──
  useEffect(() => {
    const interval = setInterval(() => {
      const newMap = {};
      Object.entries(bookingMap).forEach(([slotCode, booking]) => {
        const secs = Math.floor((new Date(booking.expiryTime) - Date.now()) / 1000);
        newMap[slotCode] = secs;
        if (secs <= 0 && !beepedRef.current[slotCode]) {
          beepedRef.current[slotCode] = true;
          playBeep();
        }
        if (secs > 0 && beepedRef.current[slotCode]) {
          beepedRef.current[slotCode] = false;
        }
      });
      setSecondsMap(newMap);
    }, 1000);
    return () => clearInterval(interval);
  }, [bookingMap]);

  // ── Filter ──
  useEffect(() => {
    let result = slots.filter(slot => {
      if (searchTerm && !slot.number.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterStatus === 'available') return slot.available;
      if (filterStatus === 'occupied')  return !slot.available;
      return true;
    });
    if (filterFloor !== 'all') result = result.filter(s => s.floor === filterFloor);
    setFilteredSlots(result);
  }, [slots, searchTerm, filterStatus, filterFloor]);

  const toggleSlotStatus = async (slot) => {
    try {
      const res  = await fetch(`${API}/api/slots/${slot.number}/toggle`, { method: 'PUT' });
      const data = await res.json();
      if (data.success) {
        setSlots(prev => prev.map(s =>
          s.number === slot.number ? { ...s, available: data.newStatus === 'available' } : s
        ));
      } else {
        alert(`Failed to update slot: ${data.error || 'Unknown error'}`);
      }
    } catch { alert('Cannot connect to backend'); }
  };

  const handleLogout = () => {
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
        @keyframes overstayPulse { 0%,100%{border-color:rgba(239,68,68,0.6)} 50%{border-color:rgba(239,68,68,0.15)} }
        .slot-card { transition:transform 0.18s; }
        .slot-card:hover { transform:translateY(-2px); }
        .slot-overstay { animation: overstayPulse 1.5s infinite; }
        .filter-btn, .toggle-btn { transition:all 0.18s; cursor:pointer; border:none; font-family:'DM Sans',sans-serif; }
        .toggle-btn:hover { opacity:0.85; }
        input:focus, select:focus, textarea:focus { outline:none; border-color:rgba(59,130,246,0.6) !important; }
      `}</style>

      {/* ══ HERO ══ */}
      <div style={{ position: 'relative', height: '280px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/Images/guard-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(8,12,22,0.55) 0%,rgba(8,12,22,0.88) 70%,#0d0f14 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg,transparent,rgba(239,68,68,0.6),transparent)' }} />

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

        <div style={{ position: 'absolute', bottom: '32px', left: '40px', zIndex: 10 }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '48px', fontWeight: 800, color: '#fff', letterSpacing: '-1px', lineHeight: 1.1 }}>Guard Control Panel</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', marginTop: '8px' }}>{availableCount} slots available · Manage in real-time</p>
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px 100px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginTop: '28px', marginBottom: '28px' }}>
          {[
            { icon: '🟢', label: 'Available', val: availableCount, color: '#22c55e', bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.2)'  },
            { icon: '🔴', label: 'Occupied',  val: occupiedCount,  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'  },
            { icon: '🅿️', label: 'Total',     val: slots.length,   color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '16px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '28px' }}>{s.icon}</span>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Banner */}
        <div style={{ width: '100%', height: '160px', borderRadius: '16px', overflow: 'hidden', marginBottom: '28px', position: 'relative', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/Images/guard-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center 60%' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(8,12,22,0.88) 0%,rgba(8,12,22,0.4) 60%,transparent 100%)', display: 'flex', alignItems: 'center', padding: '0 28px' }}>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700, color: '#fff' }}>Two Rivers Security</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>Levels A, B, C · 24/7 surveillance · Real-time control</div>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="🔍  Search by slot number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '13px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '14px', fontFamily: "'DM Sans',sans-serif" }} />
          {[
            { val: 'all',       label: 'All'        },
            { val: 'available', label: '✓ Free'     },
            { val: 'occupied',  label: '✗ Occupied' },
          ].map(f => (
            <button key={f.val} className="filter-btn" onClick={() => setFilterStatus(f.val)} style={{ padding: '13px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 500, background: filterStatus === f.val ? (f.val === 'available' ? '#22c55e' : f.val === 'occupied' ? '#ef4444' : '#3b82f6') : 'rgba(255,255,255,0.05)', color: filterStatus === f.val ? '#fff' : 'rgba(255,255,255,0.4)', border: '1px solid ' + (filterStatus === f.val ? 'transparent' : 'rgba(255,255,255,0.08)') }}>{f.label}</button>
          ))}
          <select value={filterFloor} onChange={e => setFilterFloor(e.target.value)} style={{ padding: '13px 16px', borderRadius: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontFamily: "'DM Sans',sans-serif" }}>
            <option value="all">All Levels</option>
            <option value="Level A">Level A</option>
            <option value="Level B">Level B</option>
            <option value="Level C">Level C</option>
          </select>
        </div>

        {/* Slots grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: '14px' }}>
          {filteredSlots.map((slot, i) => {
            const booking    = bookingMap[slot.number];
            const secs       = secondsMap[slot.number];
            const isOverstay = !slot.available && booking && secs !== undefined && secs <= 0;
            const isWarning  = !slot.available && booking && secs !== undefined && secs > 0 && secs <= 300;

            const cardBorder = isOverstay ? '2px solid rgba(239,68,68,0.6)' : isWarning ? '1px solid rgba(245,158,11,0.4)' : slot.available ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)';
            const cardBg     = isOverstay ? 'rgba(239,68,68,0.08)' : slot.available ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)';

            return (
              <div key={slot.id} className={`slot-card${isOverstay ? ' slot-overstay' : ''}`}
                style={{ padding: '20px', borderRadius: '16px', border: cardBorder, background: cardBg, animation: `fadeUp 0.4s ${i * 0.03}s ease both` }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '24px', fontWeight: 800, color: slot.available ? '#fff' : isOverstay ? '#f87171' : 'rgba(255,255,255,0.4)' }}>{slot.number}</div>
                  <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: isOverstay ? 'rgba(239,68,68,0.2)' : slot.available ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)', color: isOverstay ? '#fca5a5' : slot.available ? '#4ade80' : '#f87171' }}>
                    {isOverstay ? '⚠️ OVERSTAY' : slot.available ? 'FREE' : 'OCCUPIED'}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '4px' }}>{slot.floor} · Section {slot.section}</div>
                <div style={{ display: 'inline-block', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', marginBottom: '10px', background: slot.type === 'EV' ? 'rgba(34,197,94,0.1)' : slot.type === 'Premium' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', color: slot.type === 'EV' ? '#4ade80' : slot.type === 'Premium' ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>{slot.type}</div>

                {/* Countdown */}
                {!slot.available && booking && secs !== undefined && (
                  <div style={{ marginBottom: '8px', padding: '7px 10px', borderRadius: '8px', background: isOverstay ? 'rgba(239,68,68,0.12)' : isWarning ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isOverstay ? 'rgba(239,68,68,0.3)' : isWarning ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{isOverstay ? '⚠️ Over by' : '⏱ Time left'}</span>
                    <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '14px', fontWeight: 700, color: isOverstay ? '#f87171' : isWarning ? '#fbbf24' : '#60a5fa' }}>
                      {isOverstay ? `+${formatCountdown(Math.abs(secs))}` : formatCountdown(secs)}
                    </span>
                  </div>
                )}

                {/* Driver phone snippet */}
                {!slot.available && (slot.driverPhone || (booking && booking.driverPhone)) && (
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>📱</span> {slot.driverPhone || booking?.driverPhone}
                  </div>
                )}

                {/* View Details button for occupied slots */}
                {!slot.available && booking && (
                  <button className="toggle-btn" onClick={() => setDetailSlot({ slot, booking, secs })}
                    style={{ width: '100%', padding: '8px', borderRadius: '9px', fontSize: '11px', fontWeight: 600, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', marginBottom: '6px' }}>
                    🔍 View Details
                  </button>
                )}

                {/* Toggle button */}
                <button className="toggle-btn" onClick={() => toggleSlotStatus(slot)}
                  style={{ width: '100%', padding: '9px', borderRadius: '9px', fontSize: '12px', fontWeight: 600, background: slot.available ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: slot.available ? '#f87171' : '#4ade80', border: `1px solid ${slot.available ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}` }}>
                  {slot.available ? '✗ Mark Occupied' : '✓ Mark Available'}
                </button>
              </div>
            );
          })}
        </div>

        {filteredSlots.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.25)' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
            <p>No slots match your filters</p>
          </div>
        )}
      </div>

      {/* ══ SLOT DETAILS MODAL ══ */}
      {detailSlot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div style={{ background: '#13161b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '36px', width: '100%', maxWidth: '400px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 800 }}>Slot {detailSlot.slot.number}</div>
              <button onClick={() => setDetailSlot(null)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>

            {/* Slot info */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Slot Info</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Level',   val: detailSlot.slot.floor   },
                  { label: 'Section', val: `Section ${detailSlot.slot.section}` },
                  { label: 'Type',    val: detailSlot.slot.type    },
                  { label: 'Status',  val: detailSlot.secs <= 0 ? '⚠️ Overstay' : '🔴 Occupied' },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontSize: '13px', color: '#f0f2f5', fontWeight: 600 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Driver info */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Driver Details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { icon: '👤', label: 'Name',        val: detailSlot.booking.driverName  || 'N/A'  },
                  { icon: '📱', label: 'Phone',       val: detailSlot.booking.driverPhone || 'N/A'  },
                  { icon: '🚘', label: 'Plate',       val: detailSlot.booking.plateNumber || 'N/A'  },
                  { icon: '💰', label: 'Amount Paid', val: `KSh ${detailSlot.booking.amountPaid || 0}` },
                  { icon: '⏱',  label: 'Duration',   val: `${detailSlot.booking.duration || 0} min`  },
                ].map(({ icon, label, val }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px', width: '24px' }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>{label}</div>
                      <div style={{ fontSize: '13px', color: '#f0f2f5', fontWeight: 600 }}>{val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Countdown */}
            <div style={{ background: detailSlot.secs <= 0 ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.08)', border: `1px solid ${detailSlot.secs <= 0 ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.2)'}`, borderRadius: '14px', padding: '16px', textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>{detailSlot.secs <= 0 ? '⚠️ OVERSTAY — FINE: KSh 300' : '⏱ TIME REMAINING'}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '28px', fontWeight: 800, color: detailSlot.secs <= 0 ? '#f87171' : '#60a5fa' }}>
                {secondsMap[detailSlot.slot.number] !== undefined
                  ? (secondsMap[detailSlot.slot.number] <= 0
                      ? `+${formatCountdown(Math.abs(secondsMap[detailSlot.slot.number]))}`
                      : formatCountdown(secondsMap[detailSlot.slot.number]))
                  : '...'
                }
              </div>
            </div>

            <button onClick={() => setDetailSlot(null)} style={{ width: '100%', padding: '13px', borderRadius: '14px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

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
              {user.assignedFloor && (
                <div style={{ display: 'inline-block', marginTop: '8px', padding: '3px 12px', borderRadius: '8px', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', fontSize: '12px', color: '#f87171' }}>🏢 {user.assignedFloor}</div>
              )}
            </div>
            <button onClick={() => setShowProfile(false)} style={{ width: '100%', padding: '13px', borderRadius: '14px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {/* Ask a Question */}
      <AskQuestion user={user} />
    </div>
  );
};

export default GuardPortal;
