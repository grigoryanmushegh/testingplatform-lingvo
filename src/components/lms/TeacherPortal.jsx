import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays, Users, BookOpen, ClipboardList, LogOut,
  ChevronRight, ChevronLeft, Clock, CheckCircle2, XCircle,
  AlertCircle, GraduationCap, Layers, FileText, Menu, X
} from "lucide-react";
import {
  getGroups, getGroupStudents, getSessions, getAttendance,
  markAttendance, getMaterials, createMaterial, deleteMaterial,
  getTasks, createTask,
} from "../../lib/lmsDb.js";
import { getAllStudents } from "../../lib/studentDb.js";
import {
  mockGetGroups, mockGetGroupStudents, mockGetSessions, mockGetAttendance,
  mockMarkAttendance, mockGetMaterials, mockCreateMaterial, mockDeleteMaterial,
  mockGetTasks, mockCreateTask, mockGetAllStudents,
} from "../../lib/lmsDevMock.js";

// When Supabase LMS tables don't exist yet, fall back to in-memory mock data
const IS_DEV = import.meta.env.DEV;
async function tryOrMock(realFn, mockFn, ...args) {
  if (!IS_DEV) return realFn(...args);
  try {
    const result = await realFn(...args);
    // If result is an empty array, it might mean table missing — fall back
    return result;
  } catch {
    return mockFn(...args);
  }
}

