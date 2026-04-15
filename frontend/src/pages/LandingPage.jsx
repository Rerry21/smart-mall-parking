import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#0d0f14', color: '#f0f2f5', fontFamily: "'DM Sans', sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #252a33; border-radius: 99px; }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
        @keyframes pulse    { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes float    { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-10px) } }
        .nav-btn  { transition: all 0.2s; }
        .nav-btn:hover  { background: rgba(255,255,255,0.12) !important; }
        .cta-primary:hover  { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(59,130,246,0.5) !important; }
        .cta-secondary:hover { background: rgba(255,255,255,0.1) !important; transform: translateY(-2px); }
        .step-card:hover { transform: translateY(-4px); border-color: rgba(59,130,246,0.4) !important; }
        .cta-primary, .cta-secondary, .step-card { transition: all 0.22s; }
      `}</style>

      {/* ══ NAVBAR ══ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(13,15,20,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 48px', height: '68px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 4px 14px rgba(59,130,246,0.4)' }}>🅿️</div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '17px', letterSpacing: '-0.3px', lineHeight: 1 }}>Two Rivers</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', textTransform: 'uppercase' }}>Smart Parking</div>
          </div>
        </div>

        {/* Nav actions */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="nav-btn"
            onClick={() => navigate('/admin-login')}
            style={{ padding: '8px 16px', borderRadius: '9px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
          >
            Admin
          </button>
          <button
            className="nav-btn"
            onClick={() => navigate('/login')}
            style={{ padding: '8px 20px', borderRadius: '9px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#60a5fa', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        {/* Background image */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/Images/driver-bg main.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 40%', zIndex: 0 }} />
        {/* Overlays */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(5,8,18,0.92) 0%,rgba(10,14,30,0.78) 60%,rgba(5,8,18,0.6) 100%)', zIndex: 1 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '200px', background: 'linear-gradient(to top,#0d0f14,transparent)', zIndex: 2 }} />

        {/* Hero content */}
        <div style={{ position: 'relative', zIndex: 3, maxWidth: '1100px', margin: '0 auto', padding: '0 48px', paddingTop: '68px', width: '100%' }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '99px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', fontSize: '12px', color: '#60a5fa', fontWeight: 600, marginBottom: '28px', animation: 'fadeUp 0.5s ease both' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.8s infinite' }} />
            Two Rivers Mall · Nairobi, Kenya
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 'clamp(42px,6vw,80px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-2px', marginBottom: '24px', animation: 'fadeUp 0.55s 0.1s ease both', animationFillMode: 'both' }}>
            Park Smarter<br />
            <span style={{ background: 'linear-gradient(135deg,#3b82f6,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              at Two Rivers
            </span>
          </h1>

          {/* Subtext */}
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.55)', maxWidth: '480px', lineHeight: 1.7, marginBottom: '40px', animation: 'fadeUp 0.55s 0.2s ease both', animationFillMode: 'both' }}>
            Find and book your parking slot instantly. Pay securely via M-Pesa and enjoy a seamless parking experience at Two Rivers Mall.
          </p>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', animation: 'fadeUp 0.55s 0.3s ease both', animationFillMode: 'both' }}>
            <button
              className="cta-primary"
              onClick={() => navigate('/login')}
              style={{ padding: '15px 36px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(59,130,246,0.4)' }}
            >
              Get Started →
            </button>
            <button
              className="cta-secondary"
              onClick={() => { document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' }); }}
              style={{ padding: '15px 36px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
            >
              How it works
            </button>
          </div>
        </div>

        {/* Floating parking icon */}
        <div style={{ position: 'absolute', right: '8%', top: '50%', transform: 'translateY(-50%)', zIndex: 3, animation: 'float 4s ease-in-out infinite', display: 'none' }} id="floating-icon">
          <div style={{ fontSize: '120px', opacity: 0.08 }}>🅿️</div>
        </div>
      </div>

      {/* ══ STATS STRIP ══ */}
      <div style={{ background: '#13161b', borderTop: '1px solid #252a33', borderBottom: '1px solid #252a33' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 48px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {[
            { icon: '🅿️', val: '51',    label: 'Parking Slots'   },
            { icon: '🏢', val: '3',      label: 'Levels'           },
            { icon: '🔒', val: '24/7',   label: 'Security'         },
            { icon: '💚', val: 'M-Pesa', label: 'Instant Payment'  },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: '28px 24px', display: 'flex', alignItems: 'center', gap: '14px', borderRight: i < 3 ? '1px solid #252a33' : 'none', animation: `fadeUp 0.5s ${0.1 * i}s ease both`, animationFillMode: 'both' }}>
              <span style={{ fontSize: '26px' }}>{s.icon}</span>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ HOW IT WORKS ══ */}
      <div id="how-it-works" style={{ maxWidth: '1100px', margin: '0 auto', padding: '96px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '12px' }}>Simple Process</div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: '14px' }}>How it works</h2>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.4)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.7 }}>
            Three simple steps to secure your parking spot at Two Rivers
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px' }}>
          {[
            { step: '01', icon: '🔍', title: 'Choose Your Slot', desc: 'Browse available parking slots across all 3 levels in real-time. Filter by floor or slot type.' },
            { step: '02', icon: '💚', title: 'Pay via M-Pesa',   desc: 'Enter your M-Pesa number and confirm the STK push on your phone. Secure and instant.' },
            { step: '03', icon: '🚗', title: 'Park & Go',        desc: 'Your slot is reserved. Drive in, park, and a countdown starts for your booked duration.' },
          ].map(s => (
            <div key={s.step} className="step-card" style={{ background: '#13161b', border: '1px solid #252a33', borderRadius: '20px', padding: '32px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div style={{ fontSize: '36px' }}>{s.icon}</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '13px', fontWeight: 800, color: 'rgba(59,130,246,0.3)', letterSpacing: '1px' }}>{s.step}</div>
              </div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>{s.title}</div>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ BOTTOM CTA BANNER ══ */}
      <div style={{ margin: '0 48px 96px', borderRadius: '24px', overflow: 'hidden', position: 'relative', maxWidth: '1004px', marginLeft: 'auto', marginRight: 'auto' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/Images/driver-bg 2.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(10,14,30,0.92),rgba(29,78,216,0.55))' }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '56px 52px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontSize: 'clamp(22px,3vw,34px)', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '10px' }}>
              Ready to park smarter?
            </h3>
            <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', maxWidth: '380px', lineHeight: 1.6 }}>
              Join drivers already using Two Rivers Smart Parking. Register in seconds.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="cta-primary"
              onClick={() => navigate('/login')}
              style={{ padding: '14px 32px', borderRadius: '12px', border: 'none', background: '#fff', color: '#0d0f14', fontFamily: "'DM Sans',sans-serif", fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
            >
              Register Now →
            </button>
            <button
              className="cta-secondary"
              onClick={() => navigate('/login')}
              style={{ padding: '14px 32px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontFamily: "'DM Sans',sans-serif", fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>

      {/* ══ FOOTER ══ */}
      <footer style={{ borderTop: '1px solid #252a33', padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🅿️</div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '14px', fontWeight: 700 }}>Two Rivers Smart Parking</div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>Two Rivers Mall · Nairobi, Kenya</div>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: '#4b5563' }}>© 2026 Two Rivers Mall. All rights reserved.</div>
      </footer>
    </div>
  );
}
