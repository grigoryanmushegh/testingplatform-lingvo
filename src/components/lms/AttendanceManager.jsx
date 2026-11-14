import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, Check, X, Clock, AlertCircle,
  Save, Loader, Users, ChevronDown, Trash2, Edit2
} from "lucide-react";
import {
  getGroups, getSessions, createSession, updateSession, deleteSession,
  getGroupStudents, getAttendance, markAttendance, getStudentAttendanceSummary,
} from "../../lib/lmsDb.js";
import { getAllStudents } from "../../lib/studentDb.js";

const STATUS_CONFIG = {
  present:  { label:"Present",  color:"#10B981",  bg:"#D1FAE5", icon:Check },
  absent:   { label:"Absent",   color:"#EF4444",    bg:"#FEE2E2", icon:X },
  late:     { label:"Late",     color:"#F59E0B",  bg:"#FEF3C7", icon:Clock },
  excused:  { label:"Excused",  color:"#2D5DDC",   bg:"#EBF0FF",  icon:AlertCircle },
};

function card(extra={}) {
  return { background:"#FCFCFC", borderRadius:12, border:`1px solid ${"#E2E6EA"}`, ...extra };
}
function btn(v="primary", extra={}) {
  const base = { display:"inline-flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, fontWeight:600, fontSize:13, cursor:"pointer", border:"none" };
  if (v==="primary") return { ...base, background:"#2D5DDC", color:"#fff", ...extra };
  if (v==="ghost")   return { ...base, background:"transparent", color:"#151313", border:`1px solid ${"#E2E6EA"}`, ...extra };
  if (v==="danger")  return { ...base, background:"#FEE2E2", color:"#EF4444", border:`1px solid ${"#EF4444"}30`, ...extra };
  return { ...base, ...extra };
}

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Main export ───────────────────────────────────────────────────────────────
export default function AttendanceManager() {
  const [groups, setGroups]         = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [sessions, setSessions]     = useState([]);
  const [students, setStudents]     = useState([]);
  const [groupStudents, setGroupStudents] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState("calendar"); // calendar | session

  // calendar state
  const now = new Date();
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  // session view state
  const [activeSession, setActiveSession] = useState(null);
  const [attendance, setAttendance]       = useState({});
  const [savingIds, setSavingIds]         = useState(new Set());

  // modal
  const [sessionModal, setSessionModal] = useState(null);

  // load groups on mount
  useEffect(() => {
    getGroups().then(g => {
      setGroups(g.filter(x => x.status === "active"));
      if (g.length) setSelectedGroup(g[0]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // load sessions + students when group changes
  useEffect(() => {
    if (!selectedGroup) return;
    Promise.all([
      getSessions(selectedGroup.id),
      getGroupStudents(selectedGroup.id),
      getAllStudents(),
    ]).then(([sess, gs, allS]) => {
      setSessions(sess);
      setGroupStudents(gs);
      const sMap = Object.fromEntries((allS||[]).map(s=>[s.student_id, s]));
      setStudents(gs.map(g => sMap[g.student_id]).filter(Boolean));
    });
  }, [selectedGroup]);

  const refreshSessions = useCallback(async () => {
    if (!selectedGroup) return;
    const s = await getSessions(selectedGroup.id);
    setSessions(s);
  }, [selectedGroup]);

  const openSession = async (session) => {
    setActiveSession(session);
    setView("session");
    const records = await getAttendance(session.id);
    const map = {};
    records.forEach(r => { map[r.student_id] = r.status; });
    // default everyone not yet marked to "present"
    students.forEach(s => { if (!map[s.student_id]) map[s.student_id] = "present"; });
    setAttendance(map);
  };

  const markOne = async (studentId, status) => {
    setSavingIds(s => new Set([...s, studentId]));
    setAttendance(a => ({...a, [studentId]: status}));
    try {
      await markAttendance(activeSession.id, studentId, status);
    } catch(e) {
      console.error(e);
    } finally {
      setSavingIds(s => { const n=new Set(s); n.delete(studentId); return n; });
    }
  };

  const markAll = async (status) => {
    const ids = students.map(s => s.student_id);
    ids.forEach(id => setSavingIds(s => new Set([...s, id])));
    const newMap = {};
    ids.forEach(id => { newMap[id] = status; });
    setAttendance(a => ({...a, ...newMap}));
    try {
      await Promise.all(ids.map(id => markAttendance(activeSession.id, id, status)));
    } finally {
      setSavingIds(new Set());
    }
  };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:80}}>
      <Loader size={28} color={"#2D5DDC"} style={{animation:"spin 1s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{padding:"24px 0", fontFamily:"'Montserrat',sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          {view === "session" && activeSession ? (
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button style={btn("ghost",{padding:"6px 10px"})} onClick={()=>setView("calendar")}>
                <ChevronLeft size={15}/>
              </button>
              <div>
                <h2 style={{margin:0,fontSize:20,fontWeight:800,color:"#151313"}}>
                  {activeSession.title || formatDate(activeSession.date)}
                </h2>
                <p style={{margin:"2px 0 0",color:"#94A3B8",fontSize:12}}>
                  {selectedGroup?.name} · {activeSession.start_time ? `${activeSession.start_time}${activeSession.end_time?` – ${activeSession.end_time}`:""}` : formatDate(activeSession.date)}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h2 style={{margin:0,fontSize:22,fontWeight:800,color:"#151313"}}>Attendance</h2>
              <p style={{margin:"4px 0 0",color:"#94A3B8",fontSize:13}}>Schedule sessions, track student attendance</p>
            </div>
          )}
        </div>

        {view === "calendar" && (
          <button style={btn("primary")} onClick={()=>setSessionModal("new")}>
            <Plus size={15}/> New Session
          </button>
        )}
      </div>

      {/* Group selector */}
      {groups.length > 1 && (
        <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
          {groups.map(g => (
            <button
              key={g.id}
              style={{
                padding:"6px 14px",borderRadius:20,fontWeight:600,fontSize:12,
                cursor:"pointer",border:`2px solid ${selectedGroup?.id===g.id?(g.color||"#2D5DDC"):"#E2E6EA"}`,
                background:selectedGroup?.id===g.id?`${g.color||"#2D5DDC"}15`:"transparent",
                color:selectedGroup?.id===g.id?(g.color||"#2D5DDC"):"#64748B",
              }}
              onClick={()=>setSelectedGroup(g)}
            >{g.name}</button>
          ))}
        </div>
      )}

      {groups.length === 0 && (
        <div style={{...card({padding:48,textAlign:"center"})}}>
          <CalendarDays size={40} color={"#94A3B8"} style={{marginBottom:12}}/>
          <div style={{color:"#94A3B8",fontSize:14}}>No active groups. Create groups first in the LMS Groups tab.</div>
        </div>
      )}

      {selectedGroup && view === "calendar" && (
        <CalendarView
          sessions={sessions}
          group={selectedGroup}
          year={calYear} month={calMonth}
          onPrev={()=>{ if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); }}
          onNext={()=>{ if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); }}
          onSessionClick={openSession}
          onEditSession={s=>setSessionModal(s)}
          onDeleteSession={async s=>{ if(!window.confirm(`Delete session "${s.title||formatDate(s.date)}"?`))return; await deleteSession(s.id); refreshSessions(); }}
          onQuickCreate={async (dateStr, slot) => {
            const newSess = await createSession({
              group_id: selectedGroup.id,
              date: dateStr,
              start_time: slot.start || null,
              end_time: slot.end || null,
              title: "Class",
            });
            await refreshSessions();
            if (newSess) openSession(newSess);
          }}
        />
      )}

      {view === "session" && activeSession && selectedGroup && (
        <SessionAttendance
          session={activeSession}
          students={students}
          attendance={attendance}
          savingIds={savingIds}
          onMark={markOne}
          onMarkAll={markAll}
        />
      )}

      {sessionModal !== null && selectedGroup && (
        <SessionModal
          session={sessionModal === "new" ? null : sessionModal}
          group={selectedGroup}
          onSave={async data => {
            if (sessionModal === "new") await createSession({ ...data, group_id: selectedGroup.id });
            else await updateSession(sessionModal.id, data);
            setSessionModal(null); refreshSessions();
          }}
          onClose={()=>setSessionModal(null)}
        />
      )}
    </div>
  );
}

// ── Calendar view ─────────────────────────────────────────────────────────────
function CalendarView({ sessions, group, year, month, onPrev, onNext, onSessionClick, onEditSession, onDeleteSession, onQuickCreate }) {
  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();

  // index sessions by date string "YYYY-MM-DD"
  const byDate = {};
  sessions.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  // Build set of scheduled weekdays from group.schedule [{day:0-6, start, end}]
  const scheduleByDay = {};
  (group.schedule || []).forEach(sl => { scheduleByDay[sl.day] = sl; });

  const todayStr = new Date().toISOString().split("T")[0];
  const cells    = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const accent = group.color || "#2D5DDC";

  return (
    <div style={card({padding:"20px 24px"})}>
      {/* Month nav */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <button style={btn("ghost",{padding:"6px 10px"})} onClick={onPrev}><ChevronLeft size={16}/></button>
        <span style={{fontWeight:800,fontSize:16,color:"#151313"}}>{MONTHS[month]} {year}</span>
        <button style={btn("ghost",{padding:"6px 10px"})} onClick={onNext}><ChevronRight size={16}/></button>
      </div>

      {/* Day labels */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:8}}>
        {DAYS.map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:"#94A3B8",padding:"4px 0"}}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`}/>;
          const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const daySessions = byDate[dateStr] || [];
          const isToday = dateStr === todayStr;
          const dow = new Date(year, month, day).getDay();
          const schedSlot = scheduleByDay[dow];
          const isScheduled = !!schedSlot && daySessions.length === 0;
          const hasSessions = daySessions.length > 0;

          const cellBg = hasSessions ? `${accent}10`
                       : isScheduled ? `${accent}08`
                       : isToday     ? `${accent}10`
                       : "#EEEFF1";
          const cellBorder = hasSessions ? `1px solid ${accent}50`
                           : isScheduled ? `1px dashed ${accent}60`
                           : isToday     ? `1px solid ${accent}`
                           : `1px solid #E2E6EA`;

          return (
            <div key={day}
              onClick={() => isScheduled && onQuickCreate && onQuickCreate(dateStr, schedSlot)}
              style={{
                minHeight:70, borderRadius:8, padding:"6px 6px 4px",
                border: cellBorder, background: cellBg,
                cursor: isScheduled ? "pointer" : "default",
                position:"relative",
              }}>
              <div style={{
                fontSize:12, fontWeight: (isToday||isScheduled||hasSessions) ? 700 : 500,
                color: (isToday||hasSessions) ? accent : isScheduled ? accent+"cc" : "#64748B",
                marginBottom:4,
              }}>{day}</div>

              {/* Scheduled but no session yet — show hint */}
              {isScheduled && (
                <div style={{
                  fontSize:10, fontWeight:600, padding:"2px 5px", borderRadius:4,
                  background:`${accent}18`, color: accent,
                  marginBottom:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                }}>
                  + {schedSlot.start?.slice(0,5)||"class"}
                </div>
              )}

              {daySessions.map(s => (
                <div key={s.id} style={{
                  fontSize:10,fontWeight:600,padding:"2px 5px",borderRadius:4,
                  background:`${accent}25`,color:accent,
                  marginBottom:2,cursor:"pointer",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
                }} onClick={e=>{e.stopPropagation();onSessionClick(s);}}>
                  {s.start_time ? s.start_time.slice(0,5) : "◉"} {s.title||"Class"}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Sessions list below calendar */}
      {sessions.length > 0 && (
        <div style={{marginTop:24}}>
          <div style={{fontSize:12,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>
            All Sessions
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {sessions.slice(0,20).map(s => (
              <div key={s.id} style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"10px 14px",borderRadius:8,background:"#EEEFF1",border:`1px solid ${"#E2E6EA"}`,
                flexWrap:"wrap",gap:8,
              }}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:group.color||"#2D5DDC"}}/>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:"#151313"}}>{s.title||"Class"}</div>
                    <div style={{fontSize:11,color:"#94A3B8"}}>
                      {formatDate(s.date)}{s.start_time?` · ${s.start_time.slice(0,5)}${s.end_time?`–${s.end_time.slice(0,5)}`:""}`:""}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button style={btn("primary",{fontSize:12,padding:"5px 10px"})} onClick={()=>onSessionClick(s)}>
                    <Users size={12}/> Attendance
                  </button>
                  <button style={btn("ghost",{fontSize:12,padding:"5px 10px"})} onClick={()=>onEditSession(s)}>
                    <Edit2 size={12}/>
                  </button>
                  <button style={btn("danger",{fontSize:12,padding:"5px 8px"})} onClick={()=>onDeleteSession(s)}>
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Session attendance view ───────────────────────────────────────────────────
function SessionAttendance({ session, students, attendance, savingIds, onMark, onMarkAll }) {
  const counts = { present:0, absent:0, late:0, excused:0 };
  Object.values(attendance).forEach(s => { if(counts[s]!==undefined) counts[s]++; });
  const total = students.length;
  const rate  = total ? Math.round(((counts.present+counts.late)/total)*100) : 0;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Summary row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10}}>
        {[
          {label:"Present", val:counts.present, color:"#10B981", bg:"#D1FAE5"},
          {label:"Absent",  val:counts.absent,  color:"#EF4444",   bg:"#FEE2E2"},
          {label:"Late",    val:counts.late,    color:"#F59E0B", bg:"#FEF3C7"},
          {label:"Excused", val:counts.excused, color:"#2D5DDC",  bg:"#EBF0FF"},
          {label:"Rate",    val:`${rate}%`,     color:"#2D5DDC", bg:"#D1FAE5"},
        ].map(({label,val,color,bg}) => (
          <div key={label} style={{...card({padding:"12px 14px"}),textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color}}>{val}</div>
            <div style={{fontSize:11,color:"#94A3B8",fontWeight:600}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Quick mark all */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <span style={{fontSize:12,color:"#94A3B8",alignSelf:"center"}}>Mark all:</span>
        {Object.entries(STATUS_CONFIG).map(([status,conf]) => (
          <button key={status}
            style={{padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:"none",
              background:conf.bg,color:conf.color}}
            onClick={()=>onMarkAll(status)}
          >{conf.label}</button>
        ))}
      </div>

      {/* Student list */}
      <div style={card({padding:0,overflow:"hidden"})}>
        {students.length === 0 && (
          <div style={{padding:40,textAlign:"center",color:"#94A3B8",fontSize:13}}>
            No students enrolled in this group yet.
          </div>
        )}
        {students.map((s, i) => {
          const status = attendance[s.student_id] || "present";
          const conf   = STATUS_CONFIG[status];
          const saving = savingIds.has(s.student_id);
          return (
            <div key={s.student_id} style={{
              display:"flex",alignItems:"center",justifyContent:"space-between",
              padding:"12px 16px",
              borderBottom: i < students.length-1 ? `1px solid ${"#E2E6EA"}` : "none",
              background: i%2===0 ? "#FCFCFC" : "#EEEFF1",
              flexWrap:"wrap",gap:8,
            }}>
              <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                <div style={{
                  width:34,height:34,borderRadius:"50%",
                  background:`${conf.color}20`,color:conf.color,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontWeight:700,fontSize:13,flexShrink:0,
                }}>
                  {(s.full_name||"?")[0].toUpperCase()}
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,color:"#151313"}}>{s.full_name}</div>
                  <div style={{fontSize:11,color:"#94A3B8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.email||s.username}</div>
                </div>
              </div>

              <div style={{display:"flex",gap:6,flexShrink:0}}>
                {saving && <Loader size={14} color={"#2D5DDC"} style={{animation:"spin 1s linear infinite",marginRight:4}}/>}
                {Object.entries(STATUS_CONFIG).map(([st, cf]) => {
                  const Icon = cf.icon;
                  const active = status === st;
                  return (
                    <button key={st}
                      style={{
                        width:32,height:32,borderRadius:8,border:"none",cursor:"pointer",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        background: active ? cf.bg : "#EEEFF1",
                        border: `1px solid ${active ? cf.color+"60" : "#E2E6EA"}`,
                        title: cf.label,
                        opacity: saving ? 0.5 : 1,
                      }}
                      title={cf.label}
                      onClick={()=>!saving&&onMark(s.student_id, st)}
                    >
                      <Icon size={14} color={active ? cf.color : "#94A3B8"}/>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Session modal ─────────────────────────────────────────────────────────────
function SessionModal({ session, group, onSave, onClose }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    title:      session?.title      || "",
    date:       session?.date       || today,
    start_time: session?.start_time || "09:00",
    end_time:   session?.end_time   || "10:30",
    notes:      session?.notes      || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const save = async () => {
    if (!form.date) { setErr("Date is required"); return; }
    setSaving(true); setErr("");
    try {
      await onSave(form);
    } catch(e) {
      setErr(e.message||"Failed to save"); setSaving(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#FCFCFC",borderRadius:16,padding:"24px 28px",width:"100%",maxWidth:420,boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <h3 style={{margin:"0 0 20px",fontSize:17,fontWeight:800,color:"#151313"}}>
          {session ? "Edit Session" : `New Session · ${group.name}`}
        </h3>

        <label style={lbl}>Title (optional)</label>
        <input style={inp} placeholder="e.g. Grammar, Speaking Practice…"
          value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>

        <label style={lbl}>Date *</label>
        <input style={inp} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <label style={lbl}>Start Time</label>
            <input style={inp} type="time" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))}/>
          </div>
          <div>
            <label style={lbl}>End Time</label>
            <input style={inp} type="time" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))}/>
          </div>
        </div>

        <label style={lbl}>Notes</label>
        <textarea style={{...inp,height:60,resize:"vertical"}} placeholder="Optional notes…"
          value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>

        {err && <div style={{color:"#EF4444",fontSize:12,marginBottom:10}}>{err}</div>}

        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
          <button style={btn("ghost")} onClick={onClose}>Cancel</button>
          <button style={btn("primary")} onClick={save} disabled={saving}>
            {saving ? <Loader size={14} style={{animation:"spin 1s linear infinite"}}/> : <Save size={14}/>}
            {saving ? "Saving…" : "Save Session"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y,m,d] = dateStr.split("-");
  return `${d} ${MONTHS[+m-1]} ${y}`;
}

const lbl = { display:"block",fontSize:12,fontWeight:700,color:"#151313",marginBottom:4,marginTop:12 };
const inp = {
  display:"block",width:"100%",boxSizing:"border-box",
  padding:"9px 12px",borderRadius:8,border:`1px solid ${"#E2E6EA"}`,
  fontSize:13,color:"#151313",background:"#EEEFF1",outline:"none",fontFamily:"inherit",
};
