import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, CalendarDays, BookOpen, BarChart2, LogOut,
  CheckCircle2, XCircle, Clock, ChevronDown, Plus,
  FileText, Trash2, AlertCircle, TrendingUp, Circle,
  ClipboardList, User, KeyRound, ShieldCheck, Eye, EyeOff,
  LayoutDashboard, GraduationCap, ChevronLeft, ChevronRight, Calendar,
  FlaskConical, Headphones, PenLine, Mic, BookMarked, Sparkles,
} from "lucide-react";
import { getTeacherSession, clearTeacherSession, isTeacherLoggedIn, setTeacherSession } from "../../lib/teacherAuth.js";
import { hashPassword, loadDB, saveDB } from "../../lib/db.js";
import {
  getGroups, getGroupStudents, getSessions, getAttendance, markAttendance,
  getMaterials, createMaterial, deleteMaterial,
  getTasks, createTask, deleteTask,
} from "../../lib/lmsDb.js";
import { getAllStudents } from "../../lib/studentDb.js";

const AD = {
  blue:"#2D5DDC", blueLt:"#EBF0FF", blueDk:"#1a3fa8",
  bg:"#EEEFF1", surface:"#FCFCFC", border:"#E2E6EA",
  text:"#151313", sub:"#64748B", muted:"#94A3B8",
  green:"#10B981", greenLt:"#D1FAE5",
  amber:"#F59E0B", amberLt:"#FEF3C7",
  red:"#EF4444", redLt:"#FEE2E2",
  purple:"#8B5CF6", purpleLt:"#EDE9FE",
};

const TABS = [
  { id:"overview",  label:"Overview",        Icon: LayoutDashboard },
  { id:"calendar",  label:"Calendar",        Icon: Calendar },
  { id:"groups",    label:"My Groups",       Icon: Users },
  { id:"attendance",label:"Attendance",      Icon: CalendarDays },
  { id:"content",   label:"Materials & Tasks", Icon: BookOpen },
  { id:"progress",  label:"Student Progress",  Icon: BarChart2 },
  { id:"profile",   label:"Profile",         Icon: User },
];

