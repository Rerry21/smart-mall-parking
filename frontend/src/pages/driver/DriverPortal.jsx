import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const API    = process.env.REACT_APP_API_URL    || 'http://localhost:5000';
const SOCKET = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const PHONE_LIMITS = { '+254': 9, '+1': 10, '+44': 10 };

function formatCountdown(seconds) {
  if (seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Active Booking Banner (top of page) ──
function ActiveBookingBanner({ booking, onFineRecorded }) {
  const [secondsLeft, setSeconds] = useState(null);
  const fineRecordedRef           = useRef(false);

  useEffect(() => {
    if (!booking) { setSeconds(null); return; }
    fineRecordedRef.current = false;
    const tick = () => {
      const diff = Math.floor((new Date(booking.expiryTime) - Date.now()) / 1000);
      setSeconds(diff);
      if (diff <= 0 && !fineRecordedRef.current) {
        fineRecordedRef.current = true;
        onFineRecorded && onFineRecorded(booking);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [booking]);

  if (!booking) return null;

  const isOverstay = secondsLeft !== null && secondsLeft <= 0;
  const isUrgent   = secondsLeft !== null && secondsLeft <= 300 && secondsLeft > 0;
  const isWarning  = secondsLeft !== null && secondsLeft <= 600 && secondsLeft > 300;

  const bg     = isOverstay ? 'rgba(239,68,68,0.15)'   : isUrgent ? 'rgba(239,68,68,0.1)'   : isWarning ? 'rgba(245,158,11,0.1)'   : 'rgba(59,130,246,0.1)';
  const border = isOverstay ? 'rgba(239,68,68,0.5)'    : isUrgent ? 'rgba(239,68,68,0.3)'   : isWarning ? 'rgba(245,158,11,0.3)'   : 'rgba(59,130,246,0.3)';
  const color  = isOverstay ? '#f87171'                : isUrgent ? '#fca5a5'               : isWarning ? '#fbbf24'               : '#60a5fa';

  return (
    <div style={{ margin: '0 0 24px 0', padding: '16px 22px', borderRadius: '16px', background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '24px' }}>{isOverstay ? '⚠️' : '🅿️'}</span>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 700, color: '#fff' }}>
            {isOverstay ? '⚠️ Overstay! KSh 300 Fine Active' : `Active Booking — Slot ${booking.slotCode}`}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
            {isOverstay ? 'Please exit immediately to avoid further charges' : `Paid KSh ${booking.amountPaid} · ${booking.duration} min session`}
          </div>
        </div>
      </div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 800, color, letterSpacing: '-0.5px', minWidth: '100px', textAlign: 'right' }}>
        {isOverstay ? `+${formatCountdown(Math.abs(secondsLeft))} over` : secondsLeft !== null ? formatCountdown(secondsLeft) : '...'}
      </div>
    </div>
  );
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
          senderName:  user?.name  || 'Driver',
          senderPhone: user?.phone || '',
          senderRole:  'driver',
          message: message.trim(),
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
      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)} style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 200, width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', border: 'none', cursor: 'pointer', fontSize: '24px', boxShadow: '0 8px 24px rgba(59,130,246,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              <button onClick={handleSend} disabled={sending || !message.trim()} style={{ marginTop: '10px', width: '100%', padding: '11px', borderRadius: '12px', border: 'none', background: sending || !message.trim() ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', fontWeight: 600, cursor: sending || !message.trim() ? 'not-allowed' : 'pointer' }}>
                {sending ? 'Sending...' : 'Send Message →'}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

const DriverPortal = () => {
  const [user, setUser]                   = useState(null);
  const [slots, setSlots]                 = useState([]);
  const [filteredSlots, setFilteredSlots] = useState([]);
  const [searchTerm, setSearchTerm]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('all');
  const [filterFloor, setFilterFloor]     = useState('all');
  const [showProfile, setShowProfile]     = useState(false);
  const [loading, setLoading]             = useState(true);
  const [selectedSlot, setSelectedSlot]   = useState(null);
  const [activeBooking, setActiveBooking] = useState(null);

  // Booking modal state
  const [bookingPhone, setBookingPhone]       = useState('');
  const [bookingCC, setBookingCC]             = useState('+254');
  const [bookingDuration, setBookingDuration] = useState(60);
  const [bookingStep, setBookingStep]         = useState('form'); // 'form' | 'stk' | 'success'
  const [bookingLoading, setBookingLoading]   = useState(false);
  const [bookingError, setBookingError]       = useState('');

  // Slot-level countdowns: { [slotCode]: { secondsLeft, bookingId, driverPhone } }
  const [slotTimers, setSlotTimers] = useState({});

  // Profile state
  const [profileTab, setProfileTab]         = useState('info');
  const [editPhone, setEditPhone]           = useState('');
  const [editPhoneCC, setEditPhoneCC]       = useState('+254');
  const [editPlate, setEditPlate]           = useState('');
  const [newPassword, setNewPassword]       = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [currentPass, setCurrentPass]       = useState('');
  const [profilePhoto, setProfilePhoto]     = useState(null);
  const [profileMsg, setProfileMsg]         = useState('');
  const [profileError, setProfileError]     = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const photoInputRef                       = useRef(null);
  const socketRef                           = useRef(null);

  // ── Load user ──
  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (!saved) { window.location.href = '/'; return; }
    const parsed = JSON.parse(saved);
    if (parsed.role !== 'driver') { window.location.href = '/'; return; }
    setUser(parsed);
    if (parsed.phone) {
      const cc = parsed.phone.startsWith('+254') ? '+254' : parsed.phone.startsWith('+1') ? '+1' : parsed.phone.startsWith('+44') ? '+44' : '+254';
      setEditPhoneCC(cc);
      setEditPhone(parsed.phone.replace(cc, ''));
    }
    if (parsed.plateNumber) setEditPlate(parsed.plateNumber);
    if (parsed.profilePhoto) setProfilePhoto(parsed.profilePhoto);
  }, []);

  // ── Fetch active booking for banner ──
  const fetchActiveBooking = async (phone) => {
    try {
      const clean = phone.replace(/^\+/, '');
      const res   = await fetch(`${API}/api/bookings/${clean}`);
      const data  = await res.json();
      if (data.success && data.data.length > 0) {
        setActiveBooking(data.data[0]);
      }
    } catch (e) { console.error(e); }
  };

  // ── Fetch slots ──
  const fetchSlots = async () => {
    try {
      const res  = await fetch(`${API}/api/slots`);
      const data = await res.json();
      if (data.success) {
        const normalized = data.data.map(s => ({
          id: s._id, number: s.slotCode,
          floor:   s.floor    || 'Level A',
          section: s.section  || 'A',
          type:    s.type     || 'Standard',
          available: s.status === 'available',
          driverPhone:  s.currentDriverPhone || null,
          driverName:   s.currentDriverName  || null,
          plateNumber:  s.currentPlateNumber || null,
          expiryTime:   s.currentExpiryTime  || null,
          bookingId:    s.currentBookingId   || null,
        }));
        setSlots(normalized);
        setFilteredSlots(normalized);
      }
    } catch (err) { console.error('Failed to fetch slots:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchSlots();
    const socket = io(SOCKET);
    socketRef.current = socket;

    socket.on('slotStatusUpdate', ({ slotCode, status, driverPhone, driverName, plateNumber, expiryTime, bookingId }) => {
      setSlots(prev => prev.map(s =>
        s.number === slotCode
          ? { ...s, available: status === 'available', driverPhone: driverPhone || null, driverName: driverName || null, plateNumber: plateNumber || null, expiryTime: expiryTime || null, bookingId: bookingId || null }
          : s
      ));
    });

    return () => socket.disconnect();
  }, []);

  // ── Fetch active booking once user is loaded ──
  useEffect(() => {
    if (user?.phone) fetchActiveBooking(user.phone);
  }, [user]);

  // ── Countdown timers per slot ──
  useEffect(() => {
    const interval = setInterval(() => {
      setSlots(prev => {
        const updates = {};
        prev.forEach(s => {
          if (!s.available && s.expiryTime) {
            const secs = Math.floor((new Date(s.expiryTime) - Date.now()) / 1000);
            updates[s.number] = secs;
          }
        });
        setSlotTimers(updates);
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Filter slots ──
  useEffect(() => {
    let result = [...slots];
    if (searchTerm)                   result = result.filter(s => s.number.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filterStatus === 'available') result = result.filter(s => s.available);
    if (filterStatus === 'occupied')  result = result.filter(s => !s.available);
    if (filterFloor !== 'all')        result = result.filter(s => s.floor === filterFloor);
    setFilteredSlots(result);
  }, [slots, searchTerm, filterStatus, filterFloor]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const RATE_PER_MIN = 1;
  const calcAmount   = (mins) => mins * RATE_PER_MIN;

  // ── Step 1: Show STK banner for 1s then book ──
  const handlePay = async () => {
    const maxDigits = PHONE_LIMITS[bookingCC] || 10;
    if (bookingPhone.length !== maxDigits) {
      setBookingError(`Enter a valid ${maxDigits}-digit phone number`);
      return;
    }
    setBookingError('');
    setBookingStep('stk');   // show green STK banner

    setTimeout(async () => {
      setBookingLoading(true);
      try {
        const fullPhone = bookingCC.replace('+','') + bookingPhone;
        const res  = await fetch(`${API}/api/bookings/demo`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverPhone:  fullPhone,
            slotCode:     selectedSlot.number,
            duration:     bookingDuration,
            driverName:   user?.name        || '',
            plateNumber:  user?.plateNumber || '',
          }),
        });
        const data = await res.json();
        if (res.ok) {
          // Update slot locally
          setSlots(prev => prev.map(s =>
            s.number === selectedSlot.number
              ? { ...s, available: false, driverPhone: fullPhone, driverName: user?.name || '', plateNumber: user?.plateNumber || '', expiryTime: data.booking.expiryTime, bookingId: data.booking.bookingId }
              : s
          ));
          setActiveBooking(data.booking);
          setBookingStep('success');
          setTimeout(() => {
            setSelectedSlot(null);
            setBookingStep('form');
            setBookingPhone('');
            setBookingError('');
          }, 2000);
        } else {
          setBookingError(data.error || 'Booking failed');
          setBookingStep('form');
        }
      } catch {
        setBookingError('Cannot connect to backend');
        setBookingStep('form');
      }
      setBookingLoading(false);
    }, 1200);  // 1.2s STK banner display
  };

  // ── Fine recording ──
  const handleFineRecorded = async (booking) => {
    try {
      await fetch(`${API}/api/fines/record`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId:       booking._id || booking.bookingId,
          driverPhone:     booking.driverPhone,
          driverName:      booking.driverName   || user?.name || '',
          plateNumber:     booking.plateNumber  || user?.plateNumber || '',
          slotCode:        booking.slotCode,
          overstayMinutes: 1,
        }),
      });
    } catch (e) { console.error(e); }
  };

  // ── Profile save ──
  const handleSaveProfile = async () => {
    setProfileError(''); setProfileMsg(''); setProfileLoading(true);
    try {
      const token   = localStorage.getItem('token');
      const updates = {};
      if (profileTab === 'info') {
        const maxDigits = PHONE_LIMITS[editPhoneCC] || 10;
        if (editPhone && editPhone.length !== maxDigits) { setProfileError(`Phone must be ${maxDigits} digits`); setProfileLoading(false); return; }
        if (editPhone) updates.phone = editPhoneCC + editPhone;
        if (editPlate) updates.plateNumber = editPlate.toUpperCase();
        if (profilePhoto !== user.profilePhoto) updates.profilePhoto = profilePhoto;
      }
      if (profileTab === 'password') {
        if (!currentPass)                  { setProfileError('Enter your current password'); setProfileLoading(false); return; }
        if (newPassword.length < 8)        { setProfileError('New password must be at least 8 characters'); setProfileLoading(false); return; }
        if (newPassword !== confirmNewPass) { setProfileError('Passwords do not match'); setProfileLoading(false); return; }
        updates.currentPassword = currentPass;
        updates.newPassword     = newPassword;
      }
      const res  = await fetch(`${API}/api/auth/update-profile`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, ...updates }),
      });
      const data = await res.json();
      if (res.ok) {
        const updatedUser = { ...user, ...data.user };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setProfileMsg('✅ Profile updated!');
        setCurrentPass(''); setNewPassword(''); setConfirmNewPass('');
      } else {
        setProfileError(data.message || 'Update failed');
      }
    } catch { setProfileError('Cannot connect to backend'); }
    finally { setProfileLoading(false); }
  };

  const availableCount = slots.filter(s => s.available).length;
  const occupiedCount  = slots.filter(s => !s.available).length;

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0f14', color: '#fff', fontFamily: "'DM Sans',sans-serif", flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '40px' }}>🅿️</div>
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading Driver Portal...</p>
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
        @keyframes fadeUp   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes stkPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        .slot-card  { transition:transform 0.18s,box-shadow 0.18s; }
        .slot-card:hover { transform:translateY(-3px); }
        .filter-btn, .prof-tab { transition:all 0.18s; cursor:pointer; border:none; font-family:'DM Sans',sans-serif; }
        input:focus, select:focus, textarea:focus { outline:none; border-color:rgba(59,130,246,0.6) !important; }
      `}</style>

      {/* ══ HERO ══ */}
      <div style={{ position: 'relative', height: '300px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/Images/driver-bg main.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 40%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(10,14,25,0.55) 0%,rgba(10,14,25,0.85) 70%,#0d0f14 100%)' }} />

        {/* Navbar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '46px', height: '46px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', borderRadius: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 4px 16px rgba(59,130,246,0.4)' }}>🅿️</div>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '26px', color: '#fff', letterSpacing: '-0.5px' }}>Two Rivers</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>Driver Portal</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowProfile(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: "'DM Sans',sans-serif" }}>🚗 {user.name}</button>
            <button onClick={handleLogout} style={{ padding: '8px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: "'DM Sans',sans-serif" }}>Logout</button>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '32px', left: '40px', zIndex: 10 }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: '52px', fontWeight: 800, color: '#fff', letterSpacing: '-1px', lineHeight: 1.1 }}>Find Your Spot</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', marginTop: '8px' }}>{availableCount} slots available right now</p>
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px 100px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginTop: '28px', marginBottom: '28px' }}>
          {[
            { icon: '🟢', label: 'Available',   val: availableCount, color: '#22c55e', bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.2)'  },
            { icon: '🔴', label: 'Occupied',    val: occupiedCount,  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'  },
            { icon: '🅿️', label: 'Total Slots', val: slots.length,   color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
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

        {/* Active booking banner */}
        <ActiveBookingBanner booking={activeBooking} onFineRecorded={handleFineRecorded} />

        {/* Banner strip */}
        <div style={{ width: '100%', height: '180px', borderRadius: '16px', overflow: 'hidden', marginBottom: '28px', position: 'relative', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/Images/driver-bg 2.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(10,14,25,0.85) 0%,rgba(10,14,25,0.3) 60%,transparent 100%)', display: 'flex', alignItems: 'center', padding: '0 28px' }}>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700, color: '#fff' }}>Two Rivers Parking</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>3 levels · EV charging available · 24/7 security</div>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="🔍  Search by slot number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '13px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '14px', fontFamily: "'DM Sans',sans-serif" }} />
          {[
            { val: 'all',       label: 'All Slots'   },
            { val: 'available', label: '✓ Available' },
            { val: 'occupied',  label: '✗ Occupied'  },
          ].map(f => (
            <button key={f.val} className="filter-btn" onClick={() => setFilterStatus(f.val)} style={{ padding: '13px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 500, background: filterStatus === f.val ? (f.val === 'available' ? '#22c55e' : f.val === 'occupied' ? '#ef4444' : '#3b82f6') : 'rgba(255,255,255,0.05)', color: filterStatus === f.val ? '#fff' : 'rgba(255,255,255,0.45)', border: '1px solid ' + (filterStatus === f.val ? 'transparent' : 'rgba(255,255,255,0.08)') }}>{f.label}</button>
          ))}
          <select value={filterFloor} onChange={e => setFilterFloor(e.target.value)} style={{ padding: '13px 16px', borderRadius: '12px', fontSize: '13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontFamily: "'DM Sans',sans-serif" }}>
            <option value="all">All Levels</option>
            <option value="Level A">Level A</option>
            <option value="Level B">Level B</option>
            <option value="Level C">Level C</option>
          </select>
        </div>

        {/* Slots grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '14px' }}>
          {filteredSlots.map((slot, i) => {
            const secs       = slotTimers[slot.number];
            const isOverstay = !slot.available && secs !== undefined && secs <= 0;
            const isMySlot   = !slot.available && slot.driverPhone && user?.phone && slot.driverPhone === user.phone.replace(/^\+/,'');

            return (
              <div key={slot.id} className="slot-card" onClick={() => slot.available && setSelectedSlot(slot)}
                style={{ padding: '22px 20px', borderRadius: '16px',
                  border: isOverstay ? '2px solid rgba(239,68,68,0.6)' : slot.available ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.2)',
                  background: isOverstay ? 'rgba(239,68,68,0.08)' : slot.available ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.04)',
                  cursor: slot.available ? 'pointer' : 'default',
                  animation: `fadeUp 0.4s ${i * 0.03}s ease both`,
                }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '26px', fontWeight: 800, color: slot.available ? '#fff' : 'rgba(255,255,255,0.35)' }}>{slot.number}</div>
                  <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: slot.available ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)', color: slot.available ? '#4ade80' : '#f87171' }}>
                    {slot.available ? 'FREE' : isOverstay ? '⚠️ OVER' : 'TAKEN'}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>{slot.floor} · Section {slot.section}</div>
                <div style={{ display: 'inline-block', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: slot.type === 'EV' ? 'rgba(34,197,94,0.12)' : slot.type === 'Premium' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.06)', color: slot.type === 'EV' ? '#4ade80' : slot.type === 'Premium' ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>{slot.type}</div>

                {/* Countdown on card */}
                {!slot.available && secs !== undefined && (
                  <div style={{ marginTop: '10px', padding: '7px 10px', borderRadius: '8px', background: isOverstay ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.08)', border: `1px solid ${isOverstay ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.2)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{isOverstay ? '⚠️ Over' : '⏱'}</span>
                    <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '13px', fontWeight: 700, color: isOverstay ? '#f87171' : '#60a5fa' }}>
                      {isOverstay ? `+${formatCountdown(Math.abs(secs))}` : formatCountdown(secs)}
                    </span>
                  </div>
                )}

                {/* "Your slot" badge */}
                {isMySlot && (
                  <div style={{ marginTop: '8px', fontSize: '10px', color: '#60a5fa', fontWeight: 600 }}>🔵 Your slot</div>
                )}

                {slot.available && (
                  <div style={{ marginTop: '14px', padding: '8px', borderRadius: '10px', textAlign: 'center', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '12px', fontWeight: 600, color: '#60a5fa' }}>Select Slot</div>
                )}
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

      {/* ══ BOOKING MODAL ══ */}
      {selectedSlot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div style={{ background: '#13161b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '36px', width: '100%', maxWidth: '420px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>

            {/* ── SUCCESS STATE ── */}
            {bookingStep === 'success' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '52px', marginBottom: '16px' }}>✅</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 800, color: '#4ade80', marginBottom: '8px' }}>Booking Confirmed!</div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Slot {selectedSlot.number} is now yours. Countdown started.</div>
              </div>
            )}

            {/* ── STK BANNER STATE ── */}
            {bookingStep === 'stk' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'stkPulse 1s infinite' }}>📱</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 800, color: '#4ade80', marginBottom: '8px' }}>STK Push Sent!</div>
                <div style={{ padding: '14px 20px', borderRadius: '14px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: '14px', marginBottom: '16px' }}>
                  ✅ M-Pesa prompt sent to {bookingCC}{bookingPhone}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', animation: 'stkPulse 1.4s infinite' }}>Confirming booking...</div>
              </div>
            )}

            {/* ── FORM STATE ── */}
            {bookingStep === 'form' && (
              <>
                <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>Book Slot {selectedSlot.number}</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '28px' }}>{selectedSlot.floor} · Section {selectedSlot.section} · {selectedSlot.type}</p>

                {/* Duration */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={modalLabel}>Parking Duration</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '10px' }}>
                    {[30, 60, 120, 180].map(d => (
                      <button key={d} onClick={() => setBookingDuration(d)} style={{ padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: bookingDuration === d ? '#3b82f6' : 'rgba(255,255,255,0.06)', color: bookingDuration === d ? '#fff' : 'rgba(255,255,255,0.5)', fontFamily: "'DM Sans',sans-serif", fontSize: '13px', fontWeight: 600 }}>
                        {d < 60 ? `${d}m` : `${d/60}h`}
                      </button>
                    ))}
                  </div>
                  <input type="number" min="10" max="480" value={bookingDuration} onChange={e => setBookingDuration(Number(e.target.value))} style={{ ...modalInput, marginTop: '4px' }} placeholder="Custom minutes..." />
                  <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '6px', fontWeight: 600 }}>
                    💰 KSh {calcAmount(bookingDuration)} total (KSh 60/hr)
                  </div>
                </div>

                {/* Phone */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={modalLabel}>M-Pesa Phone Number</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select value={bookingCC} onChange={e => { setBookingCC(e.target.value); setBookingPhone(''); }} style={{ ...modalInput, width: 'auto', paddingRight: '10px' }}>
                      <option value="+254">🇰🇪 +254</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                    </select>
                    <input type="tel" value={bookingPhone}
                      onChange={e => { const val = e.target.value.replace(/\D/g,''); const max = PHONE_LIMITS[bookingCC]||10; if (val.length<=max) setBookingPhone(val); }}
                      placeholder={`${PHONE_LIMITS[bookingCC]||10} digits`}
                      style={{ ...modalInput, flex: 1 }} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>{bookingPhone.length}/{PHONE_LIMITS[bookingCC]||10} digits</div>
                </div>

                {bookingError && <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '13px', textAlign: 'center' }}>{bookingError}</div>}

                <button onClick={handlePay} disabled={bookingLoading} style={{ width: '100%', padding: '15px', borderRadius: '14px', border: 'none', background: bookingLoading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '15px', fontWeight: 600, cursor: bookingLoading ? 'not-allowed' : 'pointer', boxShadow: '0 8px 24px rgba(59,130,246,0.35)', marginBottom: '10px' }}>
                  {bookingLoading ? 'Processing...' : `Pay KSh ${calcAmount(bookingDuration)} via M-Pesa →`}
                </button>
                <button onClick={() => { setSelectedSlot(null); setBookingError(''); setBookingPhone(''); setBookingStep('form'); }} style={{ width: '100%', padding: '13px', borderRadius: '14px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ PROFILE MODAL ══ */}
      {showProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div style={{ background: '#13161b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '36px', width: '100%', maxWidth: '420px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div style={{ width: '80px', height: '80px', margin: '0 auto', borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(59,130,246,0.4)', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>
                  {profilePhoto ? <img src={profilePhoto} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🚗'}
                </div>
                <button onClick={() => photoInputRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: '26px', height: '26px', borderRadius: '50%', background: '#3b82f6', border: '2px solid #13161b', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onloadend = () => setProfilePhoto(r.result); r.readAsDataURL(f); }} style={{ display: 'none' }} />
              {profilePhoto && <button onClick={() => setProfilePhoto(null)} style={{ display: 'block', margin: '8px auto 0', fontSize: '11px', color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer' }}>Remove photo</button>}
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, marginTop: '10px' }}>{user.name}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Driver · {user.phone}</div>
              {user.plateNumber && (
                <div style={{ display: 'inline-block', marginTop: '6px', padding: '3px 12px', borderRadius: '8px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', fontSize: '13px', fontWeight: 700, color: '#60a5fa', letterSpacing: '2px' }}>🚘 {user.plateNumber}</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '4px' }}>
              {[{ key: 'info', label: '📋 Info' }, { key: 'password', label: '🔑 Password' }].map(t => (
                <button key={t.key} className="prof-tab" onClick={() => { setProfileTab(t.key); setProfileMsg(''); setProfileError(''); }} style={{ flex: 1, padding: '9px', borderRadius: '9px', fontSize: '12px', fontWeight: 600, background: profileTab === t.key ? 'rgba(59,130,246,0.2)' : 'transparent', color: profileTab === t.key ? '#60a5fa' : 'rgba(255,255,255,0.35)', border: profileTab === t.key ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent' }}>{t.label}</button>
              ))}
            </div>

            {profileTab === 'info' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={modalLabel}>Phone Number</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select value={editPhoneCC} onChange={e => { setEditPhoneCC(e.target.value); setEditPhone(''); }} style={{ ...modalInput, width: 'auto' }}>
                      <option value="+254">🇰🇪 +254</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                    </select>
                    <input type="tel" value={editPhone} placeholder="New phone" onChange={e => { const val = e.target.value.replace(/\D/g,''); const max = PHONE_LIMITS[editPhoneCC]||10; if (val.length<=max) setEditPhone(val); }} style={{ ...modalInput, flex: 1 }} />
                  </div>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={modalLabel}>Car Plate Number</label>
                  <input type="text" value={editPlate} placeholder="e.g. KCA 123A" onChange={e => setEditPlate(e.target.value.toUpperCase())} style={{ ...modalInput, letterSpacing: '2px' }} />
                </div>
              </div>
            )}

            {profileTab === 'password' && (
              <div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={modalLabel}>Current Password</label>
                  <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder="Enter current password" style={modalInput} />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={modalLabel}>New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" style={modalInput} />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={modalLabel}>Confirm New Password</label>
                  <input type="password" value={confirmNewPass} onChange={e => setConfirmNewPass(e.target.value)} placeholder="Repeat new password" style={modalInput} />
                </div>
              </div>
            )}

            {profileError && <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '13px', textAlign: 'center' }}>{profileError}</div>}
            {profileMsg   && <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '10px', background: 'rgba(34,197,94,0.1)',  border: '1px solid rgba(34,197,94,0.2)',  color: '#4ade80', fontSize: '13px', textAlign: 'center' }}>{profileMsg}</div>}

            <button onClick={handleSaveProfile} disabled={profileLoading} style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', background: profileLoading ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', fontWeight: 600, cursor: profileLoading ? 'not-allowed' : 'pointer', marginBottom: '10px' }}>
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={() => { setShowProfile(false); setProfileMsg(''); setProfileError(''); }} style={{ width: '100%', padding: '11px', borderRadius: '12px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Sans',sans-serif", fontSize: '13px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {/* Ask a Question floating button */}
      <AskQuestion user={user} />
    </div>
  );
};

const modalLabel = {
  display: 'block', fontSize: '11px', fontWeight: 600, color: '#6b7280',
  marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase',
};
const modalInput = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '14px', outline: 'none',
};

export default DriverPortal;
