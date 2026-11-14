import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookOpen, CalendarDays, ClipboardList, TrendingUp, ArrowLeft, LogIn } from "lucide-react";
import { getAllStudents, getStudentAssignments, getStudentAttempts } from "../../lib/studentDb.js";
import { getStudentGroups, getMaterials } from "../../lib/lmsDb.js";

const AD = {
  blue:"#2D5DDC", blueLt:"#EBF0FF", blueDk:"#1a3fa8",
  bg:"#EEEFF1", surface:"#FCFCFC", border:"#E2E6EA",
  text:"#151313", sub:"#64748B", muted:"#94A3B8",
  green:"#10B981", greenLt:"#D1FAE5",
  amber:"#F59E0B", amberLt:"#FEF3C7",
  red:"#EF4444", redLt:"#FEE2E2",
};

function initials(name) { return (name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }
function bandColor(b) { return !b ? AD.muted : b >= 7 ? AD.green : b >= 6 ? AD.blue : b >= 5 ? AD.amber : AD.red; }
function bandBg(b)    { return !b ? AD.bg : b >= 7 ? AD.greenLt : b >= 6 ? AD.blueLt : b >= 5 ? AD.amberLt : AD.redLt; }
const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(ds) { if (!ds) return "—"; const d = new Date(ds); return `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`; }

function Spinner() {
  return <div style={{ width:28,height:28,border:`3px solid ${AD.blueLt}`,borderTopColor:AD.blue,
    borderRadius:"50%",animation:"demo-spin .7s linear infinite",margin:"60px auto" }}/>;
}

export default function DemoPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [groups, setGroups] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!studentId) { setNotFound(true); setLoading(false); return; }
    loadAll();
  }, [studentId]);

  async function loadAll() {
    setLoading(true);
    try {
      const allStudents = await getAllStudents();
      const found = allStudents.find(s =>
        s.student_id === studentId ||
        s.student_id?.toLowerCase() === studentId.toLowerCase()
      );
      if (!found) { setNotFound(true); setLoading(false); return; }
      setStudent(found);

      const [grps, asgs, atts] = await Promise.allSettled([
        getStudentGroups(found.student_id),
        getStudentAssignments(found.student_id),
        getStudentAttempts(found.email || ""),
      ]);

      const grpList = grps.status === "fulfilled" ? grps.value : [];
      setGroups(grpList);
      setAssignments(asgs.status === "fulfilled" ? asgs.value : []);
      setAttempts(atts.status === "fulfilled" ? atts.value : []);

      if (grpList.length > 0) {
        const mats = await Promise.allSettled(grpList.map(g => getMaterials(g.id)));
        setMaterials(mats.flatMap(r => r.status === "fulfilled" ? r.value : []));
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  const latestBand = attempts.length > 0
    ? Math.max(...attempts.map(a => a.overall_band || 0).filter(Boolean)) || null
    : null;

  const pending = assignments.filter(a => a.status !== "submitted" && a.status !== "completed");
  const completed = assignments.filter(a => a.status === "submitted" || a.status === "completed");

  const skills = [
    { key:"listening", label:"Listening" },
    { key:"reading",   label:"Reading" },
    { key:"writing",   label:"Writing" },
    { key:"speaking",  label:"Speaking" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:AD.bg,
      fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <style>{`@keyframes demo-spin{to{transform:rotate(360deg)}}`}</style>

      {/* internal preview banner */}
      <div style={{ background:"#1a1a2e", padding:"8px 24px",
        display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:4,
            background:"#F59E0B", color:"#000", letterSpacing:".06em", textTransform:"uppercase" }}>
            Preview
          </span>
          <span style={{ fontSize:12, color:"rgba(255,255,255,.6)", fontWeight:500 }}>
            Internal use only · Student ID: <strong style={{ color:"#fff" }}>{studentId}</strong>
          </span>
        </div>
        <button type="button" onClick={() => navigate(-1)} style={{
          background:"none", border:"1px solid rgba(255,255,255,.2)", cursor:"pointer",
          color:"rgba(255,255,255,.6)", fontSize:11, fontWeight:600, borderRadius:6,
          padding:"3px 10px", display:"flex", alignItems:"center", gap:5,
        }}>
          <ArrowLeft size={11}/> Back
        </button>
      </div>

      {/* top bar */}
      <div style={{ background:AD.surface, borderBottom:`1px solid ${AD.border}`,
        padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between",
        height:52, position:"sticky", top:0, zIndex:10,
        boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:13, fontWeight:800, color:AD.blue, letterSpacing:"-0.01em" }}>
            LingvoConnect LMS
          </span>
          <span style={{ fontSize:11, color:AD.muted }}>/ Student view</span>
        </div>
        <button type="button" onClick={() => navigate("/login")} style={{
          display:"flex", alignItems:"center", gap:6, padding:"6px 14px",
          borderRadius:8, border:`1.5px solid ${AD.blue}`, background:AD.blueLt,
          color:AD.blue, fontSize:12, fontWeight:700, cursor:"pointer",
        }}>
          <LogIn size={12}/> Sign in
        </button>
      </div>

      <main style={{ maxWidth:860, margin:"0 auto", padding:"32px 20px 60px" }}>

        {loading ? <Spinner/> : notFound ? (
          <div style={{ textAlign:"center", padding:"80px 24px" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
            <h2 style={{ fontSize:20, fontWeight:800, color:AD.text, letterSpacing:"-0.03em", margin:"0 0 8px" }}>
              Student not found
            </h2>
            <p style={{ fontSize:14, color:AD.muted, margin:"0 0 24px" }}>
              The ID <strong>{studentId}</strong> doesn't match any student.
            </p>
            <button type="button" onClick={() => navigate("/")} style={{
              padding:"10px 22px", borderRadius:10, border:"none", cursor:"pointer",
              background:AD.blue, color:"#fff", fontSize:14, fontWeight:700,
            }}>Go home</button>
          </div>
        ) : (
          <>
            {/* profile header */}
            <div style={{ background:AD.surface, borderRadius:18, border:`1px solid ${AD.border}`,
              padding:"24px 28px", marginBottom:20,
              boxShadow:"0 2px 12px rgba(0,0,0,.05)",
              display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
              <div style={{ width:56, height:56, borderRadius:16, flexShrink:0,
                background:`linear-gradient(135deg,${AD.blue},${AD.blueDk})`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:20, fontWeight:900, color:"#fff", letterSpacing:"-0.02em" }}>
                {initials(student?.full_name)}
              </div>
              <div style={{ flex:1, minWidth:180 }}>
                <h1 style={{ fontSize:20, fontWeight:900, color:AD.text,
                  letterSpacing:"-0.04em", margin:0 }}>{student?.full_name}</h1>
                <div style={{ fontSize:13, color:AD.sub, marginTop:3, fontWeight:500 }}>
                  {student?.student_id} {student?.email ? `· ${student.email}` : ""}
                </div>
                {groups.length > 0 && (
                  <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                    {groups.map(g => (
                      <span key={g.id} style={{ fontSize:11, fontWeight:700, padding:"3px 10px",
                        borderRadius:6, background:AD.blueLt, color:AD.blue }}>{g.name}</span>
                    ))}
                  </div>
                )}
              </div>
              {latestBand && (
                <div style={{ textAlign:"center", flexShrink:0 }}>
                  <div style={{ fontSize:36, fontWeight:900, color:bandColor(latestBand),
                    background:bandBg(latestBand), borderRadius:14, padding:"8px 20px",
                    letterSpacing:"-0.04em", lineHeight:1 }}>{latestBand}</div>
                  <div style={{ fontSize:10, color:AD.muted, marginTop:5, fontWeight:700,
                    textTransform:"uppercase", letterSpacing:".06em" }}>Latest Band</div>
                </div>
              )}
            </div>

            {/* stats row */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",
              gap:12, marginBottom:20 }}>
              {[
                { label:"Tests completed", value:completed.length, Icon:ClipboardList, color:AD.green, bg:AD.greenLt },
                { label:"Tests pending",   value:pending.length,   Icon:BookOpen,      color:AD.amber, bg:AD.amberLt },
                { label:"Groups enrolled", value:groups.length,    Icon:CalendarDays,  color:AD.blue,  bg:AD.blueLt },
                { label:"Materials",       value:materials.length, Icon:TrendingUp,    color:AD.sub,   bg:AD.bg },
              ].map(({ label, value, Icon, color, bg }) => (
                <div key={label} style={{ background:AD.surface, borderRadius:14,
                  border:`1px solid ${AD.border}`, padding:"18px 20px",
                  boxShadow:"0 1px 6px rgba(0,0,0,.04)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                    <div style={{ width:32, height:32, borderRadius:9, background:bg,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <Icon size={15} color={color}/>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:AD.muted,
                      textTransform:"uppercase", letterSpacing:".06em" }}>{label}</span>
                  </div>
                  <div style={{ fontSize:28, fontWeight:900, color:AD.text,
                    letterSpacing:"-0.04em" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* recent attempts */}
            {attempts.length > 0 && (
              <div style={{ background:AD.surface, borderRadius:16, border:`1px solid ${AD.border}`,
                padding:"20px 24px", marginBottom:20, boxShadow:"0 1px 6px rgba(0,0,0,.04)" }}>
                <h2 style={{ fontSize:15, fontWeight:800, color:AD.text,
                  letterSpacing:"-0.03em", margin:"0 0 16px" }}>Test Results</h2>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {attempts.slice(0,5).map((a, i) => {
                    const band = a.overall_band;
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                        padding:"12px 14px", background:AD.bg, borderRadius:10,
                        border:`1px solid ${AD.border}` }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:AD.text,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {a.suite_name || "IELTS Practice Test"}
                          </div>
                          <div style={{ fontSize:11, color:AD.muted, marginTop:2 }}>
                            {fmtDate(a.submitted_at || a.created_at)}
                          </div>
                        </div>
                        {band ? (
                          <span style={{ fontSize:15, fontWeight:900, color:bandColor(band),
                            background:bandBg(band), borderRadius:7, padding:"3px 12px",
                            flexShrink:0 }}>{band}</span>
                        ) : (
                          <span style={{ fontSize:11, color:AD.muted, flexShrink:0 }}>—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* assignments preview */}
            {pending.length > 0 && (
              <div style={{ background:AD.surface, borderRadius:16, border:`1px solid ${AD.border}`,
                padding:"20px 24px", marginBottom:20, boxShadow:"0 1px 6px rgba(0,0,0,.04)" }}>
                <h2 style={{ fontSize:15, fontWeight:800, color:AD.text,
                  letterSpacing:"-0.03em", margin:"0 0 16px" }}>Pending Assignments</h2>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {pending.slice(0,4).map((a, i) => {
                    const overdue = a.deadline && new Date(a.deadline) < new Date();
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
                        padding:"12px 14px", background:AD.bg, borderRadius:10,
                        border:`1.5px solid ${overdue ? AD.red+"44" : AD.border}` }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:AD.text }}>
                            {a.suite_name || "Test"}
                          </div>
                          {a.deadline && (
                            <div style={{ fontSize:11, marginTop:2,
                              color: overdue ? AD.red : AD.muted, fontWeight: overdue ? 700 : 400 }}>
                              {overdue ? "Overdue · " : "Due "}{fmtDate(a.deadline)}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px",
                          borderRadius:6, background: overdue ? AD.redLt : AD.amberLt,
                          color: overdue ? AD.red : AD.amber, flexShrink:0 }}>
                          {overdue ? "Overdue" : "Pending"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* admin note */}
            <div style={{ background:AD.surface, borderRadius:14, border:`1.5px dashed ${AD.border}`,
              padding:"20px 24px", display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:AD.amberLt, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:16 }}>🔒</span>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:800, color:AD.text, marginBottom:2 }}>
                  Internal preview
                </div>
                <div style={{ fontSize:12, color:AD.sub }}>
                  This page is for admin/teacher review only. Share the link{" "}
                  <code style={{ fontSize:11, background:AD.bg, padding:"1px 6px",
                    borderRadius:4, color:AD.blue }}>
                    /preview/{studentId}
                  </code>{" "}
                  to preview this student's data.
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
