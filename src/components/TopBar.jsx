const AD = {
  blue:"#2D5DDC", blueLt:"#EBF0FF",
  bg:"#EEEFF1", surface:"#FCFCFC", border:"#E2E6EA",
  text:"#151313", sub:"#64748B",
};

const CSS = `
.lc-tb-btn { transition:background .15s,color .15s,border-color .15s; }
.lc-tb-btn:hover { background:${AD.blueLt}!important; color:${AD.blue}!important; border-color:${AD.blue}!important; }
.lc-tb-cta { transition:opacity .15s; }
.lc-tb-cta:hover { opacity:.88!important; }
`;

export default function TopBar({ onAdmin, onLogin, onSignUp }) {
  return (
    <>
      <style>{CSS}</style>
      <div style={{
        background: AD.surface,
        borderBottom: `1px solid ${AD.border}`,
        padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 62,
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 0 #E2E6EA",
      }}>
        {/* logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9,
            background: `linear-gradient(135deg,${AD.blue},#1a3fa8)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 2px 8px rgba(45,93,220,.30)`,
          }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 15, letterSpacing: "-0.03em" }}>L</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: AD.text, letterSpacing: "-0.03em" }}>LingvoConnect</span>
        </div>

        {/* actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onSignUp && (
            <button type="button" onClick={onSignUp} className="lc-tb-btn" style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: "pointer",
              background: "transparent", border: `1.5px solid ${AD.border}`, color: AD.sub,
              fontFamily: "inherit",
            }}>
              Sign Up
            </button>
          )}
          {onLogin && (
            <button type="button" onClick={onLogin} className="lc-tb-cta" style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 700, borderRadius: 9, cursor: "pointer",
              background: AD.blue, color: "#fff", border: "none",
              fontFamily: "inherit",
            }}>
              Sign In
            </button>
          )}
        </div>
      </div>
    </>
  );
}
