import { useState, useEffect, useCallback } from "react";
import {
  Plus, Edit2, Archive, ChevronLeft, UserPlus, UserMinus, X, Save, Loader,
  GraduationCap, BookOpen, CalendarDays, ClipboardList, Users,
  Check, Clock, AlertCircle, Trash2, Link, FileText, ExternalLink,
  Star, ChevronDown, ChevronUp, Tag, Hash, MapPin
} from "lucide-react";
import {
  getGroups, createGroup, updateGroup, archiveGroup,
  getGroupStudents, enrollStudent, unenrollStudent,
  getSessions, createSession, deleteSession,
  getAttendance, markAttendance, getPeriodAttendanceSummary,
  getMaterials, createMaterial, deleteMaterial,
  getTasks, createTask, deleteTask, getTaskSubmissions, gradeSubmission,
  getTagsForStudents, addStudentTag, removeStudentTag, getAllTagsInSchool,
} from "../../lib/lmsDb.js";
import { getAllStudents } from "../../lib/studentDb.js";
import {
  mockGetAllGroups, mockGetGroupStudents, mockGetAllStudents,
  mockGetSessions, mockGetAttendance, mockMarkAttendance,
  mockGetMaterials, mockCreateMaterial, mockDeleteMaterial,
  mockGetTasks, mockCreateTask, MOCK_STUDENTS,
} from "../../lib/lmsDevMock.js";

const IS_DEV = import.meta.env.DEV;
async function tryOrMock(realFn, mockFn, ...args) {
  if (!IS_DEV) return realFn(...args);
  try {
    const r = await realFn(...args);
    if (r && (Array.isArray(r) ? r.length : true)) return r;
    throw new Error("empty");
  } catch { return mockFn(...args); }
}

const GROUP_COLORS = ["#3B82F6","#10B981","#8B5CF6","#F59E0B","#EF4444","#06B6D4","#F97316","#EC4899","#6366F1","#14B8A6"];
const LEVELS       = ["A1","A2","B1","B2","C1","C2","IELTS 5+","IELTS 6+","IELTS 7+","Kids","Teens","Corporate","Custom"];
const DAY_NAMES    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_FULL     = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS_      = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_        = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const TAG_COLORS   = ["#3B82F6","#10B981","#8B5CF6","#F59E0B","#EF4444","#06B6D4","#F97316","#EC4899"];
const PRESET_TAGS  = ["IELTS","Speaking","Writing","Beginner","Advanced","VIP","Struggling","Online"];

const ATTENDANCE_CFG = {
  present: { label:"Present", color:"#10B981", bg:"#D1FAE5", Icon:Check      },
  absent:  { label:"Absent",  color:"#EF4444",   bg:"#FEE2E2", Icon:X          },
  late:    { label:"Late",    color:"#F59E0B", bg:"#FEF3C7", Icon:Clock      },
  excused: { label:"Excused", color:"#2D5DDC",  bg:"#EBF0FF",   Icon:AlertCircle},
};

