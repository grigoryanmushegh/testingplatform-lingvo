import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, ClipboardList, BookOpen,
  LogOut, ChevronRight, Clock, CheckCircle2, Circle,
  TrendingUp, AlertCircle, FileText, Download, Play,
  BarChart2, User, KeyRound, ShieldCheck, Eye, EyeOff,
} from "lucide-react";
import { getStudentSession, clearStudentSession, isStudentLoggedIn, hashStudentPassword } from "../../lib/studentAuth.js";
import { getStudentAssignments, getStudentAttempts, updateStudentAccount } from "../../lib/studentDb.js";
import { getStudentGroups, getSessions, getMaterials, getTasks } from "../../lib/lmsDb.js";
import { loadDB, reloadDB, genId, _invalidateTestItemCache } from "../../lib/db.js";
import { buildSuiteData, buildModuleData, enterFullscreen } from "../../lib/testEngine.js";

const AD = {
  blue:"#2D5DDC", blueLt:"#EBF0FF", blueDk:"#1a3fa8",
  bg:"#EEEFF1", surface:"#FCFCFC", border:"#E2E6EA",
  text:"#151313", sub:"#64748B", muted:"#94A3B8",
  green:"#10B981", greenLt:"#D1FAE5",
  amber:"#F59E0B", amberLt:"#FEF3C7",
  red:"#EF4444", redLt:"#FEE2E2",
};

const TABS = [
  { id:"overview",     label:"Overview",    Icon: LayoutDashboard },
  { id:"schedule",     label:"Schedule",    Icon: CalendarDays },
  { id:"assignments",  label:"Assignments", Icon: ClipboardList },
  { id:"materials",    label:"Materials",   Icon: BookOpen },
  { id:"profile",      label:"Profile",     Icon: User },
];

const DAY   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(ds) {
  const d = new Date(ds);
  return `${DAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`;
}
function bandColor(b) { return b >= 7 ? AD.green : b >= 6 ? AD.blue : b >= 5 ? AD.amber : AD.red; }
function bandBg(b)    { return b >= 7 ? AD.greenLt : b >= 6 ? AD.blueLt : b >= 5 ? AD.amberLt : AD.redLt; }

function Spinner() {
  return <div style={{ width:24,height:24,border:`2.5px solid ${AD.blueLt}`,borderTopColor:AD.blue,
    borderRadius:"50%",animation:"lms-spin .7s linear infinite",margin:"48px auto" }}/>;
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div style={{ textAlign:"center",padding:"48px 24px",color:AD.muted }}>
      <Icon size={32} style={{ opacity:.35,marginBottom:12 }}/>
      <div style={{ fontSize:13,fontWeight:500 }}>{text}</div>
    </div>
  );
}

