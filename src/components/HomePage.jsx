import { useEffect, useRef, useState } from "react";

const AD = {
  blue:"#2D5DDC", blueLt:"#EBF0FF", blueDk:"#1a3fa8",
  bg:"#EEEFF1", surface:"#FCFCFC", border:"#E2E6EA",
  text:"#151313", sub:"#64748B", muted:"#94A3B8",
  green:"#10B981", greenLt:"#D1FAE5",
  amber:"#F59E0B", red:"#EF4444",
};

// ── Spring physics counter ────────────────────────────────────────────────────
function Counter({ to, suffix = "" }) {
  const [val, setVal] = useState(0);
  const [triggered, setTriggered] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTriggered(true); obs.disconnect(); }
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!triggered) return;
    let current = 0; let velocity = 0;
    const stiffness = 55, damping = 9;
    let raf;
    const step = () => {
      const force = -stiffness * (current - to);
      velocity += (force - damping * velocity) * (1/60);
      current += velocity;
      if (Math.abs(current - to) < 0.4 && Math.abs(velocity) < 0.4) { setVal(Math.round(to)); return; }
      setVal(Math.round(current));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [triggered, to]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ── Magnetic button ───────────────────────────────────────────────────────────
function MagBtn({ children, style, onClick, className }) {
  const ref = useRef(null);
  const raf = useRef(null);
  const onMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width/2) * 0.3;
    const dy = (e.clientY - r.top  - r.height/2) * 0.3;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      if (ref.current) ref.current.style.transform = `translate(${dx}px,${dy}px)`;
    });
  };
  const onLeave = () => {
    cancelAnimationFrame(raf.current);
    if (ref.current) {
      ref.current.style.transition = "transform .55s cubic-bezier(0.34,1.56,0.64,1)";
      ref.current.style.transform = "translate(0,0)";
      setTimeout(() => { if (ref.current) ref.current.style.transition = ""; }, 600);
    }
  };
  return (
    <button type="button" ref={ref} onClick={onClick} className={className}
      onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ ...style, willChange:"transform" }}>
      {children}
    </button>
  );
}

// ── Scroll reveal ─────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, style = {} }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      ...style,
      opacity: vis ? 1 : 0,
      transform: vis ? "translateY(0) scale(1)" : "translateY(28px) scale(0.97)",
      transition: `opacity .7s ${delay}s cubic-bezier(0.25,0.46,0.45,0.94),
                   transform .7s ${delay}s cubic-bezier(0.34,1.56,0.64,1)`,
    }}>{children}</div>
  );
}