const DAY_NAMES  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_FULL   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_S    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(ds) {
  const d = new Date(ds);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_S[d.getMonth()]}`;
}
function upcomingFromSchedule(group, daysAhead = 7) {
  const schedule = group.schedule || [];
  if (!schedule.length) return [];
  const out = [];
  const now = new Date(); now.setHours(0,0,0,0);
  for (let d = 0; d <= daysAhead; d++) {
    const date = new Date(now); date.setDate(date.getDate() + d);
    const slot = schedule.find(s => s.day === date.getDay());
    if (slot) out.push({ group, date: date.toISOString().split("T")[0], start: slot.start, end: slot.end, diff: d });
  }
  return out;
}

const card = (e={}) => ({ background: "#FCFCFC", borderRadius: 8, border: `1px solid ${"#E2E6EA"}`, ...e });
const pill = (color, bg) => ({
  display:"inline-flex", alignItems:"center", gap:4,
  fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20,
  background:bg, color,
});

// ── Attendance status cfg ───────────────────────────────────────────────────
const ATT = {
  present: { label:"Present", color:"#10B981",  bg:"#D1FAE5"  },
  late:    { label:"Late",    color:"#F59E0B",  bg:"#FEF3C7"  },
  absent:  { label:"Absent",  color:"#EF4444",    bg:"#FEE2E2"    },
  excused: { label:"Excused", color:"#8B5CF6", bg:"#EDE9FE" },
};

// ── Teacher Home ─────────────────────────────────────────────────────────────
function TeacherHome({ groups, students, onSelectGroup }) {
  const upcoming = groups
    .flatMap(g => upcomingFromSchedule(g, 7))
    .sort((a,b) => a.date===b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date));
  const today = upcoming.filter(u => u.diff === 0);
  const later = upcoming.filter(u => u.diff > 0);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
      {/* Upcoming */}
      <div>
        <div style={{ fontWeight:800, fontSize:16, color:"#151313", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
          <CalendarDays size={16} color={"#64748B"}/> This Week's Classes
        </div>
        {upcoming.length === 0
          ? <div style={card({ padding:40, textAlign:"center" })}>
              <CalendarDays size={32} color={"#E2E6EA"} style={{ marginBottom:8 }}/>
              <div style={{ fontSize:13, color:"#94A3B8" }}>No classes this week.<br/>Add a schedule to your groups.</div>
            </div>
          : upcoming.slice(0,6).map((u,i) => {
              const isToday = u.diff === 0;
              return (
                <div key={i} style={{ ...card({ padding:"14px 16px", marginBottom:10,
                  borderLeft:`3px solid ${u.group.color||"#2D5DDC"}` }) }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:u.group.color||"#2D5DDC", textTransform:"uppercase", letterSpacing:".04em" }}>
                      {isToday ? "Today" : u.diff===1 ? "Tomorrow" : DAY_FULL[new Date(u.date).getDay()]}
                    </span>
                    {isToday && <span style={pill("#2D5DDC", "#EBF0FF")}>Upcoming</span>}
                  </div>
                  <div style={{ fontWeight:700, fontSize:14, color:"#151313", marginBottom:5 }}>{u.group.name}</div>
                  <span style={{ ...pill("#64748B", "#EEEFF1"), gap:5 }}>
                    <Clock size={10}/>{u.start.slice(0,5)} – {u.end.slice(0,5)}
                  </span>
                </div>
              );
            })
        }
      </div>

      {/* My Groups quick list */}
      <div>
        <div style={{ fontWeight:800, fontSize:16, color:"#151313", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
          <Layers size={16} color={"#64748B"}/> My Groups
        </div>
        {groups.length === 0
          ? <div style={card({ padding:40, textAlign:"center" })}>
              <div style={{ fontSize:13, color:"#94A3B8" }}>No groups assigned yet.</div>
            </div>
          : groups.map(g => {
              const days = (g.schedule||[]).map(s => DAY_NAMES[s.day]).join(" · ");
              return (
                <div key={g.id} onClick={() => onSelectGroup?.(g)} style={{ ...card({ padding:"14px 16px", marginBottom:8,
                  borderLeft:`3px solid ${g.color||"#2D5DDC"}`, cursor:"pointer" }) }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:"#151313" }}>{g.name}</div>
                      <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>
                        {g.level && <span style={{ marginRight:6 }}>{g.level}</span>}
                        {days && <span>{days}</span>}
                      </div>
                    </div>
                    <ChevronRight size={14} color={g.color||"#2D5DDC"}/>
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ── Attendance Tab (inside group) ────────────────────────────────────────────
function GroupAttendance({ group, groupStudents, students }) {
  const sMap = Object.fromEntries(students.map(s => [s.student_id, s]));
  const [sessions, setSessions] = useState([]);
  const [selSession, setSelSession] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSessions  = useCallback(() => tryOrMock(
    () => getSessions(group.id),
    () => mockGetSessions(group.id),
  ), [group.id]);
  const loadAttendance = useCallback((sessId) => tryOrMock(
    () => getAttendance(sessId),
    () => mockGetAttendance(sessId),
  ), []);
  const doMark = useCallback((sessId, studentId, status) => tryOrMock(
    () => markAttendance(sessId, studentId, status),
    () => mockMarkAttendance(sessId, studentId, status),
  ), []);

  useEffect(() => {
    loadSessions().then(s => {
      setSessions(s);
      if (s.length > 0) setSelSession(s[0]);
    }).finally(() => setLoading(false));
  }, [group.id]);

  useEffect(() => {
    if (!selSession) return;
    loadAttendance(selSession.id).then(setAttendance);
  }, [selSession]);

  const getStatus = (studentId) => attendance.find(a => a.student_id===studentId)?.status || null;

  const mark = async (studentId, status) => {
    await doMark(selSession.id, studentId, status);
    loadAttendance(selSession.id).then(setAttendance);
  };

  if (loading) return <div style={{ padding:40, textAlign:"center", color:"#94A3B8" }}>Loading...</div>;
  if (sessions.length === 0) return (
    <div style={{ padding:40, textAlign:"center", color:"#94A3B8" }}>
      <ClipboardList size={28} color={"#E2E6EA"} style={{ marginBottom:8 }}/>
      <div>No sessions recorded yet.</div>
    </div>
  );

  return (
    <div>
      {/* Session selector */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
        {sessions.slice(0,8).map(s => (
          <button key={s.id} onClick={() => setSelSession(s)} style={{
            padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer",
            background: selSession?.id===s.id ? "#2D5DDC" : "#EEEFF1",
            color: selSession?.id===s.id ? "#fff" : "#151313",
            border: `1px solid ${selSession?.id===s.id ? "#2D5DDC" : "#E2E6EA"}`,
          }}>{fmtDate(s.date)}{s.title ? ` — ${s.title}` : ""}</button>
        ))}
      </div>

      {/* Student list */}
      {groupStudents.length === 0
        ? <div style={{ padding:32, textAlign:"center", color:"#94A3B8" }}>No students enrolled.</div>
        : <div style={card({ padding:0, overflow:"hidden" })}>
            {groupStudents.map((gs, i) => {
              const st = sMap[gs.student_id];
              const status = getStatus(gs.student_id);
              const cfg = status ? ATT[status] : null;
              return (
                <div key={gs.student_id} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"12px 16px",
                  borderBottom: i < groupStudents.length-1 ? `1px solid ${"#E2E6EA"}` : "none",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{
                      width:36, height:36, borderRadius:10,
                      background: group.color ? `${group.color}20` : "#EBF0FF",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontWeight:800, fontSize:13, color: group.color||"#2D5DDC",
                    }}>{(st?.full_name||gs.student_id)[0].toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13, color:"#151313" }}>{st?.full_name||gs.student_id}</div>
                      {st?.email && <div style={{ fontSize:11, color:"#94A3B8" }}>{st.email}</div>}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    {Object.entries(ATT).map(([key,val]) => (
                      <button key={key} onClick={() => mark(gs.student_id, key)} style={{
                        padding:"4px 10px", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer",
                        background: status===key ? val.bg : "#EEEFF1",
                        color: status===key ? val.color : "#94A3B8",
                        border: `1px solid ${status===key ? val.color+"40" : "#E2E6EA"}`,
                        transition:"all .15s",
                      }}>{val.label}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// ── Materials Tab ────────────────────────────────────────────────────────────
function GroupMaterials({ group }) {
  const [materials, setMaterials] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title:"", type:"text", content:"" });

  const loadMats = useCallback(() => tryOrMock(
    () => getMaterials(group.id), () => mockGetMaterials(group.id),
  ), [group.id]);

  useEffect(() => { loadMats().then(setMaterials); }, [group.id]);

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    await tryOrMock(
      () => createMaterial({ group_id:group.id, ...form }),
      () => mockCreateMaterial({ group_id:group.id, ...form }),
    );
    loadMats().then(setMaterials);
    setForm({ title:"", type:"text", content:"" }); setAdding(false);
  };
  const del = async (id) => {
    await tryOrMock(() => deleteMaterial(id), () => mockDeleteMaterial(id));
    loadMats().then(setMaterials);
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ fontWeight:700, fontSize:14, color:"#151313" }}>Materials</span>
        <button onClick={() => setAdding(true)} style={{
          padding:"6px 14px", borderRadius:8, background:"#2D5DDC", color:"#fff",
          fontSize:12, fontWeight:700, border:"none", cursor:"pointer",
        }}>+ Add</button>
      </div>

      {adding && (
        <div style={card({ padding:16, marginBottom:14 })}>
          <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{
            width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${"#E2E6EA"}`,
            marginBottom:8, fontSize:13, color:"#151313",
          }}>
            <option value="text">Text Note</option>
            <option value="link">Link</option>
          </select>
          <input placeholder="Title" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{
            width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${"#E2E6EA"}`,
            fontSize:13, marginBottom:8, color:"#151313", boxSizing:"border-box",
          }}/>
          <textarea placeholder={form.type==="link"?"https://...":"Notes..."} value={form.content}
            onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={3} style={{
              width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${"#E2E6EA"}`,
              fontSize:13, resize:"vertical", color:"#151313", boxSizing:"border-box",
            }}/>
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button onClick={save} style={{ padding:"7px 16px", borderRadius:8, background:"#2D5DDC", color:"#fff", fontSize:12, fontWeight:700, border:"none", cursor:"pointer" }}>Save</button>
            <button onClick={() => setAdding(false)} style={{ padding:"7px 16px", borderRadius:8, background:"#EEEFF1", color:"#64748B", fontSize:12, fontWeight:600, border:`1px solid ${"#E2E6EA"}`, cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {materials.length === 0 && !adding
        ? <div style={card({ padding:36, textAlign:"center" })}>
            <BookOpen size={28} color={"#E2E6EA"} style={{ marginBottom:8 }}/>
            <div style={{ fontSize:13, color:"#94A3B8" }}>No materials yet. Add a note or link.</div>
          </div>
        : materials.map(m => (
            <div key={m.id} style={{ ...card({ padding:"12px 16px", marginBottom:8 }),
              display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
              <div style={{ minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                  <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:4,
                    background: m.type==="link" ? "#EBF0FF"||"#EFF6FF" : "#EBF0FF", color: m.type==="link" ? "#2D5DDC" : "#2D5DDC" }}>
                    {m.type}
                  </span>
                  <span style={{ fontWeight:700, fontSize:13, color:"#151313" }}>{m.title}</span>
                </div>
                {m.type==="link"
                  ? <a href={m.content} target="_blank" rel="noreferrer" style={{ fontSize:12, color:"#2D5DDC" }}>{m.content}</a>
                  : <div style={{ fontSize:12, color:"#64748B", whiteSpace:"pre-wrap" }}>{m.content}</div>
                }
              </div>
              <button onClick={()=>del(m.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#E2E6EA", flexShrink:0, marginLeft:8 }}>×</button>
            </div>
          ))
      }
    </div>
  );
}

// ── Tasks Tab ────────────────────────────────────────────────────────────────
function GroupTasks({ group }) {
  const [tasks, setTasks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title:"", description:"", due_date:"", max_score:100 });

  const loadTasks = useCallback(() => tryOrMock(
    () => getTasks(group.id), () => mockGetTasks(group.id),
  ), [group.id]);

  useEffect(() => { loadTasks().then(setTasks); }, [group.id]);

  const save = async () => {
    if (!form.title.trim()) return;
    await tryOrMock(
      () => createTask({ group_id:group.id, ...form }),
      () => mockCreateTask({ group_id:group.id, ...form }),
    );
    loadTasks().then(setTasks);
    setForm({ title:"", description:"", due_date:"", max_score:100 }); setAdding(false);
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ fontWeight:700, fontSize:14, color:"#151313" }}>Tasks & Homework</span>
        <button onClick={() => setAdding(true)} style={{
          padding:"6px 14px", borderRadius:8, background:"#2D5DDC", color:"#fff",
          fontSize:12, fontWeight:700, border:"none", cursor:"pointer",
        }}>+ Add Task</button>
      </div>

      {adding && (
        <div style={card({ padding:16, marginBottom:14 })}>
          <input placeholder="Task title" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{
            width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${"#E2E6EA"}`,
            fontSize:13, marginBottom:8, color:"#151313", boxSizing:"border-box",
          }}/>
          <textarea placeholder="Description (optional)" value={form.description}
            onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} style={{
              width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${"#E2E6EA"}`,
              fontSize:13, resize:"vertical", marginBottom:8, color:"#151313", boxSizing:"border-box",
            }}/>
          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:"#64748B", marginBottom:3 }}>Due date</div>
              <input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} style={{
                width:"100%", padding:"7px 10px", borderRadius:8, border:`1px solid ${"#E2E6EA"}`,
                fontSize:13, color:"#151313", boxSizing:"border-box",
              }}/>
            </div>
            <div style={{ width:100 }}>
              <div style={{ fontSize:11, color:"#64748B", marginBottom:3 }}>Max score</div>
              <input type="number" value={form.max_score} onChange={e=>setForm(f=>({...f,max_score:+e.target.value}))} style={{
                width:"100%", padding:"7px 10px", borderRadius:8, border:`1px solid ${"#E2E6EA"}`,
                fontSize:13, color:"#151313", boxSizing:"border-box",
              }}/>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={save} style={{ padding:"7px 16px", borderRadius:8, background:"#2D5DDC", color:"#fff", fontSize:12, fontWeight:700, border:"none", cursor:"pointer" }}>Save</button>
            <button onClick={() => setAdding(false)} style={{ padding:"7px 16px", borderRadius:8, background:"#EEEFF1", color:"#64748B", fontSize:12, fontWeight:600, border:`1px solid ${"#E2E6EA"}`, cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {tasks.length === 0 && !adding
        ? <div style={card({ padding:36, textAlign:"center" })}>
            <ClipboardList size={28} color={"#E2E6EA"} style={{ marginBottom:8 }}/>
            <div style={{ fontSize:13, color:"#94A3B8" }}>No tasks yet.</div>
          </div>
        : tasks.map(t => (
            <div key={t.id} style={{ ...card({ padding:"12px 16px", marginBottom:8 }) }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:"#151313", marginBottom:3 }}>{t.title}</div>
                  {t.description && <div style={{ fontSize:12, color:"#64748B" }}>{t.description}</div>}
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0, marginLeft:8 }}>
                  {t.due_date && <span style={pill("#F59E0B", "#FEF3C7")}>Due {fmtDate(t.due_date)}</span>}
                  <span style={pill("#64748B", "#EEEFF1")}>{t.max_score} pts</span>
                </div>
              </div>
            </div>
          ))
      }
    </div>
  );
}

