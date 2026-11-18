import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, ArrowLeft, AlertCircle } from "lucide-react";
import { isStudentLoggedIn, getStudentSession, loginStudent } from "../../lib/studentAuth.js";
import { isTeacherLoggedIn, loginTeacher } from "../../lib/teacherAuth.js";

const AD = {
  blue:"#2D5DDC", blueLt:"#EBF0FF", blueDk:"#1a3fa8",
  bg:"#EEEFF1", surface:"#FCFCFC", border:"#E2E6EA",
  text:"#151313", sub:"#64748B", muted:"#94A3B8",
  red:"#EF4444", redLt:"#FEE2E2",
};

export default function LoginPage() {
  const navigate = useNavigate();

  // Already logged in — redirect
  if (isTeacherLoggedIn()) return <Navigate to="/teacher" replace />;
  if (isStudentLoggedIn()) {
    const s = getStudentSession();
    if (s && s.status !== "pending") return <Navigate to="/student" replace />;
  }

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError("Enter your username and password."); return; }
    setLoading(true); setError("");
    try {
      // Try student first
      const student = await loginStudent(username.trim(), password);
      if (student) {
        if (student.status === "pending") navigate("/signup?pending=1");
        else if (student.force_pw_change) navigate("/change-password");
        else navigate("/student");
        return;
      }
      // Try teacher
      const teacher = await loginTeacher(username.trim(), password);
      if (teacher) { navigate("/teacher"); return; }
      setError("Username or password is incorrect.");
    } catch (err) {
      setError(err?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:24, fontFamily:"system-ui,sans-serif",
      background:`radial-gradient(ellipse 80% 60% at 50% -10%, ${AD.blueLt} 0%, ${AD.bg} 60%)` }}>

      {/* brand mark */}
      <div style={{ marginBottom:28, textAlign:"center" }}>
        <div style={{ fontSize:13, fontWeight:700, color:AD.blue, letterSpacing:"0.08em",
          textTransform:"uppercase" }}>LingvoConnect</div>
      </div>

      {/* card */}
      <div style={{ width:"100%", maxWidth:380, background:AD.surface,
        borderRadius:20, border:`1px solid ${AD.border}`,
        boxShadow:"0 8px 32px rgba(45,93,220,.10), 0 2px 8px rgba(0,0,0,.06)", overflow:"hidden" }}>

        {/* header */}
        <div style={{ padding:"32px 32px 0" }}>
          <h1 style={{ color:AD.text, fontWeight:800, fontSize:26, letterSpacing:"-0.04em",
            margin:0, lineHeight:1.15 }}>Sign in</h1>
          <p style={{ color:AD.muted, fontSize:13, margin:"6px 0 24px", fontWeight:500 }}>
            Sign in to your LingvoConnect account
          </p>
          <div style={{ height:1, background:AD.border, margin:"0 -32px 28px" }}/>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} style={{ padding:"0 32px 32px" }}>
          {error && (
            <div style={{ display:"flex",alignItems:"flex-start",gap:10,padding:"12px 14px",
              background:AD.redLt,borderRadius:10,border:`1px solid ${AD.red}22`,marginBottom:20 }}>
              <AlertCircle size={15} color={AD.red} style={{ flexShrink:0,marginTop:1 }}/>
              <span style={{ fontSize:13,color:AD.red,lineHeight:1.5 }}>{error}</span>
            </div>
          )}

          <div style={{ marginBottom:18 }}>
            <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
              letterSpacing:".06em",textTransform:"uppercase",marginBottom:7 }}>
              Username or email
            </label>
            <input
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              style={{ width:"100%",boxSizing:"border-box",padding:"11px 14px",
                borderRadius:11,border:`1.5px solid ${AD.border}`,fontSize:14,
                color:AD.text,background:AD.surface,outline:"none",
                transition:"border-color .15s",fontFamily:"inherit" }}
              onFocus={e => e.target.style.borderColor = AD.blue}
              onBlur={e => e.target.style.borderColor = AD.border}
            />
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
              letterSpacing:".06em",textTransform:"uppercase",marginBottom:7 }}>
              Password
            </label>
            <div style={{ position:"relative" }}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ width:"100%",boxSizing:"border-box",padding:"11px 42px 11px 14px",
                  borderRadius:11,border:`1.5px solid ${AD.border}`,fontSize:14,
                  color:AD.text,background:AD.surface,outline:"none",
                  transition:"border-color .15s",fontFamily:"inherit" }}
                onFocus={e => e.target.style.borderColor = AD.blue}
                onBlur={e => e.target.style.borderColor = AD.border}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{
                position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                background:"none",border:"none",cursor:"pointer",color:AD.muted,
                display:"flex",alignItems:"center",padding:2,
              }}>
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{
            width:"100%",padding:"13px",borderRadius:12,border:"none",cursor:"pointer",
            background: loading ? AD.muted : AD.blue,color:"#fff",
            fontSize:14,fontWeight:700,letterSpacing:"-0.01em",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            transition:"background .15s",
          }}>
            {loading
              ? <><div style={{ width:16,height:16,border:"2px solid rgba(255,255,255,.35)",
                  borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite" }}/> Signing in…</>
              : <><LogIn size={16}/>Sign in</>
            }
          </button>

          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

          <div style={{ marginTop:20,textAlign:"center" }}>
            <span style={{ fontSize:13,color:AD.muted }}>Don't have an account? </span>
            <button type="button" onClick={() => navigate("/signup")} style={{
              background:"none",border:"none",cursor:"pointer",
              fontSize:13,fontWeight:700,color:AD.blue,padding:0,
            }}>Sign up</button>
          </div>
        </form>
      </div>

      {/* back link */}
      <button type="button" onClick={() => navigate("/")} style={{
        marginTop:20,background:"none",border:"none",cursor:"pointer",
        display:"flex",alignItems:"center",gap:6,
        fontSize:13,color:AD.sub,fontWeight:500,
      }}>
        <ArrowLeft size={14}/> Back to home
      </button>
    </div>
  );
}