// ── Sidebar nav ───────────────────────────────────────────────────────────────
function Sidebar({ tab, setTab, student, onLogout }) {
  const initials = (student?.full_name || student?.username || "?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return (
    <aside style={{ width:220, flexShrink:0, background:AD.surface, borderRight:`1px solid ${AD.border}`,
      display:"flex", flexDirection:"column", height:"100vh", position:"sticky", top:0 }}>
      {/* logo */}
      <div style={{ padding:"20px 20px 16px", borderBottom:`1px solid ${AD.border}` }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:32,height:32,borderRadius:9,
            background:`linear-gradient(135deg,${AD.blue},${AD.blueDk})`,
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <span style={{ color:"#fff",fontWeight:900,fontSize:16 }}>L</span>
          </div>
          <div>
            <div style={{ fontSize:13,fontWeight:800,color:AD.text,letterSpacing:"-0.02em",lineHeight:1 }}>LingvoConnect</div>
            <div style={{ fontSize:10,color:AD.muted,fontWeight:500 }}>Student Portal</div>
          </div>
        </div>
      </div>

      {/* nav */}
      <nav style={{ flex:1,padding:"12px 10px",overflowY:"auto" }}>
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button key={id} type="button" onClick={() => setTab(id)} style={{
              display:"flex",alignItems:"center",gap:10,width:"100%",
              padding:"9px 12px",borderRadius:10,border:"none",cursor:"pointer",
              marginBottom:2, textAlign:"left",
              background: active ? AD.blueLt : "transparent",
              color: active ? AD.blue : AD.sub,
              fontWeight: active ? 700 : 500,
              fontSize:13,
              transition:"background .15s,color .15s",
            }}>
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8}/>
              {label}
            </button>
          );
        })}
      </nav>

      {/* profile footer */}
      <div style={{ padding:"12px 10px",borderTop:`1px solid ${AD.border}` }}>
        <div role="button" tabIndex={0} onClick={() => setTab("profile")}
          onKeyDown={e => e.key==="Enter" && setTab("profile")}
          style={{
            display:"flex",alignItems:"center",gap:10,padding:"8px 12px",
            borderRadius:10,background: tab==="profile" ? AD.blueLt : AD.bg,
            cursor:"pointer",transition:"background .15s",
          }}>
          <div style={{ width:30,height:30,borderRadius:8,
            background: tab==="profile" ? AD.blue : AD.blueLt,flexShrink:0,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:11,fontWeight:800,color: tab==="profile" ? "#fff" : AD.blue }}>{initials}</div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:12,fontWeight:700,
              color: tab==="profile" ? AD.blue : AD.text,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
              {student?.full_name || student?.username}
            </div>
            <div style={{ fontSize:10,color:AD.muted }}>Profile & Settings</div>
          </div>
          <button type="button" onClick={e => { e.stopPropagation(); onLogout(); }} title="Sign out" style={{
            background:"none",border:"none",cursor:"pointer",color:AD.muted,
            display:"flex",padding:2,flexShrink:0,
          }}>
            <LogOut size={14}/>
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab({ student, assignments, groups, attempts }) {
  const isAssignmentDone = a => a.status === "completed" || a.status === "submitted";
  const completedTests = (assignments || []).filter(isAssignmentDone);
  const pendingTasks = (assignments || []).filter(a => !isAssignmentDone(a));

  // Compute band averages from attempts (participants with status:"complete")
  const scores = attempts?.slice(0, 5) || [];
  const latestScore = scores[0];
  const overall = latestScore?.overall;

  // Next upcoming session
  const allSessions = [];
  const now = new Date();
  (groups || []).forEach(g => {
    (g.schedule || []).forEach(slot => {
      for (let d = 0; d <= 7; d++) {
        const date = new Date(now); date.setHours(0,0,0,0); date.setDate(date.getDate() + d);
        if (date.getDay() === slot.day) {
          allSessions.push({ groupName: g.name, date: date.toISOString().split("T")[0],
            start: slot.start, end: slot.end, diff: d });
        }
      }
    });
  });
  allSessions.sort((a,b) => new Date(a.date) - new Date(b.date));
  const nextClass = allSessions[0];

  const skills = [
    { label:"Listening", key:"listening" },
    { label:"Reading",   key:"reading" },
    { label:"Writing",   key:"writing" },
    { label:"Speaking",  key:"speaking" },
  ];

  return (
    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
      {/* Band score card */}
      <div style={{ gridColumn:"1/-1",background:AD.surface,borderRadius:16,
        border:`1px solid ${AD.border}`,padding:"24px",
        boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20 }}>
          <div>
            <div style={{ fontSize:11,fontWeight:700,color:AD.muted,
              letterSpacing:".06em",textTransform:"uppercase",marginBottom:6 }}>Current Band Score</div>
            {overall ? (
              <div style={{ display:"flex",alignItems:"baseline",gap:8 }}>
                <span style={{ fontSize:48,fontWeight:900,color:bandColor(overall),
                  letterSpacing:"-0.06em",lineHeight:1 }}>{overall.toFixed(1)}</span>
                <span style={{ fontSize:14,color:AD.muted }}>overall</span>
              </div>
            ) : (
              <div style={{ fontSize:22,fontWeight:700,color:AD.muted }}>No tests yet</div>
            )}
          </div>
          {overall && (
            <div style={{ padding:"6px 14px",borderRadius:8,background:bandBg(overall),
              fontSize:12,fontWeight:700,color:bandColor(overall) }}>
              {overall >= 7 ? "Advanced" : overall >= 6 ? "Upper-Intermediate" : overall >= 5 ? "Intermediate" : "Developing"}
            </div>
          )}
        </div>
        {/* skill bars */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
          {skills.map(({ label, key }) => {
            const sc = latestScore?.[`${key}Band`];
            const pct = sc ? (sc / 9) * 100 : 0;
            return (
              <div key={key}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5 }}>
                  <span style={{ fontSize:11,color:AD.sub,fontWeight:600 }}>{label}</span>
                  <span style={{ fontSize:11,fontWeight:800,color:AD.text }}>{sc ? sc.toFixed(1) : "—"}</span>
                </div>
                <div style={{ height:5,borderRadius:3,background:AD.bg,overflow:"hidden" }}>
                  <div style={{ height:"100%",borderRadius:3,width:`${pct}%`,
                    background:`linear-gradient(90deg,${AD.blue},#6ea0f7)`,
                    transition:"width .6s cubic-bezier(0.34,1.56,0.64,1)" }}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next class */}
      <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,
        padding:"20px",boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize:11,fontWeight:700,color:AD.muted,
          letterSpacing:".06em",textTransform:"uppercase",marginBottom:14 }}>Next Class</div>
        {nextClass ? (
          <div>
            <div style={{ fontSize:16,fontWeight:800,color:AD.text,
              letterSpacing:"-0.03em",marginBottom:4 }}>{nextClass.groupName}</div>
            <div style={{ display:"flex",alignItems:"center",gap:6,color:AD.sub,fontSize:13,marginBottom:4 }}>
              <CalendarDays size={13}/>
              {nextClass.diff === 0 ? "Today" : nextClass.diff === 1 ? "Tomorrow" : fmtDate(nextClass.date)}
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:6,color:AD.sub,fontSize:13 }}>
              <Clock size={13}/>{nextClass.start} — {nextClass.end}
            </div>
          </div>
        ) : (
          <div style={{ color:AD.muted,fontSize:13 }}>No upcoming classes scheduled.</div>
        )}
      </div>

      {/* Stats */}
      <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,
        padding:"20px",boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize:11,fontWeight:700,color:AD.muted,
          letterSpacing:".06em",textTransform:"uppercase",marginBottom:14 }}>My Stats</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          {[
            { label:"Tests taken", value: completedTests.length },
            { label:"Pending tasks", value: pendingTasks.length },
            { label:"Groups enrolled", value: (groups||[]).length },
            { label:"Tests completed", value: completedTests.length },
          ].map(({ label, value }) => (
            <div key={label} style={{ background:AD.bg,borderRadius:10,padding:"12px 14px" }}>
              <div style={{ fontSize:22,fontWeight:900,color:AD.text,letterSpacing:"-0.05em",lineHeight:1 }}>{value}</div>
              <div style={{ fontSize:11,color:AD.muted,marginTop:3 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent results */}
      <div style={{ gridColumn:"1/-1",background:AD.surface,borderRadius:16,
        border:`1px solid ${AD.border}`,padding:"20px",boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize:11,fontWeight:700,color:AD.muted,
          letterSpacing:".06em",textTransform:"uppercase",marginBottom:14 }}>Recent Test Results</div>
        {scores.length === 0 ? (
          <EmptyState icon={BarChart2} text="No test results yet. Complete an assigned test to see your scores here."/>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {scores.map((s, i) => (
              <div key={i} style={{ display:"flex",alignItems:"center",gap:12,
                padding:"12px 14px",background:AD.bg,borderRadius:10 }}>
                <div style={{ width:36,height:36,borderRadius:9,flexShrink:0,
                  background:bandBg(s.band_overall||0),
                  display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <span style={{ fontSize:13,fontWeight:900,color:bandColor(s.band_overall||0) }}>
                    {s.band_overall?.toFixed(1)||"—"}
                  </span>
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:AD.text,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                    {s.test_name || "IELTS Mock Test"}
                  </div>
                  <div style={{ fontSize:11,color:AD.muted }}>
                    {s.submitted_at ? fmtDate(s.submitted_at) : "—"}
                  </div>
                </div>
                <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                  {["L","R","W","S"].map((k,j) => {
                    const v = [s.band_listening,s.band_reading,s.band_writing,s.band_speaking][j];
                    return <span key={k} style={{ fontSize:11,color:AD.sub }}>{k}: <b style={{ color:AD.text }}>{v?.toFixed(1)||"—"}</b></span>;
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── SCHEDULE TAB ──────────────────────────────────────────────────────────────
function ScheduleTab({ groups }) {
  const sessions = [];
  const now = new Date(); now.setHours(0,0,0,0);
  (groups || []).forEach(g => {
    (g.schedule || []).forEach(slot => {
      for (let d = 0; d <= 13; d++) {
        const date = new Date(now); date.setDate(date.getDate() + d);
        if (date.getDay() === slot.day) {
          sessions.push({ groupName:g.name, level:g.level, date:date.toISOString().split("T")[0],
            start:slot.start, end:slot.end, diff:d });
        }
      }
    });
  });
  sessions.sort((a,b) => new Date(a.date) - new Date(b.date));

  if (sessions.length === 0) {
    return (
      <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
        <EmptyState icon={CalendarDays} text="No classes scheduled yet. Your teacher will add sessions."/>
      </div>
    );
  }

  let lastDate = null;
  return (
    <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
      <h2 style={{ fontSize:16,fontWeight:800,color:AD.text,letterSpacing:"-0.03em",margin:"0 0 20px" }}>
        Upcoming Classes — next 2 weeks
      </h2>
      <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
        {sessions.map((s, i) => {
          const showDate = s.date !== lastDate;
          lastDate = s.date;
          return (
            <div key={i}>
              {showDate && (
                <div style={{ fontSize:11,fontWeight:700,color:AD.muted,
                  letterSpacing:".06em",textTransform:"uppercase",
                  padding:"12px 0 6px",marginTop: i > 0 ? 8 : 0 }}>
                  {s.diff === 0 ? "Today" : s.diff === 1 ? "Tomorrow" : fmtDate(s.date)}
                </div>
              )}
              <div style={{ display:"flex",alignItems:"center",gap:12,
                padding:"13px 16px",background:AD.bg,borderRadius:11,
                border:`1px solid ${AD.border}` }}>
                <div style={{ width:4,height:36,borderRadius:2,
                  background:s.diff === 0 ? AD.blue : AD.border,flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14,fontWeight:700,color:AD.text,letterSpacing:"-0.02em" }}>{s.groupName}</div>
                  {s.level && <div style={{ fontSize:11,color:AD.muted,marginTop:1 }}>{s.level}</div>}
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:5,color:AD.sub,fontSize:13,flexShrink:0 }}>
                  <Clock size={13}/>{s.start} — {s.end}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ASSIGNMENTS TAB ───────────────────────────────────────────────────────────
function AssignmentsTab({ assignments, onStartTest }) {
  const isDone = a => a.status === "completed" || a.status === "submitted";
  const pending   = (assignments||[]).filter(a => !isDone(a));
  const completed = (assignments||[]).filter(isDone);

  function AssignmentRow({ a, done }) {
    const overdue = !done && a.deadline && new Date(a.deadline) < new Date();
    const hasProgress = !done && a.auto_save?.savedAt;
    const assignedOn = a.assigned_at ? new Date(a.assigned_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : null;
    return (
      <div style={{ display:"flex",alignItems:"center",gap:12,
        padding:"14px 16px",background:AD.bg,borderRadius:11,
        border:`1px solid ${overdue ? AD.red+"33" : AD.border}` }}>
        <div style={{ width:32,height:32,borderRadius:9,flexShrink:0,
          background: done ? AD.greenLt : overdue ? AD.redLt : AD.blueLt,
          display:"flex",alignItems:"center",justifyContent:"center" }}>
          {done
            ? <CheckCircle2 size={15} color={AD.green}/>
            : <ClipboardList size={15} color={overdue ? AD.red : AD.blue}/>}
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:13,fontWeight:700,color:AD.text,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
            {a.test_suite_name || a.suite_name || a.suiteName || "IELTS Test"}
          </div>
          <div style={{ fontSize:11,color:overdue ? AD.red : AD.muted,marginTop:2 }}>
            {assignedOn && <span>Assigned {assignedOn}{a.deadline ? " · " : ""}</span>}
            {a.is_week_test ? "Weekly test · " : ""}
            {a.deadline ? (overdue ? `Overdue — due ${fmtDate(a.deadline)}` : `Due ${fmtDate(a.deadline)}`) : (!assignedOn ? "No deadline" : "")}
          </div>
          {hasProgress && (
            <div style={{ fontSize:10,color:AD.blue,marginTop:3,fontWeight:600 }}>
              ● In progress — answers auto-saved
            </div>
          )}
        </div>
        {done
          ? <span style={{ fontSize:11,fontWeight:700,color:AD.green,flexShrink:0 }}>Completed</span>
          : <button type="button" onClick={() => onStartTest(a)} style={{
              padding:"7px 16px",borderRadius:8,border:"none",cursor:"pointer",flexShrink:0,
              background: hasProgress ? "#059669" : AD.blue,color:"#fff",fontSize:12,fontWeight:700,
              display:"flex",alignItems:"center",gap:5,
            }}>
              {hasProgress ? <><Play size={11}/>Resume</> : <><Play size={11}/>Start</>}
            </button>
        }
      </div>
    );
  }

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
      <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
        <h2 style={{ fontSize:15,fontWeight:800,color:AD.text,margin:"0 0 14px",letterSpacing:"-0.03em" }}>
          Pending ({pending.length})
        </h2>
        {pending.length === 0
          ? <EmptyState icon={CheckCircle2} text="All caught up — no pending assignments."/>
          : <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {pending.map(a => <AssignmentRow key={a.id} a={a}/>)}
            </div>
        }
      </div>

      {completed.length > 0 && (
        <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
          <h2 style={{ fontSize:15,fontWeight:800,color:AD.text,margin:"0 0 14px",letterSpacing:"-0.03em" }}>
            Completed ({completed.length})
          </h2>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {completed.map(a => <AssignmentRow key={a.id} a={a} done/>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MATERIALS TAB ─────────────────────────────────────────────────────────────
function MaterialsTab({ materials, tasks }) {
  const EXT_ICONS = { pdf:"PDF", doc:"DOC", docx:"DOC", mp3:"MP3", mp4:"MP4", jpg:"IMG", png:"IMG" };
  function extTag(url) {
    const ext = (url||"").split(".").pop().toLowerCase();
    return EXT_ICONS[ext] || "FILE";
  }

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
      {/* Tasks from teacher */}
      <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
        <h2 style={{ fontSize:15,fontWeight:800,color:AD.text,margin:"0 0 14px",letterSpacing:"-0.03em" }}>
          Tasks from Teacher
        </h2>
        {(tasks||[]).length === 0
          ? <EmptyState icon={FileText} text="No tasks assigned yet."/>
          : <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {tasks.map(t => (
                <div key={t.id} style={{ display:"flex",alignItems:"flex-start",gap:12,
                  padding:"14px 16px",background:AD.bg,borderRadius:11,border:`1px solid ${AD.border}` }}>
                  <div style={{ width:32,height:32,borderRadius:9,flexShrink:0,background:AD.blueLt,
                    display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <FileText size={14} color={AD.blue}/>
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:700,color:AD.text }}>{t.title}</div>
                    {t.description && <div style={{ fontSize:12,color:AD.sub,marginTop:3,lineHeight:1.5 }}>{t.description}</div>}
                    {t.due_date && <div style={{ fontSize:11,color:AD.muted,marginTop:4 }}>Due: {fmtDate(t.due_date)}</div>}
                  </div>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Study materials */}
      <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
        <h2 style={{ fontSize:15,fontWeight:800,color:AD.text,margin:"0 0 14px",letterSpacing:"-0.03em" }}>
          Study Materials
        </h2>
        {(materials||[]).length === 0
          ? <EmptyState icon={BookOpen} text="No materials uploaded yet."/>
          : <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {materials.map(m => (
                <div key={m.id} style={{ display:"flex",alignItems:"center",gap:12,
                  padding:"13px 16px",background:AD.bg,borderRadius:11,border:`1px solid ${AD.border}` }}>
                  <div style={{ width:32,height:32,borderRadius:9,flexShrink:0,background:AD.blueLt,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:9,fontWeight:800,color:AD.blue }}>
                    {extTag(m.file_url)}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:700,color:AD.text,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{m.title}</div>
                    {m.description && <div style={{ fontSize:11,color:AD.muted,marginTop:1 }}>{m.description}</div>}
                  </div>
                  {m.file_url && (
                    <a href={m.file_url} target="_blank" rel="noreferrer" style={{
                      display:"flex",alignItems:"center",gap:5,padding:"6px 12px",
                      borderRadius:8,border:`1px solid ${AD.border}`,background:AD.surface,
                      color:AD.sub,fontSize:12,fontWeight:600,textDecoration:"none",flexShrink:0,
                    }}>
                      <Download size={12}/>Open
                    </a>
                  )}
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

// ── PROFILE TAB ───────────────────────────────────────────────────────────────
function ProfileTab({ student, attempts, groups }) {
  const ini = (student?.full_name || "?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const bestBand = attempts.length ? Math.max(...attempts.map(a => a.overall||0).filter(Boolean)) || null : null;

  // password change state
  const [curPw,   setCurPw]   = useState("");
  const [newPw,   setNewPw]   = useState("");
  const [confPw,  setConfPw]  = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving,setPwSaving]= useState(false);
  const [pwMsg,   setPwMsg]   = useState(null); // { type:"ok"|"err", text }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (!curPw || !newPw || !confPw) { setPwMsg({ type:"err", text:"Fill in all fields." }); return; }
    if (newPw.length < 6)            { setPwMsg({ type:"err", text:"New password must be at least 6 characters." }); return; }
    if (newPw !== confPw)            { setPwMsg({ type:"err", text:"New passwords don't match." }); return; }
    setPwSaving(true);
    try {
      // verify current password by comparing hash
      const curHash = await hashStudentPassword(curPw);
      if (curHash !== student.password_hash) {
        setPwMsg({ type:"err", text:"Current password is incorrect." }); return;
      }
      const newHash = await hashStudentPassword(newPw);
      const res = await updateStudentAccount(student.student_id, { password_hash: newHash, force_pw_change: false });
      if (res.ok) {
        setPwMsg({ type:"ok", text:"Password updated successfully." });
        setCurPw(""); setNewPw(""); setConfPw("");
      } else {
        setPwMsg({ type:"err", text: res.error || "Update failed." });
      }
    } catch(err) {
      setPwMsg({ type:"err", text: err?.message || "Something went wrong." });
    } finally { setPwSaving(false); }
  }

  const inputStyle = {
    width:"100%", boxSizing:"border-box", padding:"10px 14px", borderRadius:10,
    border:`1.5px solid ${AD.border}`, fontSize:13, color:AD.text,
    background:AD.surface, fontFamily:"inherit", outline:"none",
    transition:"border-color .15s",
  };
  const labelStyle = {
    display:"block", fontSize:11, fontWeight:700, color:AD.sub,
    textTransform:"uppercase", letterSpacing:".06em", marginBottom:6,
  };

  const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function fmtFull(ds) { if (!ds) return "—"; const d = new Date(ds); return `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`; }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:680 }}>

      {/* ── Avatar + identity card ── */}
      <div style={{ background:AD.surface, borderRadius:18, border:`1px solid ${AD.border}`,
        padding:"28px 28px", display:"flex", alignItems:"center", gap:22, flexWrap:"wrap",
        boxShadow:"0 2px 12px rgba(0,0,0,.05)" }}>
        <div style={{ width:72, height:72, borderRadius:20, flexShrink:0,
          background:`linear-gradient(135deg,${AD.blue},${AD.blueDk})`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:26, fontWeight:900, color:"#fff", letterSpacing:"-0.02em",
          boxShadow:`0 6px 20px ${AD.blue}44` }}>
          {ini}
        </div>
        <div style={{ flex:1, minWidth:160 }}>
          <div style={{ fontSize:20, fontWeight:900, color:AD.text, letterSpacing:"-0.04em" }}>
            {student?.full_name}
          </div>
          <div style={{ fontSize:13, color:AD.sub, marginTop:4, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontWeight:600 }}>{student?.student_id}</span>
            {student?.email && <><span style={{ color:AD.border }}>·</span><span>{student.email}</span></>}
          </div>
          <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:6,
              background: student?.status === "active" ? AD.greenLt : AD.amberLt,
              color: student?.status === "active" ? AD.green : AD.amber }}>
              {student?.status || "active"}
            </span>
            {groups.map(g => (
              <span key={g.id} style={{ fontSize:11, fontWeight:700, padding:"3px 10px",
                borderRadius:6, background:AD.blueLt, color:AD.blue }}>{g.name}</span>
            ))}
          </div>
        </div>
        {bestBand && (
          <div style={{ textAlign:"center", flexShrink:0 }}>
            <div style={{ fontSize:40, fontWeight:900, letterSpacing:"-0.05em",
              color: bestBand >= 7 ? AD.green : bestBand >= 6 ? AD.blue : bestBand >= 5 ? AD.amber : AD.red,
              background: bestBand >= 7 ? AD.greenLt : bestBand >= 6 ? AD.blueLt : bestBand >= 5 ? AD.amberLt : AD.redLt,
              borderRadius:16, padding:"8px 20px", lineHeight:1 }}>{bestBand}</div>
            <div style={{ fontSize:10, color:AD.muted, marginTop:6, fontWeight:700,
              textTransform:"uppercase", letterSpacing:".06em" }}>Best Band</div>
          </div>
        )}
      </div>

      {/* ── Account info ── */}
      <div style={{ background:AD.surface, borderRadius:16, border:`1px solid ${AD.border}`,
        padding:"24px 28px", boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:AD.blueLt,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <User size={15} color={AD.blue}/>
          </div>
          <h2 style={{ fontSize:15, fontWeight:800, color:AD.text, margin:0, letterSpacing:"-0.03em" }}>
            Account info
          </h2>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16 }}>
          {[
            { label:"Full name",   value: student?.full_name },
            { label:"Student ID",  value: student?.student_id },
            { label:"Email",       value: student?.email || "—" },
            { label:"Phone",       value: student?.phone || "—" },
            { label:"Joined",      value: fmtFull(student?.created_at) },
            { label:"Tests taken", value: attempts.length || 0 },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={labelStyle}>{label}</div>
              <div style={{ fontSize:14, fontWeight:600, color:AD.text,
                padding:"9px 12px", background:AD.bg, borderRadius:9,
                border:`1px solid ${AD.border}` }}>{value}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize:11, color:AD.muted, margin:"16px 0 0" }}>
          To update your name, email or phone, contact your teacher or admin.
        </p>
      </div>

      {/* ── Change password ── */}
      <div style={{ background:AD.surface, borderRadius:16, border:`1px solid ${AD.border}`,
        padding:"24px 28px", boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:AD.blueLt,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <KeyRound size={15} color={AD.blue}/>
          </div>
          <h2 style={{ fontSize:15, fontWeight:800, color:AD.text, margin:0, letterSpacing:"-0.03em" }}>
            Change password
          </h2>
        </div>

        {pwMsg && (
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
            borderRadius:10, marginBottom:16,
            background: pwMsg.type === "ok" ? AD.greenLt : AD.redLt,
            border:`1px solid ${pwMsg.type === "ok" ? AD.green+"33" : AD.red+"33"}` }}>
            <ShieldCheck size={14} color={pwMsg.type === "ok" ? AD.green : AD.red}/>
            <span style={{ fontSize:13, fontWeight:600,
              color: pwMsg.type === "ok" ? AD.green : AD.red }}>{pwMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={labelStyle}>Current password</label>
            <div style={{ position:"relative" }}>
              <input type={showCur ? "text" : "password"} value={curPw} onChange={e=>setCurPw(e.target.value)}
                style={{ ...inputStyle, paddingRight:40 }}
                onFocus={e=>e.target.style.borderColor=AD.blue}
                onBlur={e=>e.target.style.borderColor=AD.border}/>
              <button type="button" onClick={()=>setShowCur(v=>!v)} style={{
                position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                background:"none",border:"none",cursor:"pointer",color:AD.muted,display:"flex",padding:2,
              }}>{showCur ? <EyeOff size={15}/> : <Eye size={15}/>}</button>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div>
              <label style={labelStyle}>New password</label>
              <div style={{ position:"relative" }}>
                <input type={showNew ? "text" : "password"} value={newPw} onChange={e=>setNewPw(e.target.value)}
                  placeholder="Min 6 characters"
                  style={{ ...inputStyle, paddingRight:40 }}
                  onFocus={e=>e.target.style.borderColor=AD.blue}
                  onBlur={e=>e.target.style.borderColor=AD.border}/>
                <button type="button" onClick={()=>setShowNew(v=>!v)} style={{
                  position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                  background:"none",border:"none",cursor:"pointer",color:AD.muted,display:"flex",padding:2,
                }}>{showNew ? <EyeOff size={15}/> : <Eye size={15}/>}</button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Confirm new password</label>
              <input type="password" value={confPw} onChange={e=>setConfPw(e.target.value)}
                style={{ ...inputStyle, borderColor: confPw && confPw !== newPw ? AD.red : AD.border }}
                onFocus={e=>e.target.style.borderColor=AD.blue}
                onBlur={e=>e.target.style.borderColor = confPw && confPw !== newPw ? AD.red : AD.border}/>
            </div>
          </div>
          {/* strength bar */}
          {newPw.length > 0 && (
            <div>
              <div style={{ display:"flex", gap:4, marginBottom:4 }}>
                {[6,8,10,12].map((n,i) => (
                  <div key={i} style={{ flex:1, height:3, borderRadius:2,
                    background: newPw.length >= n
                      ? [AD.red, AD.amber, AD.blue, AD.green][i]
                      : AD.border }} />
                ))}
              </div>
              <div style={{ fontSize:11, color:AD.muted }}>
                {newPw.length < 6 ? "Too short" : newPw.length < 8 ? "Weak" : newPw.length < 10 ? "Fair" : newPw.length < 12 ? "Strong" : "Very strong"}
              </div>
            </div>
          )}
          <div>
            <button type="submit" disabled={pwSaving} style={{
              padding:"10px 24px", borderRadius:10, border:"none", cursor:"pointer",
              background: pwSaving ? AD.muted : AD.blue, color:"#fff",
              fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:8,
              transition:"background .15s",
            }}>
              {pwSaving
                ? <><div style={{ width:14,height:14,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",
                    borderRadius:"50%",animation:"lms-spin .7s linear infinite" }}/> Updating…</>
                : <><KeyRound size={14}/>Update password</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [tasks, setTasks] = useState([]);

  const student = getStudentSession();

  useEffect(() => {
    if (!isStudentLoggedIn()) { navigate("/login", { replace:true }); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [asgn, grps, atts] = await Promise.allSettled([
        getStudentAssignments(student.student_id),
        getStudentGroups(student.student_id),
        getStudentAttempts(student.email),
      ]);
      let resolvedGroups = grps.status === "fulfilled" ? grps.value : [];
      let resolvedAssignments = asgn.status === "fulfilled" ? asgn.value : [];
      let resolvedAttempts = atts.status === "fulfilled" ? atts.value : [];

      // Fake-data fallback: if Supabase is CORS-blocked locally, use seeded fake data
      let usedFake = false;
      if (!resolvedAssignments.length && !resolvedAttempts.length) {
        try {
          const fd = JSON.parse(localStorage.getItem("lv_fake_data") || "{}");
          const fake = fd[student.student_id];
          if (fake) {
            resolvedAssignments = fake.assignments || [];
            resolvedAttempts    = fake.attempts    || [];
            if (!resolvedGroups.length) resolvedGroups = fake.groups || [];
            setMaterials(fake.materials || []);
            setTasks(fake.tasks || []);
            usedFake = true;
          }
        } catch {}
      }

      setAssignments(resolvedAssignments);
      setGroups(resolvedGroups);
      setAttempts(resolvedAttempts);

      // load materials + tasks for all groups (skip if already set from fake data)
      if (!usedFake && resolvedGroups.length > 0) {
        const allMats = [], allTasks = [];
        await Promise.all(resolvedGroups.map(async g => {
          const gid = g.group?.id || g.id;
          const [mats, tsks] = await Promise.allSettled([getMaterials(gid), getTasks(gid)]);
          if (mats.status === "fulfilled") allMats.push(...mats.value);
          if (tsks.status === "fulfilled") allTasks.push(...tsks.value);
        }));
        setMaterials(allMats);
        setTasks(allTasks);
      }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  function handleLogout() {
    clearStudentSession();
    navigate("/");
  }

  async function handleStartTest(assignment) {
    const candidateInfo = { name: student.full_name, email: student.email, phone: student.phone || "" };
    const mc = assignment.auto_save?.moduleConfig || null;
    const effectiveAssignment = mc ? { ...assignment, ...mc } : assignment;
    const suiteId = assignment.suiteId || assignment.test_suite_id;

    const tryBuild = (db) => effectiveAssignment.singleModule
      ? buildModuleData(effectiveAssignment, db)
      : (() => {
          const suite = (db.testSuites||[]).find(s => s.id === suiteId);
          return suite ? buildSuiteData(suite, db) : null;
        })();

    const hasContent = (r) => r && (r.readingData || r.writingData || r.listeningData);

    let db = loadDB();
    let resolvedSuite = tryBuild(db);

    if (!hasContent(resolvedSuite)) {
      _invalidateTestItemCache();
      await reloadDB();
      db = loadDB();
      resolvedSuite = tryBuild(db);

      if (!hasContent(resolvedSuite) && (db.tests?.length||0) === 0) {
        await new Promise(r => setTimeout(r, 3000));
        _invalidateTestItemCache();
        await reloadDB();
        db = loadDB();
        resolvedSuite = tryBuild(db);
      }
    }

    if (!resolvedSuite) {
      alert("Test data not found. Please contact your administrator.\n\nSuite ID: " + suiteId);
      return;
    }
    if (!hasContent(resolvedSuite)) {
      alert("Test content could not be loaded. Please refresh and try again.\n\nIf the problem persists, ask your admin to click 'Sync Tests to Cloud'.");
      return;
    }

    const mod = effectiveAssignment.singleModule;
    const initialStep = mod === "reading" ? 3
      : (mod === "writing1" || mod === "writing2") ? 4
      : 2;

    sessionStorage.setItem("ielts_test_init", JSON.stringify({
      candidateInfo,
      assignmentId: assignment.id,
      resolvedSuite,
      sessionId: genId("IELTS"),
      initialStep,
    }));
    enterFullscreen();
    navigate("/test");
  }

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:AD.bg,
      fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <style>{`@keyframes lms-spin{to{transform:rotate(360deg)}}`}</style>

      <Sidebar tab={tab} setTab={setTab} student={student} onLogout={handleLogout}/>

      <main style={{ flex:1, padding:"28px 28px 40px", overflowY:"auto", minWidth:0 }}>
        {/* page header */}
        {tab === "overview" ? (
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:13,fontWeight:600,color:AD.muted,marginBottom:4,letterSpacing:".01em" }}>
              {new Date().toLocaleDateString("en-GB",{ weekday:"long", day:"numeric", month:"long" })}
            </div>
            <h1 style={{ fontSize:32,fontWeight:900,color:AD.text,letterSpacing:"-0.05em",margin:0,lineHeight:1.1 }}>
              Hey, {student?.full_name?.split(" ")[0] || "there"} 👋
            </h1>
            <p style={{ fontSize:14,color:AD.sub,margin:"6px 0 0",fontWeight:500 }}>
              Here's your IELTS progress at a glance
            </p>
          </div>
        ) : (
          <div style={{ marginBottom:24 }}>
            <h1 style={{ fontSize:22,fontWeight:900,color:AD.text,letterSpacing:"-0.04em",margin:0 }}>
              {TABS.find(t => t.id === tab)?.label}
            </h1>
          </div>
        )}

        {loading ? <Spinner/> : (
          <>
            {tab === "overview"    && <OverviewTab student={student} assignments={assignments} groups={groups} attempts={attempts}/>}
            {tab === "schedule"    && <ScheduleTab groups={groups}/>}
            {tab === "assignments" && <AssignmentsTab assignments={assignments} onStartTest={handleStartTest}/>}
            {tab === "materials"   && <MaterialsTab materials={materials} tasks={tasks}/>}
            {tab === "profile"     && <ProfileTab student={student} attempts={attempts} groups={groups}/>}
          </>
        )}
      </main>
    </div>
  );
}