// ── Group Detail View ─────────────────────────────────────────────────────────
function GroupDetail({ group, students, onBack }) {
  const [tab, setTab] = useState("attendance");
  const [groupStudents, setGroupStudents] = useState([]);

  useEffect(() => {
    tryOrMock(() => getGroupStudents(group.id), () => mockGetGroupStudents(group.id))
      .then(setGroupStudents);
  }, [group.id]);

  const tabs = [
    { id:"attendance", label:"Attendance", Icon:ClipboardList },
    { id:"materials",  label:"Materials",  Icon:BookOpen       },
    { id:"tasks",      label:"Tasks",      Icon:FileText       },
  ];

  return (
    <div>
      {/* Group header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
        <button onClick={onBack} style={{
          display:"flex", alignItems:"center", gap:4,
          background:"none", border:"none", cursor:"pointer", color:"#64748B", fontSize:13, fontWeight:600,
        }}>
          <ChevronLeft size={16}/> Groups
        </button>
        <div style={{ width:1, height:20, background:"#E2E6EA" }}/>
        <div style={{ width:10, height:10, borderRadius:"50%", background:group.color||"#2D5DDC" }}/>
        <div style={{ fontWeight:800, fontSize:18, color:"#151313" }}>{group.name}</div>
        {group.level && <span style={pill("#8B5CF6", "#EDE9FE")}>{group.level}</span>}
        <span style={{ fontSize:12, color:"#94A3B8", marginLeft:"auto" }}>
          <Users size={12} style={{ verticalAlign:"middle" }}/> {groupStudents.length} students
        </span>
      </div>

      {/* Schedule bar */}
      {group.schedule?.length > 0 && (
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          {group.schedule.map(s => (
            <span key={s.day} style={pill(group.color||"#2D5DDC", `${group.color||"#2D5DDC"}15`)}>
              <Clock size={10}/>{DAY_NAMES[s.day]} {s.start.slice(0,5)}–{s.end.slice(0,5)}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, borderBottom:`2px solid ${"#E2E6EA"}`, marginBottom:20 }}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display:"flex", alignItems:"center", gap:6, padding:"10px 18px",
            background:"none", border:"none", cursor:"pointer", fontWeight:700, fontSize:13,
            color: tab===id ? "#2D5DDC" : "#64748B",
            borderBottom: `2px solid ${tab===id ? "#2D5DDC" : "transparent"}`,
            marginBottom:-2,
          }}>
            <Icon size={14}/>{label}
          </button>
        ))}
      </div>

      {tab==="attendance" && <GroupAttendance group={group} groupStudents={groupStudents} students={students}/>}
      {tab==="materials"  && <GroupMaterials group={group}/>}
      {tab==="tasks"      && <GroupTasks group={group}/>}
    </div>
  );
}