// ── Preview card ──────────────────────────────────────────────────────────────
function PreviewCard({ scrollY }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 200); return () => clearTimeout(t); }, []);
  const skills = [
    { label:"Listening", pct:87, score:"7.0" },
    { label:"Reading",   pct:81, score:"6.5" },
    { label:"Writing",   pct:75, score:"6.0" },
    { label:"Speaking",  pct:81, score:"6.5" },
  ];
  return (
    <div style={{
      transform: `translateY(${-Math.min(scrollY * 0.07, 18)}px)`,
      opacity: mounted ? 1 : 0,
      transition: "opacity .9s .3s cubic-bezier(0.25,0.46,0.45,0.94)",
      position:"relative",
    }}>
      {/* glow */}
      <div style={{ position:"absolute", inset:-50, borderRadius:40, zIndex:0, pointerEvents:"none",
        background:`radial-gradient(ellipse at 60% 40%, rgba(45,93,220,.15) 0%, transparent 68%)` }}/>
      <div style={{ position:"relative", zIndex:1,
        background:AD.surface, borderRadius:24, border:`1px solid ${AD.border}`,
        boxShadow:"0 40px 80px rgba(0,0,0,.13), 0 8px 20px rgba(45,93,220,.10)",
        overflow:"hidden" }}>
        {/* dots bar */}
        <div style={{ background:AD.bg, borderBottom:`1px solid ${AD.border}`,
          padding:"11px 16px", display:"flex", alignItems:"center", gap:6 }}>
          {["#EF4444","#F59E0B","#10B981"].map(c=>(
            <div key={c} style={{ width:9,height:9,borderRadius:"50%",background:c }}/>
          ))}
          <div style={{ flex:1, display:"flex", justifyContent:"center" }}>
            <div style={{ height:5,width:110,borderRadius:3,background:AD.border }}/>
          </div>
        </div>
        {/* header */}
        <div style={{ padding:"18px 20px",
          background:`linear-gradient(135deg,${AD.blue} 0%,${AD.blueDk} 100%)` }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:40,height:40,borderRadius:12,flexShrink:0,
              background:"rgba(255,255,255,.18)", backdropFilter:"blur(10px)",
              border:"1px solid rgba(255,255,255,.25)",
              display:"flex",alignItems:"center",justifyContent:"center" }}>
              <span style={{ fontSize:14,fontWeight:900,color:"#fff" }}>AK</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13,fontWeight:800,color:"#fff",lineHeight:1 }}>Aisha Karimova</div>
              <div style={{ fontSize:11,color:"rgba(255,255,255,.58)",marginTop:2 }}>IELTS B2 Group · 3rd month</div>
            </div>
            <div style={{ background:"rgba(255,255,255,.14)", backdropFilter:"blur(8px)",
              borderRadius:9, padding:"5px 12px", border:"1px solid rgba(255,255,255,.2)" }}>
              <span style={{ fontSize:14,fontWeight:900,color:"#fff" }}>6.5</span>
              <span style={{ fontSize:10,color:"rgba(255,255,255,.62)",marginLeft:3 }}>band</span>
            </div>
          </div>
        </div>
        {/* skills */}
        <div style={{ padding:"18px 20px" }}>
          <div style={{ fontSize:9,fontWeight:700,color:AD.muted,
            letterSpacing:".06em",textTransform:"uppercase",marginBottom:12 }}>Skill Scores</div>
          {skills.map(({ label, pct, score }, i) => (
            <div key={label} style={{ marginBottom:11 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                <span style={{ fontSize:11,color:AD.sub,fontWeight:600 }}>{label}</span>
                <span style={{ fontSize:11,fontWeight:800,color:AD.text }}>{score}</span>
              </div>
              <div style={{ height:6,borderRadius:3,background:AD.bg,overflow:"hidden" }}>
                <div style={{ height:"100%",borderRadius:3,
                  background:`linear-gradient(90deg,${AD.blue},#6ea0f7)`,
                  width: mounted ? `${pct}%` : "0%",
                  transition: `width 1s cubic-bezier(0.34,1.56,0.64,1) ${.55+i*.1}s`,
                }}/>
              </div>
            </div>
          ))}
        </div>
        {/* next class */}
        <div style={{ margin:"0 16px 16px", background:AD.bg, borderRadius:12,
          padding:"12px 14px", border:`1px solid ${AD.border}`,
          display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:32,height:32,borderRadius:9,background:AD.blueLt,flexShrink:0,
            display:"flex",alignItems:"center",justifyContent:"center" }}>
            <div style={{ width:12,height:12,borderRadius:3,background:AD.blue }}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11,fontWeight:700,color:AD.text,lineHeight:1 }}>Writing Workshop</div>
            <div style={{ fontSize:10,color:AD.muted,marginTop:2 }}>Tomorrow · 14:00 — 15:30</div>
          </div>
          <span style={{ fontSize:11,fontWeight:700,color:AD.blue }}>Join →</span>
        </div>
      </div>
      {/* floating badge */}
      <div style={{ position:"absolute", bottom:-16, right:28, zIndex:2,
        background:AD.green, borderRadius:12, padding:"9px 14px",
        boxShadow:"0 8px 24px rgba(16,185,129,.3)",
        display:"flex",alignItems:"center",gap:7,
        animation:"lc-float 3.5s ease-in-out infinite" }}>
        <div style={{ width:7,height:7,borderRadius:"50%",background:"rgba(255,255,255,.72)",
          animation:"lc-pulse 2s ease-in-out infinite" }}/>
        <span style={{ fontSize:12,fontWeight:800,color:"#fff" }}>Band ↑ +0.5 this month</span>
      </div>
    </div>
  );
}