const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function fmtDate(ds) {
  if (!ds) return "—";
  const d = new Date(ds);
  return `${DAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`;
}
function bandColor(b) { return !b ? AD.muted : b >= 7 ? AD.green : b >= 6 ? AD.blue : b >= 5 ? AD.amber : AD.red; }
function bandBg(b)    { return !b ? AD.bg : b >= 7 ? AD.greenLt : b >= 6 ? AD.blueLt : b >= 5 ? AD.amberLt : AD.redLt; }
function initials(name) { return (name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }

function Spinner() {
  return <div style={{ width:24,height:24,border:`2.5px solid ${AD.blueLt}`,borderTopColor:AD.blue,
    borderRadius:"50%",animation:"lms-spin .7s linear infinite",margin:"48px auto" }}/>;
}
function EmptyState({ icon:Icon, text }) {
  return <div style={{ textAlign:"center",padding:"48px 24px",color:AD.muted }}>
    <Icon size={28} style={{ opacity:.35,marginBottom:10 }}/>
    <div style={{ fontSize:13,fontWeight:500 }}>{text}</div>
  </div>;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ tab, setTab, teacher, onLogout }) {
  const ini = initials(teacher?.displayName);
  return (
    <aside style={{ width:220,flexShrink:0,background:AD.surface,borderRight:`1px solid ${AD.border}`,
      display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0 }}>
      <div style={{ padding:"20px 20px 16px",borderBottom:`1px solid ${AD.border}` }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:32,height:32,borderRadius:9,
            background:`linear-gradient(135deg,${AD.blue},${AD.blueDk})`,
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <span style={{ color:"#fff",fontWeight:900,fontSize:16 }}>L</span>
          </div>
          <div>
            <div style={{ fontSize:13,fontWeight:800,color:AD.text,letterSpacing:"-0.02em",lineHeight:1 }}>LingvoConnect</div>
            <div style={{ fontSize:10,color:AD.muted,fontWeight:500 }}>Teacher Portal</div>
          </div>
        </div>
      </div>
      <nav style={{ flex:1,padding:"12px 10px",overflowY:"auto" }}>
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button key={id} type="button" onClick={() => setTab(id)} style={{
              display:"flex",alignItems:"center",gap:10,width:"100%",
              padding:"9px 12px",borderRadius:10,border:"none",cursor:"pointer",
              marginBottom:2,textAlign:"left",
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
      <div style={{ padding:"12px 10px",borderTop:`1px solid ${AD.border}` }}>
        <div role="button" tabIndex={0} onClick={() => setTab("profile")}
          onKeyDown={e => e.key==="Enter" && setTab("profile")}
          style={{
            display:"flex",alignItems:"center",gap:10,padding:"8px 12px",
            borderRadius:10,background: tab==="profile" ? AD.blueLt : AD.bg,
            cursor:"pointer",transition:"background .15s",
          }}>
          <div style={{ width:30,height:30,borderRadius:8,flexShrink:0,
            background: tab==="profile" ? AD.blue : AD.blueLt,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:11,fontWeight:800,color: tab==="profile" ? "#fff" : AD.blue }}>{ini}</div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:12,fontWeight:700,
              color: tab==="profile" ? AD.blue : AD.text,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
              {teacher?.displayName}
            </div>
            <div style={{ fontSize:10,color:AD.muted }}>Profile & Settings</div>
          </div>
          <button type="button" onClick={e=>{e.stopPropagation();onLogout();}} title="Sign out" style={{
            background:"none",border:"none",cursor:"pointer",color:AD.muted,
            display:"flex",padding:2,flexShrink:0,
          }}><LogOut size={14}/></button>
        </div>
      </div>
    </aside>
  );
}

// shared helper: next N recurring sessions from group schedules
function buildUpcomingSessions(groups, days = 14, limit = 20) {
  if (!groups.length) return [];
  const now = new Date();
  const cutoff = new Date(now); cutoff.setDate(now.getDate() + days);
  const sessions = [];
  groups.forEach(g => {
    (g.schedule || []).forEach(slot => {
      for (let week = 0; week < Math.ceil(days / 7) + 1; week++) {
        let daysUntil = (slot.day - now.getDay() + 7) % 7 + week * 7;
        if (daysUntil === 0 && week === 0) {
          const [h, m] = (slot.start || "00:00").split(":").map(Number);
          if (h * 60 + m <= now.getHours() * 60 + now.getMinutes()) daysUntil = 7;
        }
        const date = new Date(now);
        date.setDate(now.getDate() + daysUntil);
        date.setHours(0, 0, 0, 0);
        if (date <= cutoff) sessions.push({ group: g, date, slot });
      }
    });
  });
  return sessions.sort((a, b) => a.date - b.date || (a.slot.start||"").localeCompare(b.slot.start||"")).slice(0, limit);
}

// ── OVERVIEW TAB ──────────────────────────────────────────────────────────────
function OverviewTab({ groups, allStudents, setTab, openGroup }) {
  const upcomingSessions = useMemo(() => buildUpcomingSessions(groups, 14, 20), [groups]);

  const totalEnrolled = useMemo(() => {
    try {
      const ft = JSON.parse(localStorage.getItem("lv_fake_teacher") || "{}");
      const ids = new Set();
      Object.values(ft.groupStudents || {}).forEach(arr => arr.forEach(s => ids.add(s.student_id)));
      if (ids.size) return ids.size;
    } catch {}
    return allStudents.filter(s => s.student_id?.startsWith("TST")).length || allStudents.length;
  }, [allStudents]);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekEnd    = new Date(todayStart); weekEnd.setDate(todayStart.getDate() + 7);
  const sessionsToday    = upcomingSessions.filter(s => s.date.getTime() === todayStart.getTime()).length;
  const sessionsThisWeek = upcomingSessions.filter(s => s.date < weekEnd).length;

  function dayLabel(date) {
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    if (d.getTime() === todayStart.getTime()) return "Today";
    const tom = new Date(todayStart); tom.setDate(todayStart.getDate() + 1);
    if (d.getTime() === tom.getTime()) return "Tomorrow";
    return `${DAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`;
  }

  const statTiles = [
    { lbl:"Active Groups",       val:groups.length,      Icon:Users,         nav:"groups" },
    { lbl:"Enrolled Students",   val:totalEnrolled,      Icon:GraduationCap, nav:"progress" },
    { lbl:"Sessions This Week",  val:sessionsThisWeek,   Icon:CalendarDays,  nav:"calendar" },
    { lbl:"Today's Sessions",    val:sessionsToday,      Icon:Clock,         nav:"calendar" },
  ];

  // Student count per group from fake data
  const studentCounts = useMemo(() => {
    try {
      const ft = JSON.parse(localStorage.getItem("lv_fake_teacher") || "{}");
      const counts = {};
      Object.entries(ft.groupStudents || {}).forEach(([gid, arr]) => { counts[gid] = arr.length; });
      return counts;
    } catch { return {}; }
  }, []);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* ── Stat tiles — same as admin ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {statTiles.map(({ lbl, val, Icon, nav }) => (
          <div key={lbl} onClick={() => setTab(nav)} style={{
            background:AD.surface, borderRadius:16, border:`1px solid ${AD.border}`,
            padding:"18px 20px", cursor:"pointer", transition:"box-shadow .15s",
          }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.07)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:AD.bg,
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Icon size={16} color={AD.sub} strokeWidth={1.8}/>
              </div>
              <span style={{ fontSize:12, color:AD.sub, fontWeight:500, letterSpacing:"-0.01em" }}>{lbl}</span>
            </div>
            <span style={{ fontSize:34, fontWeight:800, color:AD.text, letterSpacing:"-0.05em", lineHeight:1 }}>{val}</span>
          </div>
        ))}
      </div>

      {/* ── Active group cards — uses group color set by admin ── */}
      {groups.length > 0 && (
        <div style={{ background:AD.surface, borderRadius:16, border:`1px solid ${AD.border}`, padding:"20px 24px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <span style={{ fontSize:16, fontWeight:700, color:AD.text, letterSpacing:"-0.02em" }}>Active Groups</span>
            <button type="button" onClick={() => setTab("groups")} style={{
              fontSize:12, fontWeight:600, color:AD.blue, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit",
            }}>Manage groups →</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(groups.length, 3)},1fr)`, gap:14 }}>
            {groups.map(g => {
              const gColor = g.color || AD.blue;
              const gColorDk = gColor + "cc";
              const days = (g.schedule || []).filter(s => !s.is_mock_test_day).map(s => DAY[s.day]).join(" · ");
              const count = studentCounts[g.id] ?? 0;
              // next session
              const upcoming = buildUpcomingSessions([g], 14, 1);
              const next = upcoming[0];
              return (
                <div key={g.id} onClick={() => setTab("groups")} style={{
                  background:`linear-gradient(135deg, ${gColor} 0%, ${gColorDk} 100%)`,
                  borderRadius:16, padding:"20px 20px 18px", cursor:"pointer", position:"relative", overflow:"hidden",
                  boxShadow:`0 4px 20px ${gColor}44`,
                  display:"flex", flexDirection:"column",
                }}>
                  <div style={{ position:"absolute", top:-20, right:-20, width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,.08)" }}/>
                  <div style={{ position:"absolute", bottom:-30, right:20, width:70, height:70, borderRadius:"50%", background:"rgba(255,255,255,.05)" }}/>
                  {/* Header */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, position:"relative" }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:"rgba(255,255,255,.2)",
                      display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <GraduationCap size={17} color="#fff"/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:"#fff", letterSpacing:"-0.02em", lineHeight:1.2 }}>{g.name}</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.7)", marginTop:1 }}>{g.level || "General English"}</div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:800, letterSpacing:".06em",
                      color:"rgba(255,255,255,.7)", background:"rgba(255,255,255,.15)", padding:"3px 8px",
                      borderRadius:5, textTransform:"uppercase", flexShrink:0 }}>{g.level || "Group"}</span>
                  </div>
                  {/* Next session — flex:1 so all cards push footer to same position */}
                  <div style={{ flex:1, position:"relative" }}>
                    {next ? (
                      <div style={{ background:"rgba(255,255,255,.15)", borderRadius:10, padding:"8px 12px", marginBottom:14 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,.65)", textTransform:"uppercase",
                          letterSpacing:".06em", marginBottom:3 }}>Next Session</div>
                        <div style={{ fontSize:12, fontWeight:700, color:"#fff" }}>
                          {DAY[next.date.getDay()]} {next.date.getDate()} {MONTH[next.date.getMonth()]}
                          {" · "}{next.slot.start}–{next.slot.end}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", fontStyle:"italic", marginBottom:14 }}>
                        {days || "No schedule set"}
                      </div>
                    )}
                  </div>
                  {/* Footer */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <Users size={11} color="rgba(255,255,255,.6)"/>
                      <span style={{ fontSize:11, color:"rgba(255,255,255,.7)", fontWeight:500 }}>{count} student{count !== 1 ? "s" : ""}</span>
                    </div>
                    <button type="button" onClick={e => { e.stopPropagation(); openGroup(g.id); }} style={{
                      background:"rgba(255,255,255,.9)", color:gColor, border:"none", borderRadius:8,
                      padding:"6px 14px", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
                    }}>View →</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bottom: sessions table ── */}
      <div style={{ background:AD.surface, borderRadius:16, border:`1px solid ${AD.border}`, padding:"20px 24px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <span style={{ fontSize:16, fontWeight:700, color:AD.text, letterSpacing:"-0.02em" }}>Upcoming Sessions</span>
          <button type="button" onClick={() => setTab("calendar")} style={{
            fontSize:12, fontWeight:600, color:AD.blue, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit",
          }}>View calendar →</button>
        </div>
        {/* Table header */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 80px", gap:12,
          padding:"0 0 8px", borderBottom:`1px solid ${AD.border}`, marginBottom:4 }}>
          {["Lesson / Group", "Schedule", "Duration"].map(h => (
            <span key={h} style={{ fontSize:11, fontWeight:600, color:AD.muted,
              letterSpacing:".03em", textTransform:"uppercase" }}>{h}</span>
          ))}
        </div>
        {upcomingSessions.length === 0
          ? <div style={{ padding:"24px 0", textAlign:"center", color:AD.muted, fontSize:13 }}>No sessions scheduled.</div>
          : upcomingSessions.slice(0, 6).map(({ group: g, date, slot }, i) => {
              const todayTime = todayStart.getTime();
              const isToday   = date.getTime() === todayTime;
              const lbl = isToday ? "Today" : `${DAY[date.getDay()]}, ${date.getDate()} ${MONTH[date.getMonth()]}`;
              const [sh, sm] = (slot.start || "0:0").split(":").map(Number);
              const [eh, em] = (slot.end || "0:0").split(":").map(Number);
              const dur = Math.round((eh + em / 60) - (sh + sm / 60)) * 60 + " min";
              return (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 120px 80px", gap:12,
                  padding:"12px 0", borderBottom: i < Math.min(upcomingSessions.length, 6) - 1 ? `1px solid ${AD.border}` : "none",
                  alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:AD.text, letterSpacing:"-0.01em", marginBottom:2 }}>
                      {g.name}
                      {slot.is_mock_test_day && (
                        <span style={{ marginLeft:8, fontSize:10, fontWeight:700, color:AD.amber,
                          background:AD.amberLt, padding:"1px 6px", borderRadius:4 }}>Mock</span>
                      )}
                    </div>
                    <div style={{ fontSize:11, color:AD.muted, display:"flex", alignItems:"center", gap:6 }}>
                      <Clock size={10} color={AD.muted}/>
                      {slot.start} – {slot.end}
                      {isToday && <span style={{ fontSize:10, fontWeight:700, color:AD.green,
                        background:AD.greenLt, padding:"1px 6px", borderRadius:4 }}>Today</span>}
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:AD.sub }}>{lbl}</div>
                  <div style={{ fontSize:12, color:AD.sub }}>{dur}</div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ── CALENDAR TAB ──────────────────────────────────────────────────────────────
function CalendarTab({ groups, openGroup }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [calView, setCalView] = useState("calendar"); // "calendar" | "cards"

  const weekStart = useMemo(() => {
    const now = new Date();
    const diff = now.getDay() === 0 ? -6 : 1 - now.getDay(); // Monday
    const mon = new Date(now);
    mon.setDate(now.getDate() + diff + weekOffset * 7);
    mon.setHours(0, 0, 0, 0);
    return mon;
  }, [weekOffset]);

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    }), [weekStart]);

  // Sessions for this week keyed by day-of-week index (0=Mon…6=Sun in our column order)
  const sessionsByCol = useMemo(() => {
    const map = {};
    days.forEach((d, colIdx) => {
      const dow = d.getDay(); // 0=Sun…6=Sat
      const slots = [];
      groups.forEach(g => {
        (g.schedule || []).forEach(slot => {
          if (slot.day === dow) slots.push({ group: g, slot });
        });
      });
      slots.sort((a, b) => (a.slot.start || "").localeCompare(b.slot.start || ""));
      map[colIdx] = slots;
    });
    return map;
  }, [days, groups]);

  const START_H = 8;
  const END_H   = 20;
  const HOUR_PX = 64; // px per hour
  const TOTAL_H = (END_H - START_H) * HOUR_PX;

  function timeToY(t) {
    const [h, m] = (t || "00:00").split(":").map(Number);
    return (h - START_H + m / 60) * HOUR_PX;
  }
  function timeToH(start, end) {
    const [sh, sm] = (start || "00:00").split(":").map(Number);
    const [eh, em] = (end   || "00:00").split(":").map(Number);
    return Math.max(((eh + em / 60) - (sh + sm / 60)) * HOUR_PX, 28);
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekLbl = `${days[0].getDate()} ${MONTH[days[0].getMonth()]} – ${days[6].getDate()} ${MONTH[days[6].getMonth()]} ${days[6].getFullYear()}`;

  const btnStyle = (active) => ({
    padding:"7px 16px", borderRadius:9,
    border:`1.5px solid ${active ? AD.blue : AD.border}`,
    background: active ? AD.blueLt : AD.surface,
    color: active ? AD.blue : AD.sub,
    fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
  });

  // upcoming sessions for card view (next 30 days)
  const upcomingCards = useMemo(() => buildUpcomingSessions(groups, 30, 50), [groups]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Navigation bar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {calView === "calendar" && <>
            <button type="button" onClick={() => setWeekOffset(w => w - 1)} style={btnStyle(false)}>
              <ChevronLeft size={14} style={{ marginBottom:-2 }}/>
            </button>
            <button type="button" onClick={() => setWeekOffset(0)} style={btnStyle(weekOffset === 0)}>
              Today
            </button>
            <button type="button" onClick={() => setWeekOffset(w => w + 1)} style={btnStyle(false)}>
              <ChevronRight size={14} style={{ marginBottom:-2 }}/>
            </button>
          </>}
          {calView === "calendar" && <span style={{ fontSize:14, fontWeight:700, color:AD.text, letterSpacing:"-0.02em", marginLeft:6 }}>{weekLbl}</span>}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {/* View toggle */}
          <div style={{ display:"flex", background:AD.bg, borderRadius:10, padding:3, border:`1px solid ${AD.border}` }}>
            {[["calendar","Calendar",Calendar],["cards","Cards",LayoutDashboard]].map(([id,label,Icon]) => (
              <button key={id} type="button" onClick={() => setCalView(id)} style={{
                display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:8,
                border:"none",cursor:"pointer",fontFamily:"inherit",
                background: calView===id ? AD.surface : "transparent",
                color: calView===id ? AD.blue : AD.muted,
                fontSize:12,fontWeight:700,
                boxShadow: calView===id ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                transition:"all .15s",
              }}>
                <Icon size={13}/>{label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend (calendar view only) */}
        {calView === "calendar" && (
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            {groups.map(g => (
              <div key={g.id} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:10, height:10, borderRadius:3, background:g.color || AD.blue }}/>
                <span style={{ fontSize:11, color:AD.sub, fontWeight:500 }}>{g.name}</span>
              </div>
            ))}
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:10, height:10, borderRadius:3, background:AD.amber }}/>
              <span style={{ fontSize:11, color:AD.sub, fontWeight:500 }}>Mock Test</span>
            </div>
          </div>
        )}
      </div>

      {/* Card view */}
      {calView === "cards" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* Group overview cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:12 }}>
            {groups.map(g => {
              const color = g.color || AD.blue;
              const nextSlots = upcomingCards.filter(s => s.group.id === g.id).slice(0, 1);
              const next = nextSlots[0];
              return (
                <div key={g.id} style={{
                  borderRadius:16, padding:20, position:"relative", overflow:"hidden",
                  background:`linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
                  boxShadow:`0 4px 20px ${color}44`,
                  display:"flex", flexDirection:"column",
                }}>
                  <div style={{ position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",
                    background:"rgba(255,255,255,.08)" }}/>
                  <div style={{ position:"absolute",bottom:-30,right:20,width:60,height:60,borderRadius:"50%",
                    background:"rgba(255,255,255,.06)" }}/>
                  {/* Header */}
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14,position:"relative" }}>
                    <div style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,.2)",
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                      <GraduationCap size={17} color="#fff"/>
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:15,fontWeight:800,color:"#fff",letterSpacing:"-0.02em",lineHeight:1.2 }}>{g.name}</div>
                      <div style={{ fontSize:11,color:"rgba(255,255,255,.7)",marginTop:1 }}>{g.level || "General English"}</div>
                    </div>
                    <span style={{ fontSize:10,fontWeight:800,letterSpacing:".06em",color:"rgba(255,255,255,.7)",
                      background:"rgba(255,255,255,.15)",padding:"3px 8px",borderRadius:5,
                      textTransform:"uppercase",flexShrink:0 }}>{g.level || "Group"}</span>
                  </div>
                  {/* Session — flex:1 keeps footer aligned */}
                  <div style={{ flex:1,position:"relative" }}>
                    {next ? (
                      <div style={{ background:"rgba(255,255,255,.15)",borderRadius:10,padding:"8px 12px",marginBottom:14 }}>
                        <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.65)",
                          textTransform:"uppercase",letterSpacing:".06em",marginBottom:3 }}>Next Session</div>
                        <div style={{ fontSize:12,fontWeight:700,color:"#fff" }}>
                          {DAY[next.date.getDay()]} {next.date.getDate()} {MONTH[next.date.getMonth()]}
                          {" · "}{next.slot.start}–{next.slot.end}
                        </div>
                        {next.slot.is_mock_test_day && (
                          <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.9)",marginTop:2 }}>⚡ Mock Test Day</div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize:11,color:"rgba(255,255,255,.5)",fontStyle:"italic",marginBottom:14 }}>No upcoming sessions</div>
                    )}
                  </div>
                  {/* Footer */}
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative" }}>
                    <span style={{ fontSize:11,color:"rgba(255,255,255,.65)",fontWeight:500 }}>
                      {(upcomingCards.filter(s=>s.group.id===g.id).length)} sessions upcoming
                    </span>
                    <button type="button" onClick={e => { e.stopPropagation(); openGroup(g.id); }} style={{
                      background:"rgba(255,255,255,.9)",color,border:"none",borderRadius:8,
                      padding:"6px 14px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit",
                    }}>View →</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upcoming sessions list */}
          <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
            <h3 style={{ fontSize:14,fontWeight:800,color:AD.text,margin:"0 0 14px",letterSpacing:"-0.02em" }}>
              Upcoming Sessions (next 30 days)
            </h3>
            {upcomingCards.length === 0 ? (
              <EmptyState icon={Calendar} text="No upcoming sessions scheduled."/>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {upcomingCards.map((s, i) => {
                  const color = s.group.color || AD.blue;
                  const isMock = s.slot.is_mock_test_day;
                  const isToday = s.date.toDateString() === new Date().toDateString();
                  return (
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:12,
                      padding:"12px 14px",background:AD.bg,borderRadius:11,border:`1px solid ${AD.border}` }}>
                      <div style={{ width:42,textAlign:"center",flexShrink:0 }}>
                        <div style={{ fontSize:10,fontWeight:700,color:AD.muted,textTransform:"uppercase" }}>
                          {MONTH[s.date.getMonth()]}
                        </div>
                        <div style={{ fontSize:18,fontWeight:900,color:AD.text,lineHeight:1 }}>{s.date.getDate()}</div>
                        <div style={{ fontSize:9,fontWeight:600,color:AD.muted,textTransform:"uppercase" }}>
                          {DAY[s.date.getDay()]}
                        </div>
                      </div>
                      <div style={{ width:3,height:36,borderRadius:2,background:isMock ? AD.amber : color,flexShrink:0 }}/>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:13,fontWeight:700,color:AD.text }}>{s.group.name}</div>
                        <div style={{ fontSize:11,color:AD.muted,marginTop:1 }}>{s.slot.start}–{s.slot.end}</div>
                      </div>
                      {isToday && <span style={{ fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,
                        background:AD.greenLt,color:AD.green }}>TODAY</span>}
                      {isMock && <span style={{ fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,
                        background:AD.amberLt,color:AD.amber }}>MOCK</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {calView === "calendar" && (<>

      {/* Calendar grid */}
      <div style={{ background:AD.surface, borderRadius:16, border:`1px solid ${AD.border}`, overflow:"hidden" }}>
        {/* Day headers */}
        <div style={{ display:"grid", gridTemplateColumns:"48px repeat(7,1fr)",
          borderBottom:`1px solid ${AD.border}`, background:AD.bg }}>
          <div style={{ borderRight:`1px solid ${AD.border}` }}/>
          {days.map((d, i) => {
            const isToday = d.getTime() === today.getTime();
            return (
              <div key={i} style={{ padding:"10px 0", textAlign:"center",
                borderRight: i < 6 ? `1px solid ${AD.border}` : "none",
                background: isToday ? AD.blueLt : "transparent" }}>
                <div style={{ fontSize:10, fontWeight:700, color: isToday ? AD.blue : AD.muted,
                  textTransform:"uppercase", letterSpacing:".06em" }}>{DAY[d.getDay()]}</div>
                <div style={{
                  width:28, height:28, borderRadius:"50%", margin:"4px auto 0",
                  background: isToday ? AD.blue : "transparent",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:14, fontWeight: isToday ? 800 : 600,
                  color: isToday ? "#fff" : AD.text,
                }}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* Scrollable time body */}
        <div style={{ overflowY:"auto", maxHeight:520 }}>
          <div style={{ display:"grid", gridTemplateColumns:"48px repeat(7,1fr)", position:"relative" }}>
            {/* Time axis */}
            <div style={{ position:"relative", height:TOTAL_H, borderRight:`1px solid ${AD.border}` }}>
              {Array.from({ length: END_H - START_H }, (_, i) => (
                <div key={i} style={{ position:"absolute", top: i * HOUR_PX + 1,
                  right:6, fontSize:9, fontWeight:600, color:AD.muted, userSelect:"none" }}>
                  {(START_H + i).toString().padStart(2,"0")}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((d, colIdx) => {
              const isToday = d.getTime() === today.getTime();
              const slots = sessionsByCol[colIdx] || [];
              return (
                <div key={colIdx} style={{
                  position:"relative", height:TOTAL_H,
                  borderRight: colIdx < 6 ? `1px solid ${AD.border}` : "none",
                  background: isToday ? `${AD.blueLt}44` : "transparent",
                }}>
                  {/* Hour grid lines */}
                  {Array.from({ length: END_H - START_H - 1 }, (_, i) => (
                    <div key={i} style={{
                      position:"absolute", top:(i + 1) * HOUR_PX, left:0, right:0,
                      borderTop:`1px solid ${AD.border}`, opacity:.5,
                    }}/>
                  ))}
                  {/* Half-hour lines */}
                  {Array.from({ length: END_H - START_H }, (_, i) => (
                    <div key={`h${i}`} style={{
                      position:"absolute", top: i * HOUR_PX + HOUR_PX / 2, left:0, right:0,
                      borderTop:`1px dashed ${AD.border}`, opacity:.4,
                    }}/>
                  ))}
                  {/* Session blocks */}
                  {slots.map((s, j) => {
                    const isMock = s.slot.is_mock_test_day;
                    const top    = timeToY(s.slot.start);
                    const height = timeToH(s.slot.start, s.slot.end);
                    const bg     = isMock ? AD.amberLt   : AD.blueLt;
                    const border = isMock ? AD.amber      : (s.group.color || AD.blue);
                    const col    = isMock ? AD.amber      : (s.group.color || AD.blue);
                    return (
                      <div key={j} style={{
                        position:"absolute", top, left:3, right:3, height,
                        borderRadius:8, overflow:"hidden", padding:"5px 7px",
                        background:bg, borderLeft:`3px solid ${border}`,
                        boxShadow:"0 1px 4px rgba(0,0,0,.06)",
                      }}>
                        <div style={{ fontSize:10, fontWeight:800, color:col,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                          letterSpacing:"-0.01em" }}>
                          {s.group.name}
                        </div>
                        {height > 40 && (
                          <div style={{ fontSize:9, color:AD.muted, marginTop:2 }}>
                            {s.slot.start}–{s.slot.end}
                            {isMock && " · Mock Test"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      </>)}
    </div>
  );
}

// ── GROUPS TAB ────────────────────────────────────────────────────────────────
function GroupsTab({ groups, allStudents, initialGroupId }) {
  const [expanded, setExpanded] = useState(initialGroupId || null);
  const [groupStudents, setGroupStudents] = useState({});

  async function toggleGroup(g) {
    if (expanded === g.id) { setExpanded(null); return; }
    setExpanded(g.id);
    if (!groupStudents[g.id]) {
      try {
        const rows = await getGroupStudents(g.id);
        const enriched = rows.map(r => ({
          ...r,
          _student: allStudents.find(s => s.student_id === r.student_id) || null,
        }));
        setGroupStudents(p => ({ ...p, [g.id]: enriched }));
      } catch { setGroupStudents(p => ({ ...p, [g.id]: [] })); }
    }
  }

  const DAY_S = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  function scheduleLabel(g) {
    if (!g.schedule?.length) return "No schedule";
    return g.schedule.map(s => `${DAY_S[s.day]} ${s.start}`).join(" · ");
  }

  if (!groups.length) return (
    <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
      <EmptyState icon={Users} text="No groups assigned to you yet. Ask an admin to assign you a group."/>
    </div>
  );

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
      {groups.map(g => {
        const open = expanded === g.id;
        const students = groupStudents[g.id] || [];
        return (
          <div key={g.id} style={{ background:AD.surface,borderRadius:16,
            border:`1px solid ${AD.border}`,overflow:"hidden",
            boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
            <button type="button" onClick={() => toggleGroup(g)} style={{
              display:"flex",alignItems:"center",gap:14,width:"100%",
              padding:"18px 20px",background:"none",border:"none",cursor:"pointer",textAlign:"left",
            }}>
              <div style={{ width:40,height:40,borderRadius:12,flexShrink:0,
                background:AD.blueLt,display:"flex",alignItems:"center",justifyContent:"center" }}>
                <Users size={18} color={AD.blue}/>
              </div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:15,fontWeight:800,color:AD.text,letterSpacing:"-0.03em" }}>{g.name}</div>
                <div style={{ fontSize:12,color:AD.muted,marginTop:2 }}>{scheduleLabel(g)}</div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:12,flexShrink:0 }}>
                {g.level && <span style={{ fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:6,
                  background:AD.blueLt,color:AD.blue }}>{g.level}</span>}
                <ChevronDown size={16} color={AD.muted} style={{ transform:open?"rotate(180deg)":"none",transition:"transform .2s" }}/>
              </div>
            </button>

            {open && (
              <div style={{ borderTop:`1px solid ${AD.border}`,padding:"16px 20px" }}>
                {students.length === 0
                  ? <div style={{ fontSize:13,color:AD.muted,textAlign:"center",padding:"16px 0" }}>No students enrolled yet.</div>
                  : <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10 }}>
                      {students.map(r => {
                        const s = r._student;
                        const name = s?.full_name || r.student_id;
                        return (
                          <div key={r.student_id} style={{ display:"flex",alignItems:"center",gap:10,
                            padding:"10px 12px",background:AD.bg,borderRadius:10,border:`1px solid ${AD.border}` }}>
                            <div style={{ width:30,height:30,borderRadius:8,flexShrink:0,
                              background:AD.blueLt,display:"flex",alignItems:"center",justifyContent:"center",
                              fontSize:11,fontWeight:800,color:AD.blue }}>{initials(name)}</div>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ fontSize:12,fontWeight:700,color:AD.text,
                                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{name}</div>
                              <div style={{ fontSize:10,color:AD.muted }}>{s?.email || ""}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                }
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ATTENDANCE TAB ────────────────────────────────────────────────────────────
function AttendanceTab({ groups }) {
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.id || null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [saving, setSaving] = useState({});
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    if (!selectedGroup) return;
    setLoadingSessions(true);
    Promise.allSettled([getSessions(selectedGroup), getGroupStudents(selectedGroup)]).then(([s, st]) => {
      const sess = s.status === "fulfilled" ? s.value : [];
      setSessions(sess);
      setSelectedSession(sess[0]?.id || null);
      setStudents(st.status === "fulfilled" ? st.value : []);
      setLoadingSessions(false);
    });
  }, [selectedGroup]);

  useEffect(() => {
    if (!selectedSession) { setAttendance({}); return; }
    getAttendance(selectedSession).then(rows => {
      const map = {};
      rows.forEach(r => { map[r.student_id] = r.status; });
      setAttendance(map);
    }).catch(() => setAttendance({}));
  }, [selectedSession]);

  async function handleMark(studentId, status) {
    if (!selectedSession) return;
    setSaving(p => ({ ...p, [studentId]: true }));
    try {
      await markAttendance(selectedSession, studentId, status);
      setAttendance(p => ({ ...p, [studentId]: status }));
    } catch(e) { console.error(e); }
    finally { setSaving(p => ({ ...p, [studentId]: false })); }
  }

  const STATUS_CFG = {
    present: { label:"Present",  color:AD.green, bg:AD.greenLt, Icon: CheckCircle2 },
    absent:  { label:"Absent",   color:AD.red,   bg:AD.redLt,   Icon: XCircle },
    late:    { label:"Late",     color:AD.amber, bg:AD.amberLt, Icon: Clock },
  };

  if (!groups.length) return (
    <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
      <EmptyState icon={CalendarDays} text="No groups assigned yet."/>
    </div>
  );

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
      {/* selectors */}
      <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
        <div style={{ flex:1,minWidth:160 }}>
          <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
            letterSpacing:".06em",textTransform:"uppercase",marginBottom:7 }}>Group</label>
          <select value={selectedGroup||""} onChange={e => setSelectedGroup(e.target.value)} style={{
            width:"100%",padding:"10px 14px",borderRadius:10,border:`1.5px solid ${AD.border}`,
            background:AD.surface,fontSize:13,color:AD.text,fontFamily:"inherit",cursor:"pointer",
          }}>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div style={{ flex:1,minWidth:160 }}>
          <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
            letterSpacing:".06em",textTransform:"uppercase",marginBottom:7 }}>Session</label>
          <select value={selectedSession||""} onChange={e => setSelectedSession(e.target.value)} style={{
            width:"100%",padding:"10px 14px",borderRadius:10,border:`1.5px solid ${AD.border}`,
            background:AD.surface,fontSize:13,color:AD.text,fontFamily:"inherit",cursor:"pointer",
          }}>
            {loadingSessions ? <option>Loading…</option>
              : sessions.length === 0 ? <option value="">No sessions</option>
              : sessions.map(s => <option key={s.id} value={s.id}>{fmtDate(s.date)} {s.start_time||""}</option>)
            }
          </select>
        </div>
      </div>

      {/* student list */}
      <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
        <h2 style={{ fontSize:15,fontWeight:800,color:AD.text,margin:"0 0 16px",letterSpacing:"-0.03em" }}>
          Mark Attendance
        </h2>
        {!selectedSession
          ? <EmptyState icon={CalendarDays} text="Select a session to mark attendance."/>
          : students.length === 0
          ? <EmptyState icon={Users} text="No students in this group."/>
          : <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {students.map(row => {
                const current = attendance[row.student_id];
                return (
                  <div key={row.student_id} style={{ display:"flex",alignItems:"center",gap:12,
                    padding:"12px 14px",background:AD.bg,borderRadius:11,border:`1px solid ${AD.border}` }}>
                    <div style={{ width:32,height:32,borderRadius:8,flexShrink:0,
                      background:AD.blueLt,display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:11,fontWeight:800,color:AD.blue }}>{initials(row.student_id)}</div>
                    <div style={{ flex:1,fontSize:13,fontWeight:600,color:AD.text }}>{row.student_id}</div>
                    <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                      {Object.entries(STATUS_CFG).map(([key, cfg]) => {
                        const active = current === key;
                        return (
                          <button key={key} type="button"
                            onClick={() => handleMark(row.student_id, key)}
                            disabled={saving[row.student_id]}
                            style={{
                              padding:"5px 12px",borderRadius:7,border:`1.5px solid ${active ? cfg.color : AD.border}`,
                              background: active ? cfg.bg : "transparent",
                              color: active ? cfg.color : AD.muted,
                              fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .15s",
                            }}>{cfg.label}</button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
        }
      </div>
    </div>
  );
}

// ── CONTENT TAB ───────────────────────────────────────────────────────────────
function ContentTab({ groups, teacher }) {
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.id || null);
  const [materials, setMaterials] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState("materials");

  // ── Assign IELTS Test state ──
  const publishedSuites = useMemo(() => {
    // loadDB() may not be initialized in teacher context — read localStorage directly
    try {
      const raw = JSON.parse(localStorage.getItem("lv_ielts_v2") || "{}");
      return (raw.testSuites || loadDB().testSuites || []).filter(s => s.status === "published");
    } catch { return (loadDB().testSuites || []).filter(s => s.status === "published"); }
  }, []);
  const [assignSuiteId, setAssignSuiteId] = useState("");
  const [assignDue, setAssignDue]         = useState("");
  const [assignNote, setAssignNote]       = useState("");
  const [assignSaving, setAssignSaving]   = useState(false);
  const [assignMsg, setAssignMsg]         = useState(null);
  const [testAssignments, setTestAssignments] = useState([]);

  // Load existing test assignments for this group from fake_data
  useEffect(() => {
    if (!selectedGroup) return;
    try {
      const fd = JSON.parse(localStorage.getItem("lv_fake_data") || "{}");
      const seen = new Set();
      const found = [];
      Object.values(fd).forEach(student => {
        (student.assignments || []).filter(a => a.group_id === selectedGroup && a.suite_id).forEach(a => {
          if (!seen.has(a.suite_id)) { seen.add(a.suite_id); found.push(a); }
        });
      });
      setTestAssignments(found);
    } catch { setTestAssignments([]); }
  }, [selectedGroup]);

  async function handleAssignTest(e) {
    e.preventDefault();
    if (!assignSuiteId) { setAssignMsg({ type:"err", text:"Select a test suite first." }); return; }
    if (!selectedGroup) return;
    setAssignSaving(true);
    setAssignMsg(null);
    try {
      const suite = publishedSuites.find(s => s.id === assignSuiteId);
      const ft = JSON.parse(localStorage.getItem("lv_fake_teacher") || "{}");
      const enrolled = ft.groupStudents?.[selectedGroup] || [];
      if (!enrolled.length) { setAssignMsg({ type:"err", text:"No students in this group yet." }); setAssignSaving(false); return; }
      const targets = assignTarget === "student" && assignStudentId
        ? enrolled.filter(s => s.student_id === assignStudentId)
        : enrolled;
      if (!targets.length) { setAssignMsg({ type:"err", text:"Student not found in this group." }); setAssignSaving(false); return; }
      const fd = JSON.parse(localStorage.getItem("lv_fake_data") || "{}");
      const newAssignment = {
        id: `asgn_test_${Date.now()}`,
        suite_id: assignSuiteId,
        suite_name: suite?.name || "IELTS Test",
        group_id: selectedGroup,
        title: suite?.name || "IELTS Test",
        type: "test",
        due_date: assignDue || null,
        notes: assignNote,
        assigned_at: new Date().toISOString(),
        assigned_by: teacher?.displayName || "Teacher",
        status: "pending",
      };
      targets.forEach(({ student_id }) => {
        if (!fd[student_id]) fd[student_id] = { groups:[], assignments:[], attempts:[], materials:[], tasks:[] };
        const existing = (fd[student_id].assignments || []).findIndex(a => a.suite_id === assignSuiteId && a.group_id === selectedGroup);
        if (existing === -1) fd[student_id].assignments = [...(fd[student_id].assignments || []), newAssignment];
      });
      localStorage.setItem("lv_fake_data", JSON.stringify(fd));
      setTestAssignments(prev => prev.some(a => a.suite_id === assignSuiteId) ? prev : [...prev, newAssignment]);
      const targetLabel = assignTarget === "student" && assignStudentId
        ? `1 student`
        : `${targets.length} student${targets.length !== 1 ? "s" : ""}`;
      setAssignMsg({ type:"ok", text:`Assigned "${suite?.name}" to ${targetLabel}.` });
      setAssignSuiteId(""); setAssignDue(""); setAssignNote(""); setAssignTarget("group"); setAssignStudentId("");
    } catch(err) {
      setAssignMsg({ type:"err", text:err?.message || "Failed to assign." });
    } finally { setAssignSaving(false); }
  }

  function removeTestAssignment(suiteId) {
    try {
      const fd = JSON.parse(localStorage.getItem("lv_fake_data") || "{}");
      Object.keys(fd).forEach(sid => {
        if (fd[sid].assignments) {
          fd[sid].assignments = fd[sid].assignments.filter(a => !(a.suite_id === suiteId && a.group_id === selectedGroup));
        }
      });
      localStorage.setItem("lv_fake_data", JSON.stringify(fd));
      setTestAssignments(prev => prev.filter(a => a.suite_id !== suiteId));
    } catch {}
  }

  // new material form
  const [mTitle, setMTitle] = useState("");
  const [mUrl, setMUrl] = useState("");
  const [mDesc, setMDesc] = useState("");
  const [mSaving, setMSaving] = useState(false);

  // new task form
  const [tTitle, setTTitle] = useState("");
  const [tType, setTType] = useState("reading");
  const [tTarget, setTTarget] = useState("group"); // "group" | "student"
  const [tStudentId, setTStudentId] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tDue, setTDue] = useState("");
  const [tSaving, setTSaving] = useState(false);

  // Students in selected group (for single-student targeting)
  const [groupStudents, setGroupStudents] = useState([]);
  useEffect(() => {
    if (!selectedGroup) return;
    try {
      const ft = JSON.parse(localStorage.getItem("lv_fake_teacher") || "{}");
      setGroupStudents(ft.groupStudents?.[selectedGroup] || []);
    } catch { setGroupStudents([]); }
  }, [selectedGroup]);

  // assignTest: also support single-student
  const [assignTarget, setAssignTarget] = useState("group");
  const [assignStudentId, setAssignStudentId] = useState("");

  useEffect(() => {
    if (!selectedGroup) return;
    setLoading(true);
    Promise.allSettled([getMaterials(selectedGroup), getTasks(selectedGroup)]).then(([m, t]) => {
      setMaterials(m.status === "fulfilled" ? m.value : []);
      setTasks(t.status === "fulfilled" ? t.value : []);
      setLoading(false);
    });
  }, [selectedGroup]);

  async function addMaterial(e) {
    e.preventDefault();
    if (!mTitle.trim()) return;
    setMSaving(true);
    try {
      const mat = await createMaterial({ group_id:selectedGroup, title:mTitle, file_url:mUrl, description:mDesc });
      setMaterials(p => [mat, ...p]);
      setMTitle(""); setMUrl(""); setMDesc("");
    } catch(e) { console.error(e); }
    finally { setMSaving(false); }
  }

  async function removeMaterial(id) {
    try { await deleteMaterial(id); setMaterials(p => p.filter(m => m.id !== id)); } catch(e) { console.error(e); }
  }

  async function addTask(e) {
    e.preventDefault();
    if (!tTitle.trim()) return;
    setTSaving(true);
    try {
      // Save to lv_fake_data for each target student
      const ft = JSON.parse(localStorage.getItem("lv_fake_teacher") || "{}");
      const enrolled = ft.groupStudents?.[selectedGroup] || [];
      const targets = tTarget === "student" && tStudentId
        ? enrolled.filter(s => s.student_id === tStudentId)
        : enrolled;
      if (targets.length) {
        const fd = JSON.parse(localStorage.getItem("lv_fake_data") || "{}");
        const newTask = {
          id: `task_${Date.now()}`, group_id: selectedGroup,
          title: tTitle, task_type: tType, description: tDesc,
          due_date: tDue || null, status: "pending",
          assigned_at: new Date().toISOString(),
          assigned_to: tTarget === "student" ? tStudentId : "group",
        };
        targets.forEach(({ student_id }) => {
          if (!fd[student_id]) fd[student_id] = { groups:[], assignments:[], attempts:[], materials:[], tasks:[] };
          fd[student_id].tasks = [...(fd[student_id].tasks || []), newTask];
        });
        localStorage.setItem("lv_fake_data", JSON.stringify(fd));
      }
      const task = await createTask({ group_id:selectedGroup, title:tTitle, task_type:tType, description:tDesc, due_date:tDue||null });
      setTasks(p => [task, ...p]);
      setTTitle(""); setTDesc(""); setTDue(""); setTType("reading"); setTTarget("group"); setTStudentId("");
    } catch(e) { console.error(e); }
    finally { setTSaving(false); }
  }

  async function removeTask(id) {
    try { await deleteTask(id); setTasks(p => p.filter(t => t.id !== id)); } catch(e) { console.error(e); }
  }

  const inputStyle = {
    width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:9,
    border:`1.5px solid ${AD.border}`,fontSize:13,color:AD.text,
    background:AD.surface,fontFamily:"inherit",outline:"none",
  };

  if (!groups.length) return (
    <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
      <EmptyState icon={BookOpen} text="No groups assigned yet."/>
    </div>
  );

  // Card-style select
  const CardSelect = ({ value, onChange, options, placeholder }) => (
    <div style={{ position:"relative" }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        appearance:"none",WebkitAppearance:"none",
        width:"100%",padding:"10px 36px 10px 14px",borderRadius:12,
        border:`1.5px solid ${AD.border}`,background:AD.surface,
        fontSize:13,color:value ? AD.text : AD.muted,fontFamily:"inherit",
        cursor:"pointer",boxShadow:"0 1px 3px rgba(0,0,0,.06)",fontWeight:600,outline:"none",
      }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} color={AD.muted} style={{ position:"absolute",right:12,top:"50%",
        transform:"translateY(-50%)",pointerEvents:"none" }}/>
    </div>
  );

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,flexWrap:"wrap" }}>
        <div style={{ minWidth:200 }}>
          <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
            letterSpacing:".06em",textTransform:"uppercase",marginBottom:7 }}>Group</label>
          <CardSelect
            value={selectedGroup||""}
            onChange={v => setSelectedGroup(v)}
            options={groups.map(g => ({ value:g.id, label:g.name }))}
          />
        </div>
        {/* sub-tabs */}
        <div style={{ display:"flex",gap:4,marginTop:22 }}>
          {[["materials","Materials"],["tasks","Tasks"],["tests","Assign Test"]].map(([id,label]) => (
            <button key={id} type="button" onClick={() => setSubTab(id)} style={{
              padding:"8px 16px",borderRadius:9,border:`1.5px solid ${subTab===id ? AD.blue : AD.border}`,
              background: subTab===id ? AD.blueLt : "transparent",
              color: subTab===id ? AD.blue : AD.sub,
              fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .15s",
            }}>{label}</button>
          ))}
        </div>
      </div>

      {loading ? <Spinner/> : (
        <>
          {subTab === "materials" && (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {/* add form */}
              <form onSubmit={addMaterial} style={{ background:AD.surface,borderRadius:16,
                border:`1px solid ${AD.border}`,padding:20 }}>
                <h3 style={{ fontSize:14,fontWeight:800,color:AD.text,margin:"0 0 14px",letterSpacing:"-0.02em" }}>
                  Add material
                </h3>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
                  <div>
                    <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
                      textTransform:"uppercase",letterSpacing:".06em",marginBottom:5 }}>Title *</label>
                    <input value={mTitle} onChange={e=>setMTitle(e.target.value)}
                      placeholder="e.g. Reading Practice Unit 3" style={inputStyle}/>
                  </div>
                  <div>
                    <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
                      textTransform:"uppercase",letterSpacing:".06em",marginBottom:5 }}>File URL</label>
                    <input value={mUrl} onChange={e=>setMUrl(e.target.value)}
                      placeholder="https://…" style={inputStyle}/>
                  </div>
                </div>
                <input value={mDesc} onChange={e=>setMDesc(e.target.value)}
                  placeholder="Description (optional)" style={{ ...inputStyle,marginBottom:12 }}/>
                <button type="submit" disabled={mSaving||!mTitle.trim()} style={{
                  padding:"9px 20px",borderRadius:9,border:"none",cursor:"pointer",
                  background:AD.blue,color:"#fff",fontSize:13,fontWeight:700,
                  display:"flex",alignItems:"center",gap:6,opacity:mTitle.trim()?1:.5,
                }}>
                  <Plus size={14}/>{mSaving ? "Adding…" : "Add material"}
                </button>
              </form>

              {/* list */}
              <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
                <h3 style={{ fontSize:14,fontWeight:800,color:AD.text,margin:"0 0 14px",letterSpacing:"-0.02em" }}>
                  Materials ({materials.length})
                </h3>
                {materials.length === 0
                  ? <EmptyState icon={BookOpen} text="No materials yet. Add one above."/>
                  : <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                      {materials.map(m => (
                        <div key={m.id} style={{ display:"flex",alignItems:"center",gap:12,
                          padding:"12px 14px",background:AD.bg,borderRadius:11,border:`1px solid ${AD.border}` }}>
                          <div style={{ width:30,height:30,borderRadius:8,flexShrink:0,background:AD.blueLt,
                            display:"flex",alignItems:"center",justifyContent:"center" }}>
                            <FileText size={14} color={AD.blue}/>
                          </div>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontSize:13,fontWeight:700,color:AD.text }}>{m.title}</div>
                            {m.description && <div style={{ fontSize:11,color:AD.muted,marginTop:1 }}>{m.description}</div>}
                          </div>
                          <button type="button" onClick={() => removeMaterial(m.id)} style={{
                            background:"none",border:"none",cursor:"pointer",color:AD.muted,
                            display:"flex",padding:4,
                          }}><Trash2 size={14}/></button>
                        </div>
                      ))}
                    </div>
                }
              </div>
            </div>
          )}

          {subTab === "tests" && (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {/* Assign IELTS Test form */}
              <form onSubmit={handleAssignTest} style={{ background:AD.surface,borderRadius:16,
                border:`1px solid ${AD.border}`,padding:20 }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
                  <div style={{ width:34,height:34,borderRadius:10,background:AD.blueLt,
                    display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <FlaskConical size={15} color={AD.blue}/>
                  </div>
                  <h3 style={{ fontSize:14,fontWeight:800,color:AD.text,margin:0,letterSpacing:"-0.02em" }}>
                    Assign IELTS Test to Group
                  </h3>
                </div>
                {publishedSuites.length === 0 ? (
                  <div style={{ padding:"16px",background:AD.amberLt,borderRadius:10,border:`1px solid ${AD.amber}33`,
                    fontSize:13,color:AD.amber,fontWeight:600 }}>
                    No published test suites available. Ask an admin to publish a test.
                  </div>
                ) : (
                  <>
                    {assignMsg && (
                      <div style={{ padding:"10px 14px",borderRadius:10,marginBottom:12,
                        background: assignMsg.type==="ok" ? AD.greenLt : AD.redLt,
                        border:`1px solid ${assignMsg.type==="ok" ? AD.green+"33" : AD.red+"33"}`,
                        fontSize:13,fontWeight:600,color: assignMsg.type==="ok" ? AD.green : AD.red }}>
                        {assignMsg.text}
                      </div>
                    )}
                    {/* Assign to: group or single student */}
                    <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
                      textTransform:"uppercase",letterSpacing:".06em",marginBottom:8 }}>Assign to</label>
                    <div style={{ display:"flex",gap:8,marginBottom:12 }}>
                      {[["group","Whole Group",Users],["student","Single Student",User]].map(([id,label,Icon]) => {
                        const sel = assignTarget === id;
                        return (
                          <button key={id} type="button" onClick={() => setAssignTarget(id)} style={{
                            display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,
                            border:`1.5px solid ${sel ? AD.blue : AD.border}`,
                            background: sel ? AD.blueLt : "transparent",
                            color: sel ? AD.blue : AD.sub,
                            fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .15s",
                          }}>
                            <Icon size={13}/>{label}
                          </button>
                        );
                      })}
                    </div>
                    {assignTarget === "student" && (
                      <div style={{ marginBottom:12 }}>
                        <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
                          textTransform:"uppercase",letterSpacing:".06em",marginBottom:5 }}>Student *</label>
                        <CardSelect
                          value={assignStudentId}
                          onChange={setAssignStudentId}
                          placeholder="— select student —"
                          options={groupStudents.map(s => ({ value:s.student_id, label:s.display_name || s.student_id }))}
                        />
                      </div>
                    )}

                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
                      <div>
                        <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
                          textTransform:"uppercase",letterSpacing:".06em",marginBottom:5 }}>Test Suite *</label>
                        <CardSelect
                          value={assignSuiteId}
                          onChange={setAssignSuiteId}
                          placeholder="— select a test —"
                          options={publishedSuites.map(s => ({ value:s.id, label:s.name }))}
                        />
                      </div>
                      <div>
                        <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
                          textTransform:"uppercase",letterSpacing:".06em",marginBottom:5 }}>Due date</label>
                        <input type="date" value={assignDue} onChange={e=>setAssignDue(e.target.value)} style={{
                          width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:9,
                          border:`1.5px solid ${AD.border}`,background:AD.surface,fontSize:13,
                          color:AD.text,fontFamily:"inherit",outline:"none",
                        }}/>
                      </div>
                    </div>
                    <input value={assignNote} onChange={e=>setAssignNote(e.target.value)}
                      placeholder="Note for students (optional)" style={{
                        width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:9,
                        border:`1.5px solid ${AD.border}`,background:AD.surface,fontSize:13,
                        color:AD.text,fontFamily:"inherit",outline:"none",marginBottom:12,
                      }}/>
                    <button type="submit"
                      disabled={assignSaving||!assignSuiteId||(assignTarget==="student"&&!assignStudentId)} style={{
                      padding:"9px 20px",borderRadius:9,border:"none",cursor:"pointer",
                      background:AD.blue,color:"#fff",fontSize:13,fontWeight:700,
                      display:"flex",alignItems:"center",gap:6,
                      opacity:(assignSuiteId&&(assignTarget==="group"||assignStudentId))?1:.5,fontFamily:"inherit",
                    }}>
                      <Plus size={14}/>{assignSaving ? "Assigning…" : assignTarget==="student" ? "Assign to Student" : "Assign to Group"}
                    </button>
                  </>
                )}
              </form>

              {/* Existing test assignments */}
              <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
                <h3 style={{ fontSize:14,fontWeight:800,color:AD.text,margin:"0 0 14px",letterSpacing:"-0.02em" }}>
                  Assigned Tests ({testAssignments.length})
                </h3>
                {testAssignments.length === 0
                  ? <EmptyState icon={FlaskConical} text="No tests assigned to this group yet."/>
                  : <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                      {testAssignments.map(a => (
                        <div key={a.suite_id} style={{ display:"flex",alignItems:"center",gap:12,
                          padding:"12px 14px",background:AD.bg,borderRadius:11,border:`1px solid ${AD.border}` }}>
                          <div style={{ width:30,height:30,borderRadius:8,flexShrink:0,background:AD.blueLt,
                            display:"flex",alignItems:"center",justifyContent:"center" }}>
                            <FlaskConical size={14} color={AD.blue}/>
                          </div>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontSize:13,fontWeight:700,color:AD.text }}>{a.suite_name || a.title}</div>
                            <div style={{ fontSize:10,color:AD.muted,marginTop:2 }}>
                              {a.due_date ? `Due ${fmtDate(a.due_date)}` : "No due date"}
                              {a.assigned_by ? ` · Assigned by ${a.assigned_by}` : ""}
                            </div>
                          </div>
                          <span style={{ fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,
                            background:AD.amberLt,color:AD.amber,flexShrink:0 }}>IELTS Test</span>
                          <button type="button" onClick={() => removeTestAssignment(a.suite_id)} style={{
                            background:"none",border:"none",cursor:"pointer",color:AD.muted,
                            display:"flex",padding:4,flexShrink:0,
                          }}><Trash2 size={14}/></button>
                        </div>
                      ))}
                    </div>
                }
              </div>
            </div>
          )}

          {subTab === "tasks" && (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <form onSubmit={addTask} style={{ background:AD.surface,borderRadius:16,
                border:`1px solid ${AD.border}`,padding:20 }}>
                <h3 style={{ fontSize:14,fontWeight:800,color:AD.text,margin:"0 0 16px",letterSpacing:"-0.02em" }}>
                  Assign task
                </h3>

                {/* Task type card-picker */}
                <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
                  textTransform:"uppercase",letterSpacing:".06em",marginBottom:8 }}>Task type *</label>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:14 }}>
                  {[
                    { id:"reading",    label:"Reading",      Icon:BookOpen,    color:AD.blue,   bg:AD.blueLt   },
                    { id:"listening",  label:"Listening",    Icon:Headphones,  color:AD.purple, bg:AD.purpleLt },
                    { id:"writing",    label:"Writing",      Icon:PenLine,     color:AD.green,  bg:AD.greenLt  },
                    { id:"speaking",   label:"Speaking",     Icon:Mic,         color:AD.amber,  bg:AD.amberLt  },
                    { id:"vocabulary", label:"Vocabulary",   Icon:BookMarked,  color:"#0891b2", bg:"#e0f2fe"   },
                    { id:"coach",      label:"Learn & Coach",Icon:Sparkles,    color:AD.blue,   bg:AD.blueLt   },
                  ].map(({ id, label, Icon, color, bg }) => {
                    const sel = tType === id;
                    return (
                      <button key={id} type="button" onClick={() => setTType(id)} style={{
                        display:"flex",flexDirection:"column",alignItems:"center",gap:6,
                        padding:"10px 8px",borderRadius:12,
                        border:`2px solid ${sel ? color : AD.border}`,
                        background: sel ? bg : AD.surface,
                        cursor:"pointer",transition:"all .15s",
                      }}>
                        <div style={{ width:30,height:30,borderRadius:8,background: sel ? color : AD.bg,
                          display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s" }}>
                          <Icon size={14} color={sel ? "#fff" : AD.muted}/>
                        </div>
                        <span style={{ fontSize:11,fontWeight:700,color: sel ? color : AD.sub,
                          textAlign:"center",lineHeight:1.2 }}>{label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Assign to: group or single student */}
                <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
                  textTransform:"uppercase",letterSpacing:".06em",marginBottom:8 }}>Assign to</label>
                <div style={{ display:"flex",gap:8,marginBottom:12 }}>
                  {[["group","Whole Group",Users],["student","Single Student",User]].map(([id,label,Icon]) => {
                    const sel = tTarget === id;
                    return (
                      <button key={id} type="button" onClick={() => setTTarget(id)} style={{
                        display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,
                        border:`1.5px solid ${sel ? AD.blue : AD.border}`,
                        background: sel ? AD.blueLt : "transparent",
                        color: sel ? AD.blue : AD.sub,
                        fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .15s",
                      }}>
                        <Icon size={13}/>{label}
                      </button>
                    );
                  })}
                </div>
                {tTarget === "student" && (
                  <div style={{ marginBottom:12 }}>
                    <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
                      textTransform:"uppercase",letterSpacing:".06em",marginBottom:5 }}>Student *</label>
                    <CardSelect
                      value={tStudentId}
                      onChange={setTStudentId}
                      placeholder="— select student —"
                      options={groupStudents.map(s => ({ value:s.student_id, label:s.display_name || s.student_id }))}
                    />
                  </div>
                )}

                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
                  <div>
                    <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
                      textTransform:"uppercase",letterSpacing:".06em",marginBottom:5 }}>Task title *</label>
                    <input value={tTitle} onChange={e=>setTTitle(e.target.value)}
                      placeholder="e.g. Write a Task 2 essay" style={inputStyle}/>
                  </div>
                  <div>
                    <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
                      textTransform:"uppercase",letterSpacing:".06em",marginBottom:5 }}>Due date</label>
                    <input type="date" value={tDue} onChange={e=>setTDue(e.target.value)} style={inputStyle}/>
                  </div>
                </div>
                <textarea value={tDesc} onChange={e=>setTDesc(e.target.value)}
                  placeholder="Instructions for students (optional)"
                  rows={2} style={{ ...inputStyle,resize:"vertical",marginBottom:12 }}/>
                <button type="submit" disabled={tSaving||!tTitle.trim()||(tTarget==="student"&&!tStudentId)} style={{
                  padding:"9px 20px",borderRadius:9,border:"none",cursor:"pointer",
                  background:AD.blue,color:"#fff",fontSize:13,fontWeight:700,
                  display:"flex",alignItems:"center",gap:6,
                  opacity:(tTitle.trim()&&(tTarget==="group"||tStudentId))?1:.5,
                }}>
                  <Plus size={14}/>{tSaving ? "Assigning…" : "Assign task"}
                </button>
              </form>

              <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
                <h3 style={{ fontSize:14,fontWeight:800,color:AD.text,margin:"0 0 14px",letterSpacing:"-0.02em" }}>
                  Tasks ({tasks.length})
                </h3>
                {tasks.length === 0
                  ? <EmptyState icon={ClipboardList} text="No tasks assigned yet."/>
                  : <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                      {tasks.map(t => {
                        const typeMap = {
                          reading:{ Icon:BookOpen,color:AD.blue,bg:AD.blueLt,label:"Reading" },
                          listening:{ Icon:Headphones,color:AD.purple,bg:AD.purpleLt,label:"Listening" },
                          writing:{ Icon:PenLine,color:AD.green,bg:AD.greenLt,label:"Writing" },
                          speaking:{ Icon:Mic,color:AD.amber,bg:AD.amberLt,label:"Speaking" },
                          vocabulary:{ Icon:BookMarked,color:"#0891b2",bg:"#e0f2fe",label:"Vocabulary" },
                          coach:{ Icon:Sparkles,color:AD.blue,bg:AD.blueLt,label:"Learn & Coach" },
                        };
                        const tt = typeMap[t.task_type] || typeMap.reading;
                        return (
                          <div key={t.id} style={{ display:"flex",alignItems:"flex-start",gap:12,
                            padding:"12px 14px",background:AD.bg,borderRadius:11,border:`1px solid ${AD.border}` }}>
                            <div style={{ width:30,height:30,borderRadius:8,flexShrink:0,background:tt.bg,
                              display:"flex",alignItems:"center",justifyContent:"center" }}>
                              <tt.Icon size={14} color={tt.color}/>
                            </div>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:2 }}>
                                <div style={{ fontSize:13,fontWeight:700,color:AD.text }}>{t.title}</div>
                                <span style={{ fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:5,
                                  background:tt.bg,color:tt.color,flexShrink:0 }}>{tt.label}</span>
                              </div>
                              {t.description && <div style={{ fontSize:11,color:AD.sub,lineHeight:1.5 }}>{t.description}</div>}
                              {t.due_date && <div style={{ fontSize:10,color:AD.muted,marginTop:3 }}>Due {fmtDate(t.due_date)}</div>}
                            </div>
                            <button type="button" onClick={() => removeTask(t.id)} style={{
                              background:"none",border:"none",cursor:"pointer",color:AD.muted,
                              display:"flex",padding:4,flexShrink:0,
                            }}><Trash2 size={14}/></button>
                          </div>
                        );
                      })}
                    </div>
                }
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── PROGRESS TAB ──────────────────────────────────────────────────────────────
function ProgressTab({ groups, allStudents }) {
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.id || null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedGroup) return;
    setLoading(true);
    getGroupStudents(selectedGroup).then(rows => {
      const enriched = rows.map(r => ({
        ...r, _student: allStudents.find(s => s.student_id === r.student_id) || null,
      }));
      setStudents(enriched);
      setLoading(false);
    }).catch(() => { setStudents([]); setLoading(false); });
  }, [selectedGroup, allStudents]);

  const skills = ["listening","reading","writing","speaking"];

  if (!groups.length) return (
    <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,padding:20 }}>
      <EmptyState icon={BarChart2} text="No groups assigned yet."/>
    </div>
  );

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
      <div>
        <label style={{ display:"block",fontSize:11,fontWeight:700,color:AD.sub,
          letterSpacing:".06em",textTransform:"uppercase",marginBottom:7 }}>Group</label>
        <select value={selectedGroup||""} onChange={e => setSelectedGroup(e.target.value)} style={{
          padding:"10px 14px",borderRadius:10,border:`1.5px solid ${AD.border}`,
          background:AD.surface,fontSize:13,color:AD.text,fontFamily:"inherit",cursor:"pointer",
        }}>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      <div style={{ background:AD.surface,borderRadius:16,border:`1px solid ${AD.border}`,
        overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
        {/* table header */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr repeat(5,80px)",
          padding:"12px 20px",borderBottom:`1px solid ${AD.border}`,background:AD.bg }}>
          <div style={{ fontSize:11,fontWeight:700,color:AD.muted,textTransform:"uppercase",letterSpacing:".05em" }}>Student</div>
          {["Overall","L","R","W","S"].map(h => (
            <div key={h} style={{ fontSize:11,fontWeight:700,color:AD.muted,
              textTransform:"uppercase",letterSpacing:".05em",textAlign:"center" }}>{h}</div>
          ))}
        </div>

        {loading ? <Spinner/>
          : students.length === 0
          ? <EmptyState icon={Users} text="No students in this group."/>
          : students.map((row, i) => {
              const s = row._student;
              const name = s?.full_name || row.student_id;
              // get latest result from studentDb attempts — not available here, show placeholders
              const band = s?.latest_band || null;
              return (
                <div key={row.student_id} style={{ display:"grid",gridTemplateColumns:"1fr repeat(5,80px)",
                  padding:"14px 20px",borderBottom: i < students.length-1 ? `1px solid ${AD.border}` : "none",
                  background: i % 2 === 0 ? "transparent" : AD.bg+"88" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                    <div style={{ width:28,height:28,borderRadius:7,flexShrink:0,
                      background:AD.blueLt,display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:10,fontWeight:800,color:AD.blue }}>{initials(name)}</div>
                    <div>
                      <div style={{ fontSize:13,fontWeight:700,color:AD.text }}>{name}</div>
                      <div style={{ fontSize:10,color:AD.muted }}>{s?.email||""}</div>
                    </div>
                  </div>
                  {[band, null, null, null, null].map((v, j) => (
                    <div key={j} style={{ display:"flex",alignItems:"center",justifyContent:"center" }}>
                      {v
                        ? <span style={{ fontSize:13,fontWeight:800,color:bandColor(v),
                            background:bandBg(v),borderRadius:6,padding:"2px 8px" }}>{v}</span>
                        : <span style={{ fontSize:12,color:AD.border }}>—</span>
                      }
                    </div>
                  ))}
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ── PROFILE TAB ───────────────────────────────────────────────────────────────
function TeacherProfileTab({ teacher, groups }) {
  const ini = initials(teacher?.displayName);

  const [curPw,    setCurPw]   = useState("");
  const [newPw,    setNewPw]   = useState("");
  const [confPw,   setConfPw]  = useState("");
  const [showCur,  setShowCur] = useState(false);
  const [showNew,  setShowNew] = useState(false);
  const [pwSaving, setPwSaving]= useState(false);
  const [pwMsg,    setPwMsg]   = useState(null);

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (!curPw||!newPw||!confPw){ setPwMsg({type:"err",text:"Fill in all fields."}); return; }
    if (newPw.length < 6)       { setPwMsg({type:"err",text:"New password must be at least 6 characters."}); return; }
    if (newPw !== confPw)       { setPwMsg({type:"err",text:"New passwords don't match."}); return; }
    setPwSaving(true);
    try {
      const curHash = await hashPassword(curPw);
      const db = await loadDB();
      const staff = db?.adminUsers || [];
      const me = staff.find(u => u.id === teacher.id);
      if (!me || me.passwordHash !== curHash) {
        setPwMsg({type:"err",text:"Current password is incorrect."}); return;
      }
      const newHash = await hashPassword(newPw);
      const updated = staff.map(u => u.id === teacher.id ? { ...u, passwordHash: newHash } : u);
      saveDB({ ...db, adminUsers: updated });
      setPwMsg({type:"ok",text:"Password updated successfully."});
      setCurPw(""); setNewPw(""); setConfPw("");
    } catch(err) {
      setPwMsg({type:"err",text:err?.message||"Something went wrong."});
    } finally { setPwSaving(false); }
  }

  const inputStyle = {
    width:"100%", boxSizing:"border-box", padding:"10px 14px", borderRadius:10,
    border:`1.5px solid ${AD.border}`, fontSize:13, color:AD.text,
    background:AD.surface, fontFamily:"inherit", outline:"none", transition:"border-color .15s",
  };
  const labelStyle = {
    display:"block", fontSize:11, fontWeight:700, color:AD.sub,
    textTransform:"uppercase", letterSpacing:".06em", marginBottom:6,
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:680 }}>

      {/* identity card */}
      <div style={{ background:AD.surface, borderRadius:18, border:`1px solid ${AD.border}`,
        padding:"28px 28px", display:"flex", alignItems:"center", gap:22, flexWrap:"wrap",
        boxShadow:"0 2px 12px rgba(0,0,0,.05)" }}>
        <div style={{ width:72, height:72, borderRadius:20, flexShrink:0,
          background:`linear-gradient(135deg,${AD.blue},${AD.blueDk})`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:26, fontWeight:900, color:"#fff", letterSpacing:"-0.02em",
          boxShadow:`0 6px 20px ${AD.blue}44` }}>{ini}</div>
        <div style={{ flex:1, minWidth:160 }}>
          <div style={{ fontSize:20, fontWeight:900, color:AD.text, letterSpacing:"-0.04em" }}>
            {teacher?.displayName}
          </div>
          <div style={{ fontSize:13, color:AD.sub, marginTop:4, fontWeight:600 }}>
            @{teacher?.username}
          </div>
          <div style={{ marginTop:10 }}>
            <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:6,
              background:AD.blueLt, color:AD.blue }}>Teacher</span>
          </div>
        </div>
        <div style={{ textAlign:"center", flexShrink:0 }}>
          <div style={{ fontSize:28, fontWeight:900, color:AD.text, letterSpacing:"-0.04em",
            background:AD.bg, borderRadius:14, padding:"8px 20px", lineHeight:1 }}>
            {groups.length}
          </div>
          <div style={{ fontSize:10, color:AD.muted, marginTop:6, fontWeight:700,
            textTransform:"uppercase", letterSpacing:".06em" }}>Groups</div>
        </div>
      </div>

      {/* account info */}
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
            { label:"Display name", value: teacher?.displayName },
            { label:"Username",     value: teacher?.username },
            { label:"Role",         value: "Teacher" },
            { label:"Groups",       value: groups.length > 0 ? groups.map(g=>g.name).join(", ") : "—" },
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
          To update your display name or username, contact an admin.
        </p>
      </div>

      {/* change password */}
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
            background: pwMsg.type==="ok" ? AD.greenLt : AD.redLt,
            border:`1px solid ${pwMsg.type==="ok" ? AD.green+"33" : AD.red+"33"}` }}>
            <ShieldCheck size={14} color={pwMsg.type==="ok" ? AD.green : AD.red}/>
            <span style={{ fontSize:13, fontWeight:600,
              color: pwMsg.type==="ok" ? AD.green : AD.red }}>{pwMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={labelStyle}>Current password</label>
            <div style={{ position:"relative" }}>
              <input type={showCur?"text":"password"} value={curPw} onChange={e=>setCurPw(e.target.value)}
                style={{ ...inputStyle, paddingRight:40 }}
                onFocus={e=>e.target.style.borderColor=AD.blue}
                onBlur={e=>e.target.style.borderColor=AD.border}/>
              <button type="button" onClick={()=>setShowCur(v=>!v)} style={{
                position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                background:"none",border:"none",cursor:"pointer",color:AD.muted,display:"flex",padding:2,
              }}>{showCur?<EyeOff size={15}/>:<Eye size={15}/>}</button>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div>
              <label style={labelStyle}>New password</label>
              <div style={{ position:"relative" }}>
                <input type={showNew?"text":"password"} value={newPw} onChange={e=>setNewPw(e.target.value)}
                  placeholder="Min 6 characters"
                  style={{ ...inputStyle, paddingRight:40 }}
                  onFocus={e=>e.target.style.borderColor=AD.blue}
                  onBlur={e=>e.target.style.borderColor=AD.border}/>
                <button type="button" onClick={()=>setShowNew(v=>!v)} style={{
                  position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                  background:"none",border:"none",cursor:"pointer",color:AD.muted,display:"flex",padding:2,
                }}>{showNew?<EyeOff size={15}/>:<Eye size={15}/>}</button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Confirm new password</label>
              <input type="password" value={confPw} onChange={e=>setConfPw(e.target.value)}
                style={{ ...inputStyle, borderColor: confPw&&confPw!==newPw ? AD.red : AD.border }}
                onFocus={e=>e.target.style.borderColor=AD.blue}
                onBlur={e=>e.target.style.borderColor=confPw&&confPw!==newPw?AD.red:AD.border}/>
            </div>
          </div>
          {newPw.length > 0 && (
            <div>
              <div style={{ display:"flex", gap:4, marginBottom:4 }}>
                {[6,8,10,12].map((n,i) => (
                  <div key={i} style={{ flex:1, height:3, borderRadius:2,
                    background: newPw.length>=n ? [AD.red,AD.amber,AD.blue,AD.green][i] : AD.border }}/>
                ))}
              </div>
              <div style={{ fontSize:11, color:AD.muted }}>
                {newPw.length<6?"Too short":newPw.length<8?"Weak":newPw.length<10?"Fair":newPw.length<12?"Strong":"Very strong"}
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
export default function TeacherDashboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groups, setGroups] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const teacher = getTeacherSession();

  useEffect(() => {
    if (!isTeacherLoggedIn()) { navigate("/login", { replace:true }); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [grps, studs] = await Promise.allSettled([getGroups(), getAllStudents()]);
      let resolvedGroups   = grps.status  === "fulfilled" ? grps.value  : [];
      let resolvedStudents = studs.status === "fulfilled" ? studs.value : [];

      // Fake-data fallback for local dev (Supabase CORS-blocked)
      if (!resolvedGroups.length) {
        try {
          const ft = JSON.parse(localStorage.getItem("lv_fake_teacher") || "{}");
          if (ft.groups?.length) resolvedGroups = ft.groups;
        } catch {}
      }
      // Always merge local test students so teacher can see them alongside real students
      try {
        const testStudents = JSON.parse(localStorage.getItem("lv_test_students") || "[]");
        if (testStudents.length) {
          const existingIds = new Set(resolvedStudents.map(s => s.student_id));
          resolvedStudents = [...resolvedStudents, ...testStudents.filter(s => !existingIds.has(s.student_id))];
        }
      } catch {}

      setGroups(resolvedGroups);
      setAllStudents(resolvedStudents);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  function openGroup(id) {
    setSelectedGroupId(id);
    setTab("groups");
  }

  function handleLogout() {
    clearTeacherSession();
    navigate("/");
  }

  return (
    <div style={{ display:"flex",minHeight:"100vh",background:AD.bg,
      fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <style>{`@keyframes lms-spin{to{transform:rotate(360deg)}}`}</style>

      <Sidebar tab={tab} setTab={setTab} teacher={teacher} onLogout={handleLogout}/>

      <main style={{ flex:1,padding:"28px 28px 40px",overflowY:"auto",minWidth:0 }}>
        {tab === "overview" ? (
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:13,fontWeight:600,color:AD.muted,marginBottom:4 }}>
              {new Date().toLocaleDateString("en-GB",{ weekday:"long", day:"numeric", month:"long" })}
            </div>
            <h1 style={{ fontSize:32,fontWeight:900,color:AD.text,letterSpacing:"-0.05em",margin:0,lineHeight:1.1 }}>
              Hey, {teacher?.displayName?.split(" ")[0] || "Teacher"} 👋
            </h1>
            <p style={{ fontSize:14,color:AD.sub,margin:"6px 0 0",fontWeight:500 }}>
              Here's what's on your schedule
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
            {tab === "overview"   && <OverviewTab groups={groups} allStudents={allStudents} setTab={setTab} openGroup={openGroup}/>}
            {tab === "calendar"   && <CalendarTab groups={groups} openGroup={openGroup}/>}
            {tab === "groups"     && <GroupsTab groups={groups} allStudents={allStudents} initialGroupId={selectedGroupId}/>}
            {tab === "attendance" && <AttendanceTab groups={groups}/>}
            {tab === "content"    && <ContentTab groups={groups} teacher={teacher}/>}
            {tab === "progress"   && <ProgressTab groups={groups} allStudents={allStudents}/>}
            {tab === "profile"    && <TeacherProfileTab teacher={teacher} groups={groups}/>}
          </>
        )}
      </main>
    </div>
  );
}