// ── Groups List ───────────────────────────────────────────────────────────────
function GroupsList({ groups, students, onSelect }) {
  if (groups.length === 0) return (
    <div style={card({ padding:60, textAlign:"center" })}>
      <Layers size={36} color={"#E2E6EA"} style={{ marginBottom:12 }}/>
      <div style={{ fontSize:14, color:"#94A3B8" }}>No groups assigned to you yet.</div>
    </div>
  );
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
      {groups.map(g => {
        const days = (g.schedule||[]).map(s => `${DAY_NAMES[s.day]} ${s.start.slice(0,5)}`).join(" · ");
        return (
          <div key={g.id} onClick={() => onSelect(g)} style={{
            ...card({ padding:20, cursor:"pointer" }),
            borderTop:`3px solid ${g.color||"#2D5DDC"}`,
            transition:"box-shadow .15s",
          }}
            onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.08)"}
            onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}
          >
            <div style={{ fontWeight:800, fontSize:15, color:"#151313", marginBottom:4 }}>{g.name}</div>
            {g.level && <span style={{ ...pill("#8B5CF6", "#EDE9FE"), marginBottom:10, display:"inline-block" }}>{g.level}</span>}
            {days && <div style={{ fontSize:11, color:"#94A3B8", marginTop:6 }}>
              <Clock size={10} style={{ verticalAlign:"middle", marginRight:3 }}/>{days}
            </div>}
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:10 }}>
              <span style={{ fontSize:12, color:"#2D5DDC", fontWeight:700 }}>Open →</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Login Screen ─────────────────────────────────────────────────────────────
function TeacherLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Dev auto-login
  useEffect(() => {
    if (import.meta.env.DEV) {
      const db = JSON.parse(localStorage.getItem("lc_admin_db") || "{}");
      const teachers = (db.adminUsers||[]).filter(u=>u.role==="teacher"||u.role==="staff"||u.role==="admin");
      if (teachers.length > 0) {
        onLogin({ username: teachers[0].username, name: teachers[0].name||teachers[0].username, role: teachers[0].role });
        return;
      }
      // fallback mock teacher
      onLogin({ username:"demo_teacher", name:"Demo Teacher", role:"teacher" });
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true); setError("");
    try {
      const db = JSON.parse(localStorage.getItem("lc_admin_db") || "{}");
      const user = (db.adminUsers||[]).find(u => u.username===username.trim());
      if (!user) { setError("User not found"); setLoading(false); return; }
      // verify password hash
      const enc = new TextEncoder().encode(password.trim());
      const hash = await crypto.subtle.digest("SHA-256", enc);
      const hex  = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
      if (hex !== user.passwordHash) { setError("Incorrect password"); setLoading(false); return; }
      onLogin({ username: user.username, name: user.name||user.username, role: user.role });
    } catch {
      setError("Login failed");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#EEEFF1", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:360, ...card({ padding:36 }) }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:28 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:"#EBF0FF", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <GraduationCap size={20} color={"#2D5DDC"}/>
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:"#151313" }}>Teacher Portal</div>
            <div style={{ fontSize:11, color:"#94A3B8" }}>LingvoConnect LMS</div>
          </div>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#151313", marginBottom:5 }}>Username</div>
            <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="your.username"
              style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1px solid ${"#E2E6EA"}`,
                fontSize:13, color:"#151313", boxSizing:"border-box" }}/>
          </div>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#151313", marginBottom:5 }}>Password</div>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
              style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1px solid ${"#E2E6EA"}`,
                fontSize:13, color:"#151313", boxSizing:"border-box" }}/>
          </div>
          {error && <div style={{ fontSize:12, color:"#EF4444", marginBottom:12 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width:"100%", padding:"11px", borderRadius:10, background:"#2D5DDC", color:"#fff",
            fontSize:14, fontWeight:700, border:"none", cursor:"pointer",
          }}>{loading ? "Signing in…" : "Sign In"}</button>
        </form>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function TeacherPortal() {
  const [teacher, setTeacher] = useState(null);
  const [groups,  setGroups]  = useState([]);
  const [students, setStudents] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [section, setSection] = useState("home"); // home | groups
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!teacher) return;
    Promise.all([
      tryOrMock(getGroups, () => mockGetGroups(teacher.username)),
      tryOrMock(getAllStudents, mockGetAllStudents),
    ]).then(([g, s]) => {
      const myGroups = (g||[]).filter(gr => gr.status==="active" && gr.teacher_username===teacher.username);
      // if real DB returned groups for other teachers but none for this teacher, try mock
      if (myGroups.length === 0 && IS_DEV) {
        mockGetGroups(teacher.username).then(mg => setGroups(mg));
      } else {
        setGroups(myGroups);
      }
      setStudents(s||[]);
      if ((s||[]).length === 0 && IS_DEV) {
        mockGetAllStudents().then(ms => setStudents(ms));
      }
    }).catch(()=>{
      if (IS_DEV) {
        mockGetGroups(teacher.username).then(setGroups);
        mockGetAllStudents().then(setStudents);
      }
    });
  }, [teacher]);

  if (!teacher) return <TeacherLogin onLogin={setTeacher}/>;

  const navItems = [
    { id:"home",   label:"Dashboard", Icon:CalendarDays },
    { id:"groups", label:"My Groups", Icon:Layers       },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#EEEFF1", display:"flex", flexDirection:"column" }}>
      {/* Top bar */}
      <div style={{
        background:"#FCFCFC", borderBottom:`1px solid ${"#E2E6EA"}`,
        padding:"0 24px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:"#EBF0FF", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <GraduationCap size={16} color={"#2D5DDC"}/>
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:"#151313", lineHeight:1 }}>Teacher Portal</div>
            <div style={{ fontSize:10, color:"#94A3B8" }}>LingvoConnect</div>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          {/* Desktop nav */}
          <div style={{ display:"flex", gap:4 }}>
            {navItems.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => { setSection(id); setActiveGroup(null); }} style={{
                display:"flex", alignItems:"center", gap:6, padding:"6px 14px",
                borderRadius:8, background:section===id ? "#EBF0FF" : "none",
                color: section===id ? "#2D5DDC" : "#64748B",
                border: "none", cursor:"pointer", fontWeight:700, fontSize:12,
              }}>
                <Icon size={14}/>{label}
              </button>
            ))}
          </div>

          {/* Teacher badge */}
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 12px",
            background:"#EEEFF1", borderRadius:20, border:`1px solid ${"#E2E6EA"}` }}>
            <div style={{ width:24, height:24, borderRadius:"50%", background:"#EBF0FF",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:11, fontWeight:800, color:"#2D5DDC" }}>
              {teacher.name[0].toUpperCase()}
            </div>
            <span style={{ fontSize:12, fontWeight:600, color:"#151313" }}>{teacher.name}</span>
          </div>

          <button onClick={() => setTeacher(null)} style={{
            display:"flex", alignItems:"center", gap:4, padding:"6px 12px", borderRadius:8,
            background:"none", border:`1px solid ${"#E2E6EA"}`, cursor:"pointer", color:"#64748B", fontSize:12,
          }}>
            <LogOut size={13}/> Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth:1100, margin:"0 auto", width:"100%", padding:"28px 24px" }}>
        {/* Page heading */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:22, fontWeight:900, color:"#151313" }}>
            {activeGroup ? activeGroup.name : section==="home" ? `Good day, ${teacher.name.split(" ")[0]} 👋` : "My Groups"}
          </div>
          {!activeGroup && section==="home" && (
            <div style={{ fontSize:13, color:"#94A3B8", marginTop:4 }}>
              Here's your teaching schedule for the week
            </div>
          )}
        </div>

        {activeGroup
          ? <GroupDetail group={activeGroup} students={students} onBack={() => setActiveGroup(null)}/>
          : section==="home"
            ? <TeacherHome groups={groups} students={students} onSelectGroup={g => { setActiveGroup(g); setSection("groups"); }}/>
            : <GroupsList groups={groups} students={students} onSelect={g => { setActiveGroup(g); setSection("groups"); }}/>
        }
      </div>
    </div>
  );
}
