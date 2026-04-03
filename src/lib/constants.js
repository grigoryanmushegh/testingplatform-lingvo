// ── FONTS: Montserrat everywhere ──────────────────────────────────────────────
(() => {
  const l = document.createElement("link");
  l.href = "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=JetBrains+Mono:wght@400;600&display=swap";
  l.rel = "stylesheet"; document.head.appendChild(l);
})();

// ── PALETTE ───────────────────────────────────────────────────────────────────
export const C = {
  brand:    "#11CD87",   // Lingvo green
  brandD:   "#0BA870",
  brandL:   "#E6FAF4",
  brandM:   "#3DDBA3",
  teal:     "#0D9488",
  tealL:    "#CCFBF1",
  amber:    "#D97706",
  amberL:   "#FEF3C7",
  rose:     "#E11D48",
  roseL:    "#FFE4E6",
  violet:   "#0BA870",
  bg:       "#F5FEFA",
  surface:  "#FFFFFF",
  s900:     "#0F172A",
  s800:     "#1E293B",
  s600:     "#475569",
  s400:     "#94A3B8",
  s200:     "#E2E8F0",
  s100:     "#F1F5F9",
  hlY:      "#FEF08A",
  hlB:      "#BAE6FD",
};

// ── GLOBAL CSS ────────────────────────────────────────────────────────────────
const gs = document.createElement("style");
gs.textContent = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;background:${C.bg}}
  body{font-family:'Montserrat',sans-serif;font-size:14px;color:${C.s900};-webkit-font-smoothing:antialiased}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${C.s200};border-radius:99px}
  input,textarea,select,button{font-family:'Montserrat',sans-serif}
  textarea:focus,input:focus,select:focus{outline:2px solid ${C.brand};outline-offset:0;border-color:${C.brand}!important}
  .hl-y{background:${C.hlY};border-radius:3px;padding:0 2px}
  .hl-b{background:${C.hlB};border-radius:3px;padding:0 2px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(17,205,135,.35)}50%{box-shadow:0 0 0 8px rgba(17,205,135,0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}
  .fu{animation:fadeUp .3s ease both}
  .spin{animation:spin 1s linear infinite}

  /* ── iPad / tablet responsive ──────────────────────────────────────────── */
  /* Use dvh (dynamic viewport height) so iOS keyboard shrink is respected   */
  .test-shell { height: calc(100dvh - 130px); display:flex; flex-direction:column; }

  /* Listening: sidebar on top, questions below on small screens */
  .listen-grid { display:grid; grid-template-columns:300px 1fr; flex:1; overflow:hidden; }
  @media (max-width: 900px) {
    .listen-grid { grid-template-columns:1fr; grid-template-rows:auto 1fr; }
    .listen-sidebar { max-height:220px; overflow-y:auto; }
  }

  /* Reading / Writing: side-by-side → stacked on iPad portrait */
  .split-grid { display:grid; grid-template-columns:1fr 1fr; flex:1; overflow:hidden; }
  @media (max-width: 900px) {
    .split-grid { grid-template-columns:1fr; grid-template-rows:1fr 1fr; }
    .split-grid > * { overflow:auto; }
  }

  /* Prevent body scroll when virtual keyboard opens on iOS */
  body.exam-active { position:fixed; width:100%; overflow:hidden; }

  /* Tab bar wraps nicely on iPad */
  .section-tabbar { overflow-x:auto; -webkit-overflow-scrolling:touch; white-space:nowrap; }

  /* Make sure textareas scroll properly on iOS */
  textarea { -webkit-overflow-scrolling: touch; }

  /* Safe area insets for iPad home-bar */
  .topbar-safe { padding-bottom: env(safe-area-inset-bottom, 0); }
`;
document.head.appendChild(gs);