function card(e={}) { return { background:"#FCFCFC", borderRadius:8, border:`1px solid ${"#E2E6EA"}`, ...e }; }
function btn(v="primary", e={}) {
  const b = { display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer",border:"none",transition:"opacity .1s" };
  if(v==="primary") return {...b,background:"#2D5DDC",color:"#fff",...e};
  if(v==="ghost")   return {...b,background:"transparent",color:"#151313",border:`1px solid ${"#E2E6EA"}`,...e};
  if(v==="danger")  return {...b,background:"#FEE2E2",color:"#EF4444",border:`1px solid ${"#EF4444"}30`,...e};
  return {...b,...e};
}
const lbl = { display:"block",fontSize:12,fontWeight:700,color:"#151313",marginBottom:4,marginTop:12 };
const inp = { display:"block",width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:8,border:`1px solid ${"#E2E6EA"}`,fontSize:13,color:"#151313",background:"#EEEFF1",outline:"none",fontFamily:"inherit" };

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(dateStr) {
  if (!dateStr) return "";
  const [y,m,d] = dateStr.split("-");
  return `${+d} ${MONTHS_[+m-1]} ${y}`;
}
function periodLabel(start, months) {
  if (!start) return "";
  const d = new Date(start);
  if (months === 1) return `${MONTHS_[d.getMonth()]} ${d.getFullYear()}`;
  const end = new Date(d); end.setMonth(end.getMonth() + months - 1);
  return `${MONTHS_[d.getMonth()]}–${MONTHS_[end.getMonth()]} ${end.getFullYear()}`;
}
function periodEnd(start, months) {
  const d = new Date(start); d.setMonth(d.getMonth() + months); d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; }

// ── Root component ────────────────────────────────────────────────────────────
export default function GroupManager({ db }) {
  const [groups,   setGroups]  = useState([]);
  const [students, setStudents]= useState([]);
  const [loading,  setLoading] = useState(true);
  const [view,     setView]    = useState("list"); // list | detail
  const [group,    setGroup]   = useState(null);
  const [modal,    setModal]   = useState(null);   // null | "new" | group

  // teachers = staff members from db
  const teachers = (db?.adminUsers || []).filter(u => u.role === "teacher" || u.role === "staff" || u.role === "admin" || u.role === "superadmin");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, s] = await Promise.all([
        tryOrMock(getGroups, mockGetAllGroups),
        tryOrMock(getAllStudents, mockGetAllStudents),
      ]);
      setGroups(g || []); setStudents(s || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openGroup = (g) => { setGroup(g); setView("detail"); };
  const back      = ()  => { setView("list"); setGroup(null); };

  const handleSave = async (data) => {
    if (modal === "new") await createGroup(data);
    else await updateGroup(modal.id, data);
    setModal(null); load();
    // refresh group in detail view if open
    if (group && modal?.id === group.id) setGroup(g => ({ ...g, ...data }));
  };

  if (loading) return <Spin/>;

  return (
    <div style={{ padding:"24px 0", fontFamily:"'Montserrat',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {view === "list" && (
        <GroupsList
          groups={groups}
          teachers={teachers}
          onOpen={openGroup}
          onNew={() => setModal("new")}
          onEdit={g => setModal(g)}
          onArchive={async g => { await archiveGroup(g.id); load(); }}
        />
      )}

      {view === "detail" && group && (
        <GroupDetail
          group={group}
          allStudents={students}
          teachers={teachers}
          onBack={back}
          onEdit={() => setModal(group)}
          onGroupUpdated={updated => setGroup(updated)}
        />
      )}

      {modal !== null && (
        <GroupModal
          group={modal === "new" ? null : modal}
          teachers={teachers}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── Groups list ───────────────────────────────────────────────────────────────
function GroupsList({ groups, teachers, onOpen, onNew, onEdit, onArchive }) {
  const tMap   = Object.fromEntries(teachers.map(t => [t.username, t]));
  const active = groups.filter(g => g.status === "active");
  const arch   = groups.filter(g => g.status === "archived");

  return (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:"#151313" }}>LMS Groups</h2>
          <p style={{ margin:"4px 0 0", color:"#94A3B8", fontSize:13 }}>Manage groups, assign teachers, track students</p>
        </div>
        <button style={btn("primary")} onClick={onNew}><Plus size={15}/> New Group</button>
      </div>

      {active.length === 0 && (
        <div style={{ ...card({ padding:48, textAlign:"center" }) }}>
          <BookOpen size={40} color={"#94A3B8"} style={{ marginBottom:12 }}/>
          <div style={{ color:"#94A3B8", fontSize:14 }}>No groups yet. Create your first group to get started.</div>
        </div>
      )}

      <div style={{ display:"grid", gap:14, gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))" }}>
        {active.map(g => (
          <GroupCard key={g.id} group={g} teacher={tMap[g.teacher_username]}
            onClick={() => onOpen(g)} onEdit={() => onEdit(g)} onArchive={() => onArchive(g)}/>
        ))}
      </div>

      {arch.length > 0 && (
        <details style={{ marginTop:24 }}>
          <summary style={{ color:"#94A3B8", fontSize:13, cursor:"pointer", marginBottom:12 }}>
            {arch.length} archived group{arch.length !== 1 ? "s" : ""}
          </summary>
          <div style={{ display:"grid", gap:14, gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))" }}>
            {arch.map(g => (
              <GroupCard key={g.id} group={g} teacher={tMap[g.teacher_username]}
                onClick={() => onOpen(g)} onEdit={() => onEdit(g)} onArchive={() => {}} archived/>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function GroupCard({ group:g, teacher, onClick, onEdit, onArchive, archived }) {
  const accent = g.color || "#2D5DDC";
  // Darken accent for gradient
  const hex2rgb = h => { const r=parseInt(h.slice(1,3),16),gv=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return [r,gv,b]; };
  const darken = (hex,amt) => { const [r,gv,b]=hex2rgb(hex); return `rgb(${Math.max(0,r-amt)},${Math.max(0,gv-amt)},${Math.max(0,b-amt)})`; };
  const accentDk = darken(accent.startsWith("#")&&accent.length===7?accent:"#2D5DDC", 40);

  return (
    <div style={{ borderRadius:16, overflow:"hidden", cursor:"pointer",
        boxShadow:"0 2px 8px rgba(0,0,0,.06)", transition:"transform .15s, box-shadow .15s" }}
      onClick={onClick}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,.12)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,.06)";}}>

      {/* Gradient header */}
      <div style={{ background:`linear-gradient(135deg, ${accent} 0%, ${accentDk} 100%)`, padding:"18px 18px 16px", position:"relative" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:"#fff", letterSpacing:"-0.03em", lineHeight:1.2, marginBottom:6 }}>{g.name}</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {g.level && (
                <span style={{ fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:20,
                  background:"rgba(255,255,255,.22)", color:"#fff", letterSpacing:"0.04em", textTransform:"uppercase" }}>
                  {g.level}
                </span>
              )}
              {archived && <span style={{ fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:20, background:"rgba(255,255,255,.18)", color:"rgba(255,255,255,.8)", letterSpacing:"0.04em", textTransform:"uppercase" }}>Archived</span>}
            </div>
          </div>
          <div style={{ width:36, height:36, borderRadius:10, background:"rgba(255,255,255,.18)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Users size={18} color="#fff" strokeWidth={2}/>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ background:"#FCFCFC", padding:"14px 18px 16px", border:"1px solid #E2E6EA", borderTop:"none" }}>
        {/* Info rows */}
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color: teacher ? "#64748B" : "#94A3B8" }}>
            <GraduationCap size={13} color={teacher ? accent : "#C0C8D4"}/>
            <span>{teacher ? teacher.username : "No teacher assigned"}</span>
          </div>
          {g.period_start && (
            <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"#64748B" }}>
              <CalendarDays size={13} color={accent}/>
              <span>{periodLabel(g.period_start, g.period_months || 1)}</span>
            </div>
          )}
          {g.schedule?.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:11, color:"#64748B" }}>
              <Clock size={12} color={accent}/>
              <span>{g.schedule.map(s => `${DAY_NAMES[s.day]} ${s.start.slice(0,5)}`).join(" · ")}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:6, borderTop:"1px solid #F1F5F9", paddingTop:12 }} onClick={e => e.stopPropagation()}>
          <button style={btn("ghost",{fontSize:12,padding:"6px 12px",borderRadius:8,flex:1,justifyContent:"center"})} onClick={onEdit}>
            <Edit2 size={12}/> Edit
          </button>
          {!archived && (
            <button style={btn("danger",{fontSize:12,padding:"6px 12px",borderRadius:8})} onClick={onArchive}>
              <Archive size={12}/>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Group Detail ──────────────────────────────────────────────────────────────
const DETAIL_TABS = [
  { id:"students",   label:"Students",   Icon:Users        },
  { id:"attendance", label:"Attendance", Icon:CalendarDays },
  { id:"materials",  label:"Materials",  Icon:BookOpen     },
  { id:"tasks",      label:"Tasks",      Icon:ClipboardList},
];

function GroupDetail({ group, allStudents, teachers, onBack, onEdit, onGroupUpdated }) {
  const [tab, setTab] = useState("students");
  const tMap = Object.fromEntries(teachers.map(t => [t.username, t]));
  const teacher = tMap[group.teacher_username];

  return (
    <div>
      {/* Detail header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <button style={btn("ghost",{padding:"6px 10px"})} onClick={onBack}>
          <ChevronLeft size={15}/>
        </button>
        <div style={{ width:14, height:14, borderRadius:3, background: group.color || "#2D5DDC", flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:"#151313" }}>{group.name}</h2>
            {group.level && (
              <span style={{ fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20,
                background:`${group.color||"#2D5DDC"}20`, color:group.color||"#2D5DDC" }}>
                {group.level}
              </span>
            )}
          </div>
          <div style={{ display:"flex", gap:12, marginTop:3, flexWrap:"wrap" }}>
            {teacher && <span style={{ fontSize:12, color:"#94A3B8" }}><GraduationCap size={11} style={{verticalAlign:"middle"}}/> {teacher.username}</span>}
            {group.period_start && <span style={{ fontSize:12, color:"#94A3B8" }}><CalendarDays size={11} style={{verticalAlign:"middle"}}/> {periodLabel(group.period_start, group.period_months||1)}</span>}
            {group.schedule?.length > 0 && <span style={{ fontSize:12, color:"#94A3B8" }}>{group.schedule.map(s=>`${DAY_NAMES[s.day]} ${s.start.slice(0,5)}–${s.end.slice(0,5)}`).join(" · ")}</span>}
          </div>
        </div>
        <button style={btn("ghost",{fontSize:12,padding:"6px 12px"})} onClick={onEdit}>
          <Edit2 size={13}/> Edit Group
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:`1px solid ${"#E2E6EA"}`, flexWrap:"wrap" }}>
        {DETAIL_TABS.map(({ id, label, Icon }) => (
          <button key={id}
            style={{
              display:"flex", alignItems:"center", gap:6, padding:"9px 16px",
              fontWeight:600, fontSize:13, cursor:"pointer", border:"none", background:"transparent",
              borderBottom: tab===id ? `2px solid ${group.color||"#2D5DDC"}` : "2px solid transparent",
              color: tab===id ? (group.color||"#2D5DDC") : "#64748B",
              marginBottom:-1,
            }}
            onClick={() => setTab(id)}
          >
            <Icon size={14}/>{label}
          </button>
        ))}
      </div>

      {tab === "students"   && <StudentsTab   group={group} allStudents={allStudents}/>}
      {tab === "attendance" && <AttendanceTab group={group} allStudents={allStudents}/>}
      {tab === "materials"  && <MaterialsTab  groupId={group.id}/>}
      {tab === "tasks"      && <TasksTab      groupId={group.id} allStudents={allStudents}/>}
    </div>
  );
}

// ── Students Tab (enroll + tags) ──────────────────────────────────────────────
const ATT_CFG = {
  present: { label:"P", color:"#10B981", bg:"#D1FAE5", title:"Present" },
  late:    { label:"L", color:"#F59E0B", bg:"#FEF3C7", title:"Late"    },
  absent:  { label:"A", color:"#EF4444", bg:"#FEE2E2", title:"Absent"  },
  excused: { label:"E", color:"#3B82F6", bg:"#EFF6FF", title:"Excused" },
};

function AttDot({ status }) {
  const cfg = ATT_CFG[status] || { label:"–", color:"#94A3B8", bg:"#EEEFF1", title:"No record" };
  return (
    <span title={cfg.title} style={{
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      width:22, height:22, borderRadius:4, fontSize:10, fontWeight:800,
      background:cfg.bg, color:cfg.color,
    }}>{cfg.label}</span>
  );
}

function StudentsTab({ group, allStudents }) {
  const [enrolled,  setEnrolled]  = useState([]);
  const [sessions,  setSessions]  = useState([]);
  const [attMap,    setAttMap]    = useState({}); // { studentId: { sessionId: status } }
  const [tags,      setTags]      = useState({});
  const [allTags,   setAllTags]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [showAdd,   setShowAdd]   = useState(false);
  const [working,   setWorking]   = useState(null);

  const sMap = Object.fromEntries([
    ...MOCK_STUDENTS.map(s => [s.student_id, s]),
    ...allStudents.map(s => [s.student_id, s]),
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    const [rows, sess] = await Promise.all([
      tryOrMock(getGroupStudents, mockGetGroupStudents, group.id),
      tryOrMock(getSessions, mockGetSessions, group.id),
    ]);
    const ids = rows.map(r => r.student_id);
    let tMap = {}, allT = [];
    try { [tMap, allT] = await Promise.all([getTagsForStudents(ids), getAllTagsInSchool()]); } catch {}

    // load attendance for all sessions
    const pastSess = sess.filter(s => s.date <= new Date().toISOString().split("T")[0]);
    const attResults = await Promise.all(
      pastSess.map(s => tryOrMock(getAttendance, mockGetAttendance, s.id))
    );
    const built = {};
    pastSess.forEach((s, i) => {
      (attResults[i] || []).forEach(r => {
        if (!built[r.student_id]) built[r.student_id] = {};
        built[r.student_id][s.id] = r.status;
      });
    });

    setEnrolled(rows);
    setSessions(pastSess.slice(-8)); // show last 8 sessions
    setAttMap(built);
    setTags(tMap);
    setAllTags(allT);
    setLoading(false);
  }, [group.id]);

  useEffect(() => { load(); }, [load]);

  const unenroll = async (studentId) => {
    setWorking(studentId);
    await unenrollStudent(group.id, studentId);
    load();
    setWorking(null);
  };

  const toggleTag = async (studentId, tag, color, hasIt) => {
    if (hasIt) await removeStudentTag(studentId, tag);
    else       await addStudentTag(studentId, tag, color);
    const ids  = enrolled.map(r => r.student_id);
    const tMap = await getTagsForStudents(ids);
    setTags(tMap);
  };

  const available = [...MOCK_STUDENTS, ...allStudents]
    .filter((s, i, arr) => arr.findIndex(x => x.student_id === s.student_id) === i)
    .filter(s => (s.status === "active" || s.status === "approved" || !s.status) && !enrolled.find(e => e.student_id === s.student_id))
    .filter(s => !search || (s.full_name||"").toLowerCase().includes(search.toLowerCase()) || (s.email||"").toLowerCase().includes(search.toLowerCase()));

  if (loading) return <Spin/>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <span style={{ fontSize:13, color:"#64748B" }}>{enrolled.length} enrolled</span>
        <button style={btn("primary",{fontSize:12})} onClick={() => setShowAdd(v=>!v)}>
          <UserPlus size={13}/> Enroll Students
        </button>
      </div>

      {/* Enroll panel */}
      {showAdd && (
        <div style={{ ...card({ padding:"14px 16px" }) }}>
          <input style={{ ...inp, marginBottom:10 }} placeholder="Search students to enroll…"
            value={search} onChange={e => setSearch(e.target.value)}/>
          <div style={{ maxHeight:240, overflowY:"auto", display:"flex", flexDirection:"column", gap:6 }}>
            {available.slice(0, 30).map(s => (
              <div key={s.student_id} style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"8px 12px", borderRadius:8, background:"#EEEFF1", border:`1px solid ${"#E2E6EA"}`,
              }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13, color:"#151313" }}>{s.full_name}</div>
                  <div style={{ fontSize:11, color:"#94A3B8" }}>{s.email}</div>
                </div>
                <button style={btn("primary",{fontSize:12,padding:"5px 10px"})}
                  onClick={async () => { await enrollStudent(group.id, s.student_id); load(); }}>
                  <UserPlus size={12}/> Enroll
                </button>
              </div>
            ))}
            {available.length === 0 && <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:12 }}>No students to add</div>}
          </div>
        </div>
      )}

      {/* Attendance legend */}
      {sessions.length > 0 && (
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", padding:"8px 0", borderBottom:`1px solid ${"#E2E6EA"}` }}>
          {Object.entries(ATT_CFG).map(([k, v]) => (
            <span key={k} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"#64748B" }}>
              <AttDot status={k}/> {v.title}
            </span>
          ))}
        </div>
      )}

      {/* Student rows with attendance */}
      {enrolled.length === 0 && !showAdd && (
        <div style={{ ...card({ padding:40, textAlign:"center" }) }}>
          <Users size={36} color={"#94A3B8"} style={{ marginBottom:10 }}/>
          <div style={{ color:"#94A3B8", fontSize:13 }}>No students enrolled yet</div>
        </div>
      )}

      {enrolled.map(e => {
        const s     = sMap[e.student_id];
        const sTags = tags[e.student_id] || [];
        const sAtt  = attMap[e.student_id] || {};
        if (!s) return null;

        const counts = { present:0, late:0, absent:0, excused:0 };
        sessions.forEach(sess => {
          const st = sAtt[sess.id];
          if (st && counts[st] !== undefined) counts[st]++;
        });
        const attended = counts.present + counts.late;
        const rate = sessions.length ? Math.round((attended / sessions.length) * 100) : null;

        return (
          <div key={e.student_id} style={{ ...card({ padding:"14px 18px" }) }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8, marginBottom:10 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:"#151313" }}>{s.full_name}</div>
                <div style={{ fontSize:11, color:"#94A3B8" }}>{s.email}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {rate !== null && (
                  <span style={{
                    fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:4,
                    background: rate>=80?"#D1FAE5":rate>=60?"#FEF3C7":"#FEE2E2",
                    color:      rate>=80?"#065F46":rate>=60?"#92400E":"#991B1B",
                  }}>{rate}% attendance</span>
                )}
                <button style={btn("danger",{fontSize:12,padding:"5px 9px"})}
                  disabled={working===e.student_id} onClick={() => unenroll(e.student_id)}>
                  <UserMinus size={12}/> Remove
                </button>
              </div>
            </div>

            {/* Attendance dots */}
            {sessions.length > 0 && (
              <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10, alignItems:"center" }}>
                <span style={{ fontSize:10, color:"#94A3B8", marginRight:4 }}>Sessions:</span>
                {sessions.map(sess => (
                  <span key={sess.id} title={`${sess.date} — ${sess.title||""}`}>
                    <AttDot status={sAtt[sess.id] || null}/>
                  </span>
                ))}
                <span style={{ fontSize:10, color:"#94A3B8", marginLeft:4 }}>
                  {counts.present}P · {counts.late}L · {counts.absent}A · {counts.excused}E
                </span>
              </div>
            )}

            {/* Tags */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
              {sTags.map(t => (
                <span key={t.tag} style={{
                  display:"inline-flex", alignItems:"center", gap:4,
                  padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:600,
                  background:`${t.color}20`, color:t.color, cursor:"pointer",
                }} onClick={() => toggleTag(e.student_id, t.tag, t.color, true)}>
                  {t.tag} <X size={10}/>
                </span>
              ))}
              <TagPicker
                studentId={e.student_id}
                existing={sTags}
                allTags={allTags}
                onAdd={(tag, color) => toggleTag(e.student_id, tag, color, false)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TagPicker({ studentId, existing, allTags, onAdd }) {
  const [open, setOpen]   = useState(false);
  const [newTag, setNewTag] = useState("");
  const [color,  setColor]  = useState(TAG_COLORS[0]);
  const existSet = new Set(existing.map(t => t.tag));

  return (
    <div style={{ position:"relative" }}>
      <button style={{ ...btn("ghost",{fontSize:11,padding:"3px 8px"}), borderRadius:20 }}
        onClick={() => setOpen(v => !v)}>
        <Tag size={11}/> Add tag
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:50,
          background:"#FCFCFC", border:`1px solid ${"#E2E6EA"}`, borderRadius:10,
          padding:12, width:220, boxShadow:"0 8px 24px rgba(0,0,0,.12)",
        }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", marginBottom:8 }}>PRESET TAGS</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
            {PRESET_TAGS.filter(t => !existSet.has(t)).map((t, i) => (
              <span key={t} style={{
                padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:600,
                background:`${TAG_COLORS[i%TAG_COLORS.length]}20`, color:TAG_COLORS[i%TAG_COLORS.length],
                cursor:"pointer",
              }} onClick={() => { onAdd(t, TAG_COLORS[i%TAG_COLORS.length]); setOpen(false); }}>
                {t}
              </span>
            ))}
          </div>
          {allTags.filter(t => !existSet.has(t.tag) && !PRESET_TAGS.includes(t.tag)).length > 0 && (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", marginBottom:6 }}>USED IN SCHOOL</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
                {allTags.filter(t => !existSet.has(t.tag) && !PRESET_TAGS.includes(t.tag)).map(t => (
                  <span key={t.tag} style={{
                    padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:600,
                    background:`${t.color}20`, color:t.color, cursor:"pointer",
                  }} onClick={() => { onAdd(t.tag, t.color); setOpen(false); }}>
                    {t.tag}
                  </span>
                ))}
              </div>
            </>
          )}
          <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", marginBottom:6 }}>CUSTOM TAG</div>
          <div style={{ display:"flex", gap:6 }}>
            <input style={{ ...inp, flex:1, fontSize:12, padding:"6px 10px" }}
              placeholder="Tag name…" value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter" && newTag.trim()) { onAdd(newTag.trim(), color); setNewTag(""); setOpen(false); }}}/>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              {TAG_COLORS.slice(0,4).map(c => (
                <div key={c} style={{ width:16, height:16, borderRadius:"50%", background:c, cursor:"pointer",
                  border:`2px solid ${color===c?"#000":"transparent"}` }}
                  onClick={() => setColor(c)}/>
              ))}
            </div>
          </div>
          {newTag.trim() && (
            <button style={{ ...btn("primary",{fontSize:11,padding:"5px 10px",marginTop:6,width:"100%",justifyContent:"center"}) }}
              onClick={() => { onAdd(newTag.trim(), color); setNewTag(""); setOpen(false); }}>
              Add "{newTag.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Attendance Tab ────────────────────────────────────────────────────────────
function AttendanceTab({ group, allStudents }) {
  const now = new Date();
  const ps  = group.period_start ? new Date(group.period_start) : new Date(now.getFullYear(), now.getMonth(), 1);
  const [calYear,  setCalYear]  = useState(ps.getFullYear());
  const [calMonth, setCalMonth] = useState(ps.getMonth());
  const [sessions, setSessions] = useState([]);
  const [enrolled, setEnrolled] = useState([]);
  const [activeSession, setActiveSession] = useState(null); // null | session
  const [attendance, setAttendance] = useState({});
  const [saving, setSaving]  = useState(new Set());
  const [modal,  setModal]   = useState(false);

  const sMap = Object.fromEntries([
    ...MOCK_STUDENTS.map(s => [s.student_id, s]),
    ...allStudents.map(s => [s.student_id, s]),
  ]);

  const periodS = `${calYear}-${String(calMonth+1).padStart(2,"0")}-01`;
  const periodE = new Date(calYear, calMonth+1, 0).toISOString().split("T")[0];

  const load = useCallback(async () => {
    const [sess, gs] = await Promise.all([
      tryOrMock(getSessions, mockGetSessions, group.id),
      tryOrMock(getGroupStudents, mockGetGroupStudents, group.id),
    ]);
    setSessions(sess);
    setEnrolled(gs);
  }, [group.id, periodS, periodE]);

  useEffect(() => { load(); }, [load]);

  const openSession = async (s) => {
    setActiveSession(s);
    const records = await tryOrMock(getAttendance, mockGetAttendance, s.id);
    const map = {};
    records.forEach(r => { map[r.student_id] = r.status; });
    enrolled.forEach(e => { if (!map[e.student_id]) map[e.student_id] = "present"; });
    setAttendance(map);
  };

  const markOne = async (studentId, status) => {
    setSaving(s => new Set([...s, studentId]));
    setAttendance(a => ({ ...a, [studentId]: status }));
    try { await tryOrMock(markAttendance, mockMarkAttendance, activeSession.id, studentId, status); }
    finally { setSaving(s => { const n = new Set(s); n.delete(studentId); return n; }); }
  };

  const markAll = async (status) => {
    const ids = enrolled.map(e => e.student_id);
    ids.forEach(id => setSaving(s => new Set([...s, id])));
    setAttendance(a => { const n={...a}; ids.forEach(id => n[id]=status); return n; });
    await Promise.all(ids.map(id => markAttendance(activeSession.id, id, status)));
    setSaving(new Set());
  };

  // Calendar grid
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const byDate      = {};
  sessions.forEach(s => { if (!byDate[s.date]) byDate[s.date] = []; byDate[s.date].push(s); });
  const todayStr    = now.toISOString().split("T")[0];
  const cells       = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const scheduledDays = new Set((group.schedule||[]).map(s => s.day));
  const schedByDay    = Object.fromEntries((group.schedule||[]).map(s => [s.day, s]));

  const enrolledStudents = enrolled.map(e => sMap[e.student_id]).filter(Boolean);

  if (activeSession) {
    const counts = { present:0, absent:0, late:0, excused:0 };
    Object.values(attendance).forEach(s => { if (counts[s] !== undefined) counts[s]++; });
    const rate = enrolledStudents.length
      ? Math.round(((counts.present+counts.late)/enrolledStudents.length)*100) : 0;

    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <button style={btn("ghost",{padding:"6px 10px"})} onClick={() => setActiveSession(null)}>
            <ChevronLeft size={14}/>
          </button>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:"#151313" }}>{activeSession.title || "Class"}</div>
            <div style={{ fontSize:12, color:"#94A3B8" }}>
              {fmtDate(activeSession.date)}{activeSession.start_time?` · ${activeSession.start_time.slice(0,5)}`:""}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))", gap:10, marginBottom:14 }}>
          {[{l:"Present",v:counts.present,c:"#10B981"},{l:"Absent",v:counts.absent,c:"#EF4444"},
            {l:"Late",v:counts.late,c:"#F59E0B"},{l:"Rate",v:`${rate}%`,c:"#2D5DDC"}].map(({l,v,c})=>(
            <div key={l} style={{...card({padding:"12px 14px",textAlign:"center"})}}>
              <div style={{fontSize:20,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:11,color:"#94A3B8"}}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:12, color:"#94A3B8" }}>Mark all:</span>
          {Object.entries(ATTENDANCE_CFG).map(([st,cf]) => (
            <button key={st} style={{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
              border:"none", background:cf.bg, color:cf.color }} onClick={() => markAll(st)}>{cf.label}</button>
          ))}
        </div>

        <div style={{ ...card({ padding:0, overflow:"hidden" }) }}>
          {enrolledStudents.map((s, i) => {
            const status = attendance[s.student_id] || "present";
            const cf     = ATTENDANCE_CFG[status];
            const isSaving = saving.has(s.student_id);
            return (
              <div key={s.student_id} style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"11px 16px",
                borderBottom: i < enrolledStudents.length-1 ? `1px solid ${"#E2E6EA"}` : "none",
                background: i%2===0 ? "#FCFCFC" : "#EEEFF1", flexWrap:"wrap", gap:8,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:34,height:34,borderRadius:"50%",background:`${cf.color}20`,color:cf.color,
                    display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,flexShrink:0 }}>
                    {(s.full_name||"?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13, color:"#151313" }}>{s.full_name}</div>
                    <div style={{ fontSize:11, color:"#94A3B8" }}>{s.email}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                  {isSaving && <Loader size={13} color={"#2D5DDC"} style={{ animation:"spin 1s linear infinite", marginRight:2 }}/>}
                  {Object.entries(ATTENDANCE_CFG).map(([st, c]) => {
                    const active = status === st;
                    return (
                      <button key={st}
                        title={c.label}
                        style={{ width:30,height:30,borderRadius:7,border:"none",cursor:"pointer",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          background:active?c.bg:"#EEEFF1",
                          outline:`1px solid ${active?c.color+"80":"#E2E6EA"}`,
                          opacity:isSaving?0.5:1 }}
                        onClick={() => !isSaving && markOne(s.student_id, st)}>
                        <c.Icon size={13} color={active?c.color:"#94A3B8"}/>
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

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <button style={btn("ghost",{padding:"5px 8px"})} onClick={() => {
            if (calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);
          }}><ChevronLeft size={14}/></button>
          <span style={{ fontWeight:700, fontSize:15, color:"#151313", minWidth:160, textAlign:"center" }}>
            {MONTHS_[calMonth]} {calYear}
          </span>
          <button style={btn("ghost",{padding:"5px 8px"})} onClick={() => {
            if (calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);
          }}><ChevronLeft size={14} style={{transform:"rotate(180deg)"}}/></button>
        </div>
        <button style={btn("primary",{fontSize:12})} onClick={() => setModal(true)}>
          <Plus size={13}/> New Session
        </button>
      </div>

      {/* Calendar */}
      <div style={{ ...card({ padding:"16px 18px", marginBottom:16 }) }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:6 }}>
          {DAYS_.map(d => <div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:"#94A3B8" }}>{d}</div>)}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`}/>;
            const ds     = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const dss    = byDate[ds] || [];
            const isTd   = ds === todayStr;
            const dayOfW = new Date(ds).getDay();
            const isSched = scheduledDays.has(dayOfW);
            const slot    = schedByDay[dayOfW];
            return (
              <div key={day} style={{ minHeight:56, borderRadius:6, padding:"4px 5px",
                border:`1px solid ${isTd?(group.color||"#2D5DDC"):isSched?`${group.color||"#2D5DDC"}50`:"#E2E6EA"}`,
                background:isTd?`${group.color||"#2D5DDC"}15`:isSched?`${group.color||"#2D5DDC"}06`:"#EEEFF1" }}>
                <div style={{ fontSize:11, fontWeight:isTd?800:500, color:isTd?group.color||"#2D5DDC":"#64748B" }}>{day}</div>
                {isSched && dss.length===0 && (
                  <div style={{ fontSize:8, color:`${group.color||"#2D5DDC"}80`, marginTop:2, lineHeight:1.2 }}>
                    {slot.start.slice(0,5)}
                  </div>
                )}
                {dss.map(s => (
                  <div key={s.id} style={{ fontSize:9, fontWeight:700, padding:"1px 4px", borderRadius:3, marginTop:2,
                    background:`${group.color||"#2D5DDC"}25`, color:group.color||"#2D5DDC", cursor:"pointer",
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                    onClick={() => openSession(s)}>
                    {s.start_time?s.start_time.slice(0,5):""} {s.title||"◉"}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sessions list */}
      {sessions.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {sessions.map(s => (
            <div key={s.id} style={{ ...card({ padding:"12px 16px" }),
              display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:13, color:"#151313" }}>{s.title||"Class"}</div>
                <div style={{ fontSize:11, color:"#94A3B8" }}>
                  {fmtDate(s.date)}{s.start_time?` · ${s.start_time.slice(0,5)}${s.end_time?`–${s.end_time.slice(0,5)}`:""}`:""}
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button style={btn("primary",{fontSize:12,padding:"5px 11px"})} onClick={() => openSession(s)}>
                  <Users size={12}/> Attendance
                </button>
                <button style={btn("danger",{fontSize:12,padding:"5px 8px"})} onClick={async () => {
                  if (!window.confirm("Delete this session?")) return;
                  await deleteSession(s.id); load();
                }}><Trash2 size={12}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sessions.length === 0 && (
        <div style={{ ...card({ padding:40, textAlign:"center" }) }}>
          <CalendarDays size={36} color={"#94A3B8"} style={{ marginBottom:10 }}/>
          <div style={{ color:"#94A3B8", fontSize:13 }}>No sessions this month. Create one to start tracking attendance.</div>
        </div>
      )}

      {modal && (
        <SessionModal group={group}
          onSave={async d => { await createSession({ ...d, group_id:group.id }); setModal(false); load(); }}
          onClose={() => setModal(false)}/>
      )}
    </div>
  );
}

// ── Materials Tab ─────────────────────────────────────────────────────────────
function MaterialsTab({ groupId }) {
  const [items,    setItems]    = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ title:"", type:"text", content:"" });
  const [saving,   setSaving]   = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    tryOrMock(getMaterials, mockGetMaterials, groupId).then(m => { setItems(m); setLoading(false); });
  }, [groupId]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await tryOrMock(createMaterial, mockCreateMaterial, { ...form, group_id: groupId });
    setForm({ title:"", type:"text", content:"" }); setShowForm(false);
    tryOrMock(getMaterials, mockGetMaterials, groupId).then(setItems); setSaving(false);
  };

  if (loading) return <Spin/>;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
        <button style={btn("primary",{fontSize:12})} onClick={() => setShowForm(v=>!v)}><Plus size={13}/> Add Material</button>
      </div>

      {showForm && (
        <div style={{ ...card({ padding:"16px 18px", marginBottom:14 }) }}>
          <label style={lbl}>Title</label>
          <input style={inp} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Unit 3 Notes"/>
          <label style={lbl}>Type</label>
          <select style={inp} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value,content:""}))}>
            <option value="text">Text / Note</option>
            <option value="link">Link / URL</option>
          </select>
          <label style={lbl}>{form.type==="link"?"URL":"Content"}</label>
          {form.type==="link"
            ? <input style={inp} value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} placeholder="https://…"/>
            : <textarea style={{...inp,height:90,resize:"vertical"}} value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))}/>}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:12 }}>
            <button style={btn("ghost")} onClick={() => setShowForm(false)}>Cancel</button>
            <button style={btn("primary")} onClick={save} disabled={saving||!form.title.trim()}>
              {saving?<Loader size={13} style={{animation:"spin 1s linear infinite"}}/>:<Save size={13}/>} Save
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !showForm && (
        <div style={{ ...card({ padding:36, textAlign:"center" }) }}>
          <BookOpen size={32} color={"#94A3B8"} style={{ marginBottom:8 }}/>
          <div style={{ color:"#94A3B8", fontSize:13 }}>No materials yet</div>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {items.map(m => (
          <div key={m.id} style={{ ...card({ padding:"13px 16px" }),
            display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:13, color:"#151313", marginBottom:2 }}>{m.title}</div>
              <div style={{ fontSize:11, color:"#94A3B8", marginBottom:4 }}>{m.type==="link"?"Link":"Note"}</div>
              {m.type==="link"
                ? <a href={m.content} target="_blank" rel="noreferrer"
                    style={{ fontSize:12, color:"#2D5DDC", display:"inline-flex", alignItems:"center", gap:4 }}>
                    <ExternalLink size={11}/>{m.content}
                  </a>
                : <div style={{ fontSize:12, color:"#64748B", whiteSpace:"pre-wrap", lineHeight:1.5 }}>{m.content}</div>}
            </div>
            <button style={btn("danger",{padding:"5px 7px",flexShrink:0})}
              onClick={async () => { if(!window.confirm("Delete?"))return; await tryOrMock(deleteMaterial, mockDeleteMaterial, m.id); tryOrMock(getMaterials, mockGetMaterials, groupId).then(setItems); }}>
              <Trash2 size={12}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────
function TasksTab({ groupId, allStudents }) {
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form,    setForm]    = useState({ title:"", description:"", due_date:"", max_score:100 });
  const [saving,  setSaving]  = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [subs,    setSubs]    = useState({});

  const sMap = Object.fromEntries(allStudents.map(s => [s.student_id, s]));

  useEffect(() => { tryOrMock(getTasks, mockGetTasks, groupId).then(t => { setTasks(t); setLoading(false); }); }, [groupId]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await tryOrMock(createTask, mockCreateTask, { ...form, group_id: groupId, max_score: +form.max_score||100 });
    setForm({ title:"", description:"", due_date:"", max_score:100 }); setShowForm(false);
    tryOrMock(getTasks, mockGetTasks, groupId).then(setTasks); setSaving(false);
  };

  const loadSubs = async (id) => {
    if (expanded===id) { setExpanded(null); return; }
    const s = await getTaskSubmissions(id);
    setSubs(x => ({...x, [id]: s})); setExpanded(id);
  };

  if (loading) return <Spin/>;

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
        <button style={btn("primary",{fontSize:12})} onClick={() => setShowForm(v=>!v)}><Plus size={13}/> Add Task</button>
      </div>

      {showForm && (
        <div style={{ ...card({ padding:"16px 18px", marginBottom:14 }) }}>
          <label style={lbl}>Title *</label>
          <input style={inp} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Essay — Causes of climate change"/>
          <label style={lbl}>Description</label>
          <textarea style={{...inp,height:70,resize:"vertical"}} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div><label style={lbl}>Due Date</label><input style={inp} type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/></div>
            <div><label style={lbl}>Max Score</label><input style={inp} type="number" value={form.max_score} onChange={e=>setForm(f=>({...f,max_score:e.target.value}))}/></div>
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:12 }}>
            <button style={btn("ghost")} onClick={() => setShowForm(false)}>Cancel</button>
            <button style={btn("primary")} onClick={save} disabled={saving||!form.title.trim()}>
              {saving?<Loader size={13} style={{animation:"spin 1s linear infinite"}}/>:<Save size={13}/>} Save
            </button>
          </div>
        </div>
      )}

      {tasks.length === 0 && !showForm && (
        <div style={{ ...card({ padding:36, textAlign:"center" }) }}>
          <ClipboardList size={32} color={"#94A3B8"} style={{ marginBottom:8 }}/>
          <div style={{ color:"#94A3B8", fontSize:13 }}>No tasks yet</div>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {tasks.map(t => {
          const isExp  = expanded === t.id;
          const taskSubs = subs[t.id] || [];
          const overdue = t.due_date && new Date(t.due_date) < new Date();
          return (
            <div key={t.id} style={card({ padding:0, overflow:"hidden" })}>
              <div style={{ padding:"13px 16px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:700, fontSize:13, color:"#151313" }}>{t.title}</span>
                    {overdue && <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:20, background:"#FEE2E2", color:"#EF4444" }}>Overdue</span>}
                  </div>
                  {t.description && <div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>{t.description}</div>}
                  <div style={{ fontSize:11, color:"#94A3B8" }}>
                    {t.due_date && `Due ${t.due_date} · `}Max {t.max_score} pts
                  </div>
                </div>
                <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                  <button style={btn("ghost",{fontSize:12,padding:"5px 10px"})} onClick={() => loadSubs(t.id)}>
                    {isExp?<ChevronUp size={12}/>:<ChevronDown size={12}/>} Submissions
                  </button>
                  <button style={btn("danger",{padding:"5px 7px"})} onClick={async () => {
                    if(!window.confirm("Delete task?"))return; await deleteTask(t.id); getTasks(groupId).then(setTasks);
                  }}><Trash2 size={12}/></button>
                </div>
              </div>
              {isExp && (
                <div style={{ borderTop:`1px solid ${"#E2E6EA"}`, background:"#EEEFF1", padding:"12px 16px" }}>
                  {taskSubs.length===0 && <div style={{ color:"#94A3B8", fontSize:12 }}>No submissions yet.</div>}
                  {taskSubs.map(sub => {
                    const [score, setScore] = [sub.score, null];
                    const st = sMap[sub.student_id];
                    return (
                      <GradeRow key={sub.id} sub={sub} student={st} maxScore={t.max_score}
                        onGrade={async (s,f) => {
                          await gradeSubmission(t.id, sub.student_id, s, f);
                          const updated = await getTaskSubmissions(t.id);
                          setSubs(x => ({...x,[t.id]:updated}));
                        }}/>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GradeRow({ sub, student, maxScore, onGrade }) {
  const [edit,     setEdit]     = useState(false);
  const [score,    setScore]    = useState(sub.score ?? "");
  const [feedback, setFeedback] = useState(sub.feedback || "");
  const [saving,   setSaving]   = useState(false);
  return (
    <div style={{ borderBottom:`1px solid ${"#E2E6EA"}`, paddingBottom:10, marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
        <span style={{ fontWeight:600, fontSize:13, color:"#151313" }}>{student?.full_name || sub.student_id}</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {sub.score != null && <span style={{ fontWeight:800, fontSize:13, color:"#2D5DDC" }}>{sub.score}/{maxScore}</span>}
          <button style={btn("ghost",{fontSize:11,padding:"3px 8px"})} onClick={() => setEdit(v=>!v)}>
            <Edit2 size={11}/>{edit?"Cancel":"Grade"}
          </button>
        </div>
      </div>
      {sub.content && <div style={{ fontSize:12, color:"#64748B", whiteSpace:"pre-wrap", marginBottom:4 }}>{sub.content}</div>}
      {edit && (
        <div style={{ display:"flex", gap:8, alignItems:"flex-end", flexWrap:"wrap" }}>
          <input style={{...inp,width:70}} type="number" min={0} max={maxScore} value={score} onChange={e=>setScore(e.target.value)} placeholder={`/${maxScore}`}/>
          <input style={{...inp,flex:1,minWidth:120}} placeholder="Feedback…" value={feedback} onChange={e=>setFeedback(e.target.value)}/>
          <button style={btn("primary",{padding:"9px 12px"})} onClick={async () => {
            setSaving(true);
            await onGrade(score===""?null:+score, feedback); setEdit(false); setSaving(false);
          }} disabled={saving}>
            {saving?<Loader size={13} style={{animation:"spin 1s linear infinite"}}/>:<Check size={13}/>}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Group Modal (create / edit) ───────────────────────────────────────────────
function addMonths(dateStr, n) {
  const d = new Date(dateStr); d.setMonth(d.getMonth() + n); d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function GroupModal({ group, teachers, onSave, onClose }) {
  const [form, setForm] = useState({
    name:               group?.name               || "",
    level:              group?.level              || "",
    teacher_username:   group?.teacher_username   || "",
    color:              group?.color              || GROUP_COLORS[0],
    description:        group?.description        || "",
    max_students:       group?.max_students       || 20,
    period_start:       group?.period_start       || firstOfMonth(),
    period_end:         group?.period_end         || addMonths(group?.period_start || firstOfMonth(), 1),
    payment_mode:       group?.payment_mode       || "monthly",
    classes_per_cycle:  group?.classes_per_cycle  || 8,
    payment_amount:     group?.payment_amount     || "",
    payment_currency:   group?.payment_currency   || "AMD",
    schedule:           group?.schedule           || [],
    status:             group?.status             || "active",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  // auto-update end when start changes (only if end hasn't been manually set)
  const handleStartChange = (val) => {
    const newEnd = addMonths(val, 1);
    setForm(f => ({ ...f, period_start: val, period_end: f.period_end === addMonths(f.period_start, 1) ? newEnd : f.period_end }));
  };

  // compute classes-per-week for preview
  const classesPerWeek = form.schedule.length;
  const weeksInRange = form.period_start && form.period_end
    ? Math.round((new Date(form.period_end) - new Date(form.period_start)) / (7 * 864e5))
    : 0;
  const totalClasses = classesPerWeek * weeksInRange;
  const cyclesCount = form.payment_mode === "per_classes" && +form.classes_per_cycle > 0
    ? Math.ceil(totalClasses / +form.classes_per_cycle)
    : null;

  const save = async () => {
    if (!form.name.trim()) { setErr("Name is required"); return; }
    if (!form.period_start || !form.period_end) { setErr("Start and end dates are required"); return; }
    if (form.period_end <= form.period_start) { setErr("End date must be after start date"); return; }
    setSaving(true); setErr("");
    try {
      await onSave({
        ...form,
        teacher_username:  form.teacher_username || null,
        max_students:      +form.max_students,
        classes_per_cycle: +form.classes_per_cycle,
        payment_amount:    form.payment_amount ? +form.payment_amount : null,
      });
    } catch(e) { setErr(e.message||"Failed"); setSaving(false); }
  };

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ margin:"0 0 20px", fontSize:17, fontWeight:800, color:"#151313" }}>
        {group ? "Edit Group" : "New Group"}
      </h3>

      <label style={lbl}>Group Name *</label>
      <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Morning IELTS B2"/>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div>
          <label style={lbl}>Level</label>
          <select style={inp} value={form.level} onChange={e=>setForm(f=>({...f,level:e.target.value}))}>
            <option value="">— none —</option>
            {LEVELS.map(l=><option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Max Students</label>
          <input style={inp} type="number" min={1} max={100} value={form.max_students} onChange={e=>setForm(f=>({...f,max_students:e.target.value}))}/>
        </div>
      </div>

      <label style={lbl}>Teacher (from Staff)</label>
      <select style={inp} value={form.teacher_username||""} onChange={e=>setForm(f=>({...f,teacher_username:e.target.value}))}>
        <option value="">— Unassigned —</option>
        {teachers.map(t=><option key={t.username} value={t.username}>{t.username}{t.role?" ("+t.role+")":""}</option>)}
      </select>

      <label style={lbl}>Description</label>
      <textarea style={{...inp,height:60,resize:"vertical"}} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Optional…"/>

      {/* Date range */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div>
          <label style={lbl}>Start Date</label>
          <input style={inp} type="date" value={form.period_start} onChange={e=>handleStartChange(e.target.value)}/>
        </div>
        <div>
          <label style={lbl}>End Date</label>
          <input style={inp} type="date" value={form.period_end} onChange={e=>setForm(f=>({...f,period_end:e.target.value}))}/>
        </div>
      </div>
      {form.period_start && form.period_end && form.period_end > form.period_start && (
        <div style={{ fontSize:11, color:"#94A3B8", marginTop:4, marginBottom:4 }}>
          {weeksInRange} weeks
          {classesPerWeek > 0 ? ` · ${totalClasses} total classes (${classesPerWeek}×/week)` : ""}
        </div>
      )}

      {/* Payment cycle */}
      <label style={{ ...lbl, marginTop:16 }}>Payment Cycle</label>
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        {[["monthly","Monthly (per month)"],["per_classes","Per N classes"]].map(([v, label]) => (
          <button key={v} onClick={()=>setForm(f=>({...f,payment_mode:v}))} style={{
            padding:"7px 14px", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer", border:"none",
            background: form.payment_mode===v ? (form.color||"#2D5DDC") : "#EEEFF1",
            color:      form.payment_mode===v ? "#fff" : "#64748B",
            outline:    `1px solid ${form.payment_mode===v ? "transparent" : "#E2E6EA"}`,
          }}>{label}</button>
        ))}
      </div>

      {form.payment_mode === "per_classes" && (
        <div style={{ ...card({padding:"12px 14px", marginBottom:10, background:"#F8FAFC"}) }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:12, color:"#64748B" }}>Charge after every</span>
            <input type="number" min={1} max={99} value={form.classes_per_cycle}
              onChange={e=>setForm(f=>({...f,classes_per_cycle:e.target.value}))}
              style={{ ...inp, width:64, padding:"5px 8px", fontSize:13 }}/>
            <span style={{ fontSize:12, color:"#64748B" }}>classes</span>
          </div>
          {cyclesCount !== null && totalClasses > 0 && (
            <div style={{ fontSize:11, color:"#2D5DDC", marginTop:8, fontWeight:600 }}>
              → {cyclesCount} payment{cyclesCount!==1?"s":""}  over the group period ({totalClasses} classes ÷ {form.classes_per_cycle})
            </div>
          )}
        </div>
      )}

      {/* Amount */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8 }}>
        <div>
          <label style={lbl}>Amount per {form.payment_mode==="per_classes"?`${form.classes_per_cycle} classes`:"month"}</label>
          <input style={inp} type="number" min={0} value={form.payment_amount}
            onChange={e=>setForm(f=>({...f,payment_amount:e.target.value}))}
            placeholder="e.g. 45000"/>
        </div>
        <div>
          <label style={lbl}>Currency</label>
          <select style={{...inp,width:90}} value={form.payment_currency} onChange={e=>setForm(f=>({...f,payment_currency:e.target.value}))}>
            <option value="AMD">AMD</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      <label style={lbl}>Weekly Schedule</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
        {DAY_NAMES.map((d, i) => {
          const has = form.schedule.find(s => s.day === i);
          return (
            <button key={i} style={{
              padding:"4px 10px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer", border:"none",
              background: has ? `${form.color||GROUP_COLORS[0]}20` : "#EEEFF1",
              color: has ? (form.color||GROUP_COLORS[0]) : "#94A3B8",
              outline: `1px solid ${has ? (form.color||GROUP_COLORS[0]) : "#E2E6EA"}`,
            }} onClick={() => {
              if (has) setForm(f => ({ ...f, schedule: f.schedule.filter(s => s.day !== i) }));
              else setForm(f => ({ ...f, schedule: [...f.schedule, { day:i, start:"09:00", end:"10:30" }].sort((a,b)=>a.day-b.day) }));
            }}>{d}</button>
          );
        })}
      </div>
      {form.schedule.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
          {form.schedule.map(slot => (
            <div key={slot.day} style={{ display:"flex", alignItems:"center", gap:8, background:"#EEEFF1", border:`1px solid ${"#E2E6EA"}`, borderRadius:8, padding:"6px 10px" }}>
              <span style={{ fontSize:12, fontWeight:700, color:form.color||GROUP_COLORS[0], width:32 }}>{DAY_NAMES[slot.day]}</span>
              <input type="time" value={slot.start} style={{ ...inp, width:100, padding:"4px 8px", fontSize:12 }}
                onChange={e => setForm(f => ({ ...f, schedule: f.schedule.map(s => s.day===slot.day?{...s,start:e.target.value}:s) }))}/>
              <span style={{ fontSize:11, color:"#94A3B8" }}>to</span>
              <input type="time" value={slot.end} style={{ ...inp, width:100, padding:"4px 8px", fontSize:12 }}
                onChange={e => setForm(f => ({ ...f, schedule: f.schedule.map(s => s.day===slot.day?{...s,end:e.target.value}:s) }))}/>
            </div>
          ))}
        </div>
      )}

      <label style={lbl}>Color</label>
      <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:12 }}>
        {GROUP_COLORS.map(c=>(
          <button key={c} style={{ width:26,height:26,borderRadius:"50%",background:c,border:`3px solid ${form.color===c?"#fff":"transparent"}`,
            outline:`2px solid ${form.color===c?c:"transparent"}`,cursor:"pointer" }}
            onClick={()=>setForm(f=>({...f,color:c}))}/>
        ))}
      </div>

      {group && (
        <>
          <label style={lbl}>Status</label>
          <select style={{...inp,marginBottom:12}} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </>
      )}

      {err && <div style={{ color:"#EF4444", fontSize:12, marginBottom:10 }}>{err}</div>}
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <button style={btn("ghost")} onClick={onClose}>Cancel</button>
        <button style={btn("primary")} onClick={save} disabled={saving}>
          {saving?<Loader size={14} style={{animation:"spin 1s linear infinite"}}/>:<Save size={14}/>}
          {saving?"Saving…":"Save Group"}
        </button>
      </div>
    </Overlay>
  );
}

// ── Session Modal ─────────────────────────────────────────────────────────────
function SessionModal({ group, onSave, onClose }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ title:"", date:today, start_time:"09:00", end_time:"10:30", notes:"" });
  const [saving, setSaving] = useState(false);
  return (
    <Overlay onClose={onClose}>
      <h3 style={{ margin:"0 0 18px", fontSize:16, fontWeight:800, color:"#151313" }}>New Session · {group.name}</h3>
      <label style={lbl}>Title (optional)</label>
      <input style={inp} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Grammar, Speaking…"/>
      <label style={lbl}>Date *</label>
      <input style={inp} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div><label style={lbl}>Start</label><input style={inp} type="time" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))}/></div>
        <div><label style={lbl}>End</label><input style={inp} type="time" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))}/></div>
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:16 }}>
        <button style={btn("ghost")} onClick={onClose}>Cancel</button>
        <button style={btn("primary")} onClick={async () => {
          setSaving(true); await onSave(form);
        }} disabled={saving}>
          {saving?<Loader size={14} style={{animation:"spin 1s linear infinite"}}/>:<Save size={14}/>}
          {saving?"Saving…":"Save"}
        </button>
      </div>
    </Overlay>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function Overlay({ children, onClose }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:1000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"#FCFCFC",borderRadius:10,padding:"24px 26px",width:"100%",maxWidth:460,
        maxHeight:"90vh",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,.14)" }}>
        {children}
      </div>
    </div>
  );
}

function Spin() {
  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",padding:80 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Loader size={28} color={"#2D5DDC"} style={{ animation:"spin 1s linear infinite" }}/>
    </div>
  );
}