// ── Global CSS ────────────────────────────────────────────────────────────────
const CSS = `
.lc-hero-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 72px;
  align-items: center;
}
@media (max-width: 760px) {
  .lc-hero-grid { grid-template-columns: 1fr; gap: 48px; }
  .lc-hero-card { display: none; }
  .lc-stat-grid { grid-template-columns: repeat(2,1fr)!important; }
  .lc-benefits-grid { grid-template-columns: 1fr!important; }
  .lc-steps-grid { grid-template-columns: 1fr!important; }
}

@keyframes lc-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes lc-pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.45;transform:scale(1.5)} }
@keyframes lc-shimmer{ 0%{background-position:-200% center} 100%{background-position:200% center} }
@keyframes lc-glow   { 0%,100%{opacity:.45} 50%{opacity:.9} }
@keyframes lc-ring   { 0%{transform:scale(1);opacity:.65} 100%{transform:scale(2.6);opacity:0} }

.lc-btn {
  transition: box-shadow .25s cubic-bezier(0.23,1,0.32,1);
  position:relative; overflow:hidden;
}
.lc-btn::after {
  content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
  background:linear-gradient(180deg,rgba(255,255,255,.18) 0%,transparent 55%);
}
.lc-btn:hover  { box-shadow:0 18px 44px rgba(45,93,220,.44)!important; }
.lc-btn:active { transform:scale(0.95)!important; transition:transform .08s ease!important; }

.lc-ghost { transition:background .2s cubic-bezier(0.23,1,0.32,1),color .2s,border-color .2s,box-shadow .2s; }
.lc-ghost:hover { background:${AD.blueLt}!important; color:${AD.blue}!important; border-color:${AD.blue}!important; }
.lc-ghost:active { transform:scale(0.96)!important; }

.lc-card {
  transition: transform .35s cubic-bezier(0.34,1.56,0.64,1), box-shadow .3s cubic-bezier(0.23,1,0.32,1);
}
.lc-card:hover {
  transform: translateY(-9px) scale(1.015);
  box-shadow: 0 28px 64px rgba(45,93,220,.16)!important;
}

.lc-step { transition:transform .32s cubic-bezier(0.34,1.56,0.64,1), box-shadow .3s; }
.lc-step:hover { transform:translateY(-7px); box-shadow:0 20px 48px rgba(0,0,0,.09)!important; }
.lc-step:hover .lc-step-n { background:${AD.blue}!important; color:#fff!important; transform:scale(1.1)!important; }
.lc-step-n { transition:background .22s, color .22s, transform .3s cubic-bezier(0.34,1.56,0.64,1); }

.lc-stat { transition:transform .3s cubic-bezier(0.34,1.56,0.64,1); }
.lc-stat:hover { transform:scale(1.05); }
`;

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HomePage({ onStart, onStudentLogin }) {
  const [scrollY, setScrollY] = useState(0);
  const [heroReady, setHeroReady] = useState(false);

  useEffect(() => { const t = setTimeout(() => setHeroReady(true), 60); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const fn = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", fn, { passive:true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const headline1 = ["Get", "the", "IELTS", "score"];
  const headline2 = ["you", "actually", "need."];

  const benefits = [
    { label:"Expert IELTS teachers",  desc:"Certified teachers with 8+ years of IELTS and Cambridge prep. Small groups, real feedback.", color:AD.blue },
    { label:"AI writing evaluation",  desc:"Submit any writing task and get an instant band score with vocabulary and grammar notes.", color:AD.green },
    { label:"Full IELTS mock tests",  desc:"Timed Listening, Reading, Writing, and Speaking tests with automated band scores — anytime.", color:AD.amber },
    { label:"Live group classes",     desc:"Max 8 students per group so your teacher knows your name, your level, your weakest skill.", color:"#8B5CF6" },
    { label:"Track every result",     desc:"All your scores in one place. See exactly how each skill improves — or where you're losing points.", color:"#06B6D4" },
    { label:"Speaking with examiner", desc:"Book one-on-one practice sessions with a certified examiner for real examiner-level feedback.", color:AD.red },
  ];

  const steps = [
    { n:"01", title:"Apply for a course",  desc:"Fill in a short form. We'll contact you, assess your level, and place you in the right group." },
    { n:"02", title:"Start your classes",  desc:"Attend live sessions, get materials and assignments — everything in one place." },
    { n:"03", title:"Track your progress", desc:"Every test result, every skill score, every session — logged automatically." },
  ];

  const parallax = -Math.min(scrollY * 0.3, 90);

  return (
    <>
      <style>{CSS}</style>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section style={{ background:AD.surface, padding:"88px 24px 80px",
        overflow:"hidden", position:"relative" }}>
        {/* bg orbs */}
        <div style={{ position:"absolute", top:-80, right:"6%", width:600, height:600,
          borderRadius:"50%", pointerEvents:"none",
          background:"radial-gradient(ellipse at center, rgba(45,93,220,.07) 0%, transparent 68%)",
          transform:`translateY(${-parallax*.4}px)` }}/>
        <div style={{ position:"absolute", bottom:-40, left:"10%", width:360, height:360,
          borderRadius:"50%", pointerEvents:"none",
          background:"radial-gradient(ellipse at center, rgba(16,185,129,.06) 0%, transparent 68%)",
          transform:`translateY(${parallax*.2}px)` }}/>

        <div className="lc-hero-grid" style={{ maxWidth:1040, margin:"0 auto", position:"relative", zIndex:1 }}>

          {/* left */}
          <div>
            {/* location pill */}
            <div style={{
              display:"inline-flex", alignItems:"center", gap:8, padding:"7px 16px",
              borderRadius:99, border:`1px solid ${AD.border}`, background:AD.bg,
              marginBottom:32,
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0)" : "translateY(14px)",
              transition:"opacity .6s .05s, transform .65s .05s cubic-bezier(0.34,1.56,0.64,1)",
            }}>
              <span style={{ position:"relative", width:10, height:10,
                display:"inline-flex",alignItems:"center",justifyContent:"center" }}>
                <span style={{ position:"absolute", width:10, height:10, borderRadius:"50%",
                  background:AD.blue, animation:"lc-ring 2.2s ease-out infinite" }}/>
                <span style={{ width:7, height:7, borderRadius:"50%", background:AD.blue }}/>
              </span>
              <span style={{ fontSize:11, fontWeight:700, color:AD.sub,
                letterSpacing:".06em", textTransform:"uppercase" }}>
                Yerevan · IELTS Preparation
              </span>
            </div>

            {/* animated headline */}
            <h1 style={{ fontSize:"clamp(34px,4.4vw,56px)", fontWeight:900, color:AD.text,
              letterSpacing:"-0.05em", lineHeight:1.07, margin:"0 0 6px",
              perspective:"600px" }}>
              {headline1.map((w, i) => (
                <span key={w} style={{
                  display:"inline-block", marginRight:"0.22em",
                  opacity: heroReady ? 1 : 0,
                  transform: heroReady ? "translateY(0) rotateX(0deg)" : "translateY(22px) rotateX(-14deg)",
                  transition:`opacity .65s ${.1+i*.07}s cubic-bezier(0.25,0.46,0.45,0.94),
                              transform .72s ${.1+i*.07}s cubic-bezier(0.34,1.56,0.64,1)`,
                }}>{w}</span>
              ))}
            </h1>
            <h1 style={{ fontSize:"clamp(34px,4.4vw,56px)", fontWeight:900,
              letterSpacing:"-0.05em", lineHeight:1.07, margin:"0 0 26px",
              color: AD.blue,
              perspective:"600px",
            }}>
              {headline2.map((w, i) => (
                <span key={w} style={{
                  display:"inline-block", marginRight:"0.22em",
                  opacity: heroReady ? 1 : 0,
                  transform: heroReady ? "translateY(0) rotateX(0deg)" : "translateY(22px) rotateX(-14deg)",
                  transition:`opacity .65s ${.38+i*.07}s cubic-bezier(0.25,0.46,0.45,0.94),
                              transform .72s ${.38+i*.07}s cubic-bezier(0.34,1.56,0.64,1)`,
                }}>{w}</span>
              ))}
            </h1>

            <p style={{
              fontSize:16, color:AD.sub, lineHeight:1.8, margin:"0 0 40px", maxWidth:430,
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0)" : "translateY(14px)",
              transition:"opacity .7s .65s cubic-bezier(0.25,0.46,0.45,0.94), transform .7s .65s cubic-bezier(0.34,1.56,0.64,1)",
            }}>
              LingvoConnect prepares students for IELTS with expert teachers, small groups, and a platform that tracks every score — so you always know how close you are to your goal.
            </p>

            {/* CTAs */}
            <div style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0)" : "translateY(14px)",
              transition:"opacity .7s .8s, transform .7s .8s cubic-bezier(0.34,1.56,0.64,1)",
            }}>
              <MagBtn onClick={onStudentLogin} className="lc-btn" style={{
                display:"block", width:"fit-content",
                padding:"16px 40px", fontSize:15, fontWeight:700,
                borderRadius:14, cursor:"pointer", border:"none",
                background:AD.blue, color:"#fff", letterSpacing:"-0.01em",
                boxShadow:`0 8px 28px rgba(45,93,220,.38)`,
                marginBottom:22,
              }}>Apply for a course →</MagBtn>

              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ flex:1, height:1, background:AD.border }}/>
                <span style={{ fontSize:12, color:AD.muted, fontWeight:500 }}>already a student?</span>
                <div style={{ flex:1, height:1, background:AD.border }}/>
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <button type="button" onClick={onStudentLogin} className="lc-ghost" style={{
                  padding:"11px 22px", fontSize:13, fontWeight:700, borderRadius:12,
                  cursor:"pointer", background:"transparent",
                  border:`1.5px solid ${AD.border}`, color:AD.sub, letterSpacing:"-0.01em",
                }}>Sign in to my account</button>
                <button type="button" onClick={onStart} className="lc-ghost" style={{
                  padding:"11px 22px", fontSize:13, fontWeight:600, borderRadius:12,
                  cursor:"pointer", background:"transparent",
                  border:`1.5px solid ${AD.border}`, color:AD.sub, letterSpacing:"-0.01em",
                }}>Free IELTS test</button>
              </div>
            </div>
          </div>

          {/* right */}
          <div className="lc-hero-card" style={{ position:"relative" }}>
            <PreviewCard scrollY={scrollY} />
          </div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────────────────── */}
      <section style={{ background:AD.blue, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:1,
          background:"linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)",
          backgroundSize:"200% auto", animation:"lc-shimmer 3.5s linear infinite" }}/>
        <div className="lc-stat-grid" style={{ maxWidth:960, margin:"0 auto", padding:"0 24px",
          display:"grid", gridTemplateColumns:"repeat(4,1fr)" }}>
          {[
            { to:2400,  suffix:"+", label:"Students taught" },
            { to:18000, suffix:"+", label:"Practice tests taken" },
            { to:94,    suffix:"%", label:"Reached target score" },
            { to:3,     suffix:" months", label:"Average time to goal" },
          ].map(({ to, suffix, label }, i) => (
            <div key={label} className="lc-stat" style={{
              padding:"32px 20px", textAlign:"center",
              borderRight: i < 3 ? "1px solid rgba(255,255,255,.14)" : "none",
            }}>
              <div style={{ fontSize:44, fontWeight:900, color:"#fff",
                letterSpacing:"-0.06em", lineHeight:1, marginBottom:5 }}>
                <Counter to={to} suffix={suffix}/>
              </div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,.62)", fontWeight:500 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BENEFITS ──────────────────────────────────────────────────────── */}
      <section style={{ background:AD.bg, padding:"88px 24px", overflow:"hidden" }}>
        <div style={{ maxWidth:980, margin:"0 auto" }}>
          <Reveal style={{ textAlign:"center", marginBottom:56 }}>
            <h2 style={{ fontSize:"clamp(24px,3.2vw,44px)", fontWeight:900, color:AD.text,
              letterSpacing:"-0.048em", margin:"0 0 14px" }}>
              What you get as a<br/>
              <span style={{ color:AD.blue }}>LingvoConnect student</span>
            </h2>
            <p style={{ fontSize:15, color:AD.sub, maxWidth:430, margin:"0 auto", lineHeight:1.7 }}>
              Every course includes live classes, the full platform, and teacher support — no extra subscriptions.
            </p>
          </Reveal>
          <div className="lc-benefits-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(288px,1fr))", gap:14 }}>
            {benefits.map(({ label, desc, color }, i) => (
              <Reveal key={label} delay={i * 0.07}>
                <div className="lc-card" style={{
                  background:AD.surface, borderRadius:18, border:`1px solid ${AD.border}`,
                  padding:"26px 24px", height:"100%",
                  boxShadow:"0 2px 8px rgba(0,0,0,.04)",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:14 }}>
                    <div style={{ width:38,height:38,borderRadius:12,background:AD.bg,
                      border:`1px solid ${AD.border}`,flexShrink:0,
                      display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <div style={{ width:14,height:14,borderRadius:4,background:color,
                        boxShadow:`0 3px 8px ${color}55` }}/>
                    </div>
                    <span style={{ fontSize:14,fontWeight:700,color:AD.text,letterSpacing:"-0.025em" }}>{label}</span>
                  </div>
                  <p style={{ fontSize:13,color:AD.sub,lineHeight:1.7,margin:0 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
      <section style={{ background:AD.surface, padding:"80px 24px",
        borderTop:`1px solid ${AD.border}`, overflow:"hidden" }}>
        <div style={{ maxWidth:780, margin:"0 auto", textAlign:"center" }}>
          <Reveal>
            <h2 style={{ fontSize:"clamp(22px,3vw,40px)", fontWeight:900, color:AD.text,
              letterSpacing:"-0.045em", margin:"0 0 12px" }}>How it works</h2>
            <p style={{ fontSize:15, color:AD.sub, margin:"0 0 52px" }}>From application to band score — three steps.</p>
          </Reveal>
          <div className="lc-steps-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:18 }}>
            {steps.map(({ n, title, desc }, i) => (
              <Reveal key={n} delay={i * 0.11}>
                <div className="lc-step" style={{
                  background:AD.bg, borderRadius:18, border:`1px solid ${AD.border}`,
                  padding:"30px 24px", textAlign:"center",
                  boxShadow:"0 2px 8px rgba(0,0,0,.04)",
                }}>
                  <div className="lc-step-n" style={{
                    width:44,height:44,borderRadius:14,background:AD.blueLt,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    margin:"0 auto 18px",
                    fontSize:13,fontWeight:900,color:AD.blue,letterSpacing:"-0.04em",
                  }}>{n}</div>
                  <div style={{ fontSize:15,fontWeight:800,color:AD.text,
                    letterSpacing:"-0.03em",marginBottom:9 }}>{title}</div>
                  <p style={{ fontSize:13,color:AD.sub,lineHeight:1.7,margin:0 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ─────────────────────────────────────────────────────── */}
      <section style={{ position:"relative", padding:"100px 24px", textAlign:"center",
        background:`linear-gradient(135deg, ${AD.blue} 0%, ${AD.blueDk} 60%, #0d2d7a 100%)`,
        overflow:"hidden" }}>
        {/* orbs */}
        <div style={{ position:"absolute", top:-100, left:"12%", width:520, height:520,
          borderRadius:"50%", background:"rgba(255,255,255,.04)", pointerEvents:"none" }}/>
        <div style={{ position:"absolute", bottom:-80, right:"8%", width:420, height:420,
          borderRadius:"50%", background:"rgba(255,255,255,.04)", pointerEvents:"none",
          animation:"lc-glow 4s ease-in-out infinite" }}/>
        {/* dot grid */}
        <div style={{ position:"absolute", inset:0, opacity:.07, pointerEvents:"none",
          backgroundImage:"radial-gradient(circle, rgba(255,255,255,.7) 1px, transparent 1px)",
          backgroundSize:"40px 40px" }}/>

        <div style={{ maxWidth:560, margin:"0 auto", position:"relative", zIndex:1 }}>
          <Reveal distance={18}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"7px 16px",
              borderRadius:99, background:"rgba(255,255,255,.11)",
              border:"1px solid rgba(255,255,255,.2)", marginBottom:28 }}>
              <div style={{ width:7,height:7,borderRadius:"50%",background:AD.green,
                animation:"lc-pulse 2s ease-in-out infinite" }}/>
              <span style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.82)",
                letterSpacing:".05em",textTransform:"uppercase" }}>Enrollment open now</span>
            </div>

            <h2 style={{ fontSize:"clamp(26px,3.8vw,48px)", fontWeight:900, color:"#fff",
              letterSpacing:"-0.05em", lineHeight:1.1, margin:"0 0 18px" }}>
              Ready to reach your<br/>IELTS target?
            </h2>
            <p style={{ fontSize:16, color:"rgba(255,255,255,.66)", margin:"0 0 44px", lineHeight:1.75 }}>
              Apply now and our team will contact you, assess your level, and get you started in the right group within days.
            </p>

            <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
              <MagBtn onClick={onStudentLogin} className="lc-btn" style={{
                padding:"17px 48px", fontSize:15, fontWeight:700, borderRadius:14, cursor:"pointer",
                border:"none", background:"#fff", color:AD.blue, letterSpacing:"-0.01em",
                boxShadow:"0 10px 32px rgba(0,0,0,.22)",
              }}>Apply for a course</MagBtn>

              <button type="button" onClick={onStudentLogin} className="lc-ghost" style={{
                padding:"17px 32px", fontSize:14, fontWeight:600, borderRadius:14, cursor:"pointer",
                background:"rgba(255,255,255,.1)", border:"1.5px solid rgba(255,255,255,.24)",
                color:"#fff", letterSpacing:"-0.01em",
              }}>Student login</button>
            </div>

            <p style={{ fontSize:12, color:"rgba(255,255,255,.36)", marginTop:24 }}>
              IELTS · General English · Business English · Cambridge
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
