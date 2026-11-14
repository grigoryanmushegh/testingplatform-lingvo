import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, User, GraduationCap, Eye, EyeOff, RefreshCw, LogIn, Database } from "lucide-react";
import { hashStudentPassword, getTestStudents, saveTestStudents, setStudentSession } from "../../lib/studentAuth.js";
import { hashPassword, loadDB, saveDB } from "../../lib/db.js";
import { setTeacherSession } from "../../lib/teacherAuth.js";

const AD = {
  blue:"#2D5DDC", blueLt:"#EBF0FF", blueDk:"#1a3fa8",
  bg:"#EEEFF1", surface:"#FCFCFC", border:"#E2E6EA",
  text:"#151313", sub:"#64748B", muted:"#94A3B8",
  green:"#10B981", greenLt:"#D1FAE5",
  amber:"#F59E0B", amberLt:"#FEF3C7",
  red:"#EF4444", redLt:"#FEE2E2",
};

function uid() { return Math.random().toString(36).slice(2, 10).toUpperCase(); }
function studentId() { return "TST" + Math.floor(1000 + Math.random() * 9000); }

const DEFAULT_STUDENTS = [
  { username:"test.student", full_name:"Test Student", email:"test@local.dev", password:"Test1234" },
  { username:"aria.chen",    full_name:"Aria Chen",    email:"aria@local.dev",  password:"Test1234" },
  { username:"luca.ross",    full_name:"Luca Ross",    email:"luca@local.dev",  password:"Test1234" },
];
const DEFAULT_TEACHERS = [
  { username:"test.teacher", displayName:"Test Teacher", password:"Teach1234" },
];

export default function DevSetupPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [msg, setMsg] = useState("");
  const [showPw, setShowPw] = useState({});

  // Student form
  const [sForm, setSForm] = useState({ username:"", full_name:"", email:"", password:"" });
  // Teacher form
  const [tForm, setTForm] = useState({ username:"", displayName:"", password:"" });

  useEffect(() => { reload(); }, []);

  function reload() {
    setStudents(getTestStudents());
    const db = loadDB();
    setTeachers((db.adminUsers||[]).filter(u => u.role === "teacher"));
  }

  function flash(m) { setMsg(m); setTimeout(() => setMsg(""), 3000); }

  async function seedDefaults() {
    // Students
    const existing = getTestStudents();
    const existIds = new Set(existing.map(s => s.username));
    const toAdd = [];
    for (const s of DEFAULT_STUDENTS) {
      if (!existIds.has(s.username)) {
        const hash = await hashStudentPassword(s.password);
        toAdd.push({
          student_id: studentId(), full_name: s.full_name,
          email: s.email, username: s.username,
          password_hash: hash, status:"active", force_pw_change: false,
          created_at: new Date().toISOString(), _isTest: true,
        });
      }
    }
    saveTestStudents([...existing, ...toAdd]);

    // Teachers — update in-memory _db via saveDB so loginTeacher can find them
    const db = loadDB();
    const existTeachers = new Set((db.adminUsers||[]).map(u => u.username));
    let teachersAdded = 0;
    let adminUsers = [...(db.adminUsers||[])];
    for (const t of DEFAULT_TEACHERS) {
      if (!existTeachers.has(t.username)) {
        const hash = await hashPassword(t.password);
        adminUsers.push({ id: uid(), username: t.username, displayName: t.displayName,
          role:"teacher", passwordHash: hash, access:[] });
        teachersAdded++;
      }
    }
    saveDB({ ...db, adminUsers });
    flash(`Seeded ${toAdd.length} students + ${teachersAdded} teachers`);
    reload();
  }

  function seedFakeData() {
    const students = getTestStudents();
    if (!students.length) { flash("Seed default accounts first, then add sample data"); return; }

    // ── per-student fake data ─────────────────────────────────────────────────
    const now = new Date();
    function daysAgo(n)  { const d = new Date(now); d.setDate(d.getDate()-n); return d.toISOString(); }
    function daysAhead(n){ const d = new Date(now); d.setDate(d.getDate()+n); return d.toISOString(); }

    const GROUP_MORNING = { id:"fake_grp_morning", name:"IELTS B2 Morning", level:"B2 / 6.0+", color:"#2D5DDC", status:"active", school_id:"lingvoconnect", created_at:daysAgo(60), schedule:[{ day:2, start:"10:00", end:"12:00" },{ day:4, start:"10:00", end:"12:00" }] };
    const GROUP_EVENING = { id:"fake_grp_evening", name:"IELTS B1 Evening",  level:"B1 / 5.0+", color:"#10B981", status:"active", school_id:"lingvoconnect", created_at:daysAgo(60), schedule:[{ day:1, start:"18:00", end:"19:30" },{ day:3, start:"18:00", end:"19:30" }] };

    const MOCK_TEST_DAY = { day:5, start:"10:00", end:"14:00", is_mock_test_day:true }; // Friday full mock

    const baseAssignments = (sid) => [
      { id:`fake_a1_${sid}`, student_id:sid, status:"completed", suite_name:"IELTS Academic Mock #3", is_week_test:true,  deadline:daysAgo(6),  assigned_at:daysAgo(20), completed_at:daysAgo(6) },
      { id:`fake_a2_${sid}`, student_id:sid, status:"not_started", suite_name:"IELTS Academic Mock #4 — Mock Test", is_week_test:true, is_mock_test_day:true, deadline:daysAhead(7), assigned_at:daysAgo(1) },
      { id:`fake_a3_${sid}`, student_id:sid, status:"not_started", suite_name:"Listening Practice Set 8", is_week_test:false, deadline:daysAhead(3), assigned_at:daysAgo(3) },
    ];
    const attempts = [
      { test_name:"IELTS Academic Mock #3", band_overall:6.5, band_listening:7.0, band_reading:6.5, band_writing:6.0, band_speaking:6.5, submitted_at:daysAgo(6) },
      { test_name:"IELTS Academic Mock #2", band_overall:6.0, band_listening:6.5, band_reading:6.0, band_writing:5.5, band_speaking:6.0, submitted_at:daysAgo(20) },
      { test_name:"IELTS Academic Mock #1", band_overall:5.5, band_listening:6.0, band_reading:5.5, band_writing:5.0, band_speaking:5.5, submitted_at:daysAgo(34) },
    ];
    const materials = [
      { id:"fake_m1", title:"Writing Task 2 — Essay Templates", description:"6 band 7.0+ essay structures with linking devices", file_url:null, created_at:daysAgo(30) },
      { id:"fake_m2", title:"Academic Word List — Unit 5", description:"Collocations and usage exercises", file_url:null, created_at:daysAgo(25) },
      { id:"fake_m3", title:"Listening Practice Audio Set 7", description:"Section 3 lecture-style recording with tapescript", file_url:null, created_at:daysAgo(10) },
    ];
    const tasks = [
      { id:"fake_t1", title:"Write one Task 2 essay (Cambridge 17)", description:"Choose any topic from Test 1 or 2. Focus on coherence and cohesion. 250 words minimum.", due_date:daysAhead(4), created_at:daysAgo(3) },
      { id:"fake_t2", title:"Self-study: AWL chapters 4–6", description:"Complete the exercises at the end of each chapter.", due_date:daysAhead(2), created_at:daysAgo(5) },
    ];

    // Assign students to groups: first 2 → morning, third → evening, rest → morning
    const fd = {};
    students.forEach((s, i) => {
      const group = (i === 2) ? GROUP_EVENING : GROUP_MORNING;
      fd[s.student_id] = {
        groups: [group],
        assignments: baseAssignments(s.student_id),
        attempts,
        materials,
        tasks,
      };
    });
    try { localStorage.setItem("lv_fake_data", JSON.stringify(fd)); } catch {}

    // ── teacher fake data ─────────────────────────────────────────────────────
    const ids = students.map(s => s.student_id);
    const morningIds = ids.filter((_, i) => i !== 2);
    const eveningIds = ids.filter((_, i) => i === 2);
    const fakeTeacher = {
      groups: [
        { ...GROUP_MORNING, schedule: [...GROUP_MORNING.schedule, MOCK_TEST_DAY] },
        GROUP_EVENING,
      ],
      groupStudents: {
        "fake_grp_morning": morningIds.map(sid => ({ student_id:sid, group_id:"fake_grp_morning", status:"active", enrolled_at:daysAgo(55) })),
        "fake_grp_evening": eveningIds.map(sid => ({ student_id:sid, group_id:"fake_grp_evening", status:"active", enrolled_at:daysAgo(55) })),
      },
      sessions: {
        "fake_grp_morning": [
          { id:"fake_sess1", group_id:"fake_grp_morning", date:daysAgo(2),  topic:"Task 2 Essay Structure",           notes:"Covered 4-paragraph plan and linking devices" },
          { id:"fake_sess2", group_id:"fake_grp_morning", date:daysAgo(7),  topic:"Listening Section 3 Strategies",  notes:"Prediction technique and form completion" },
          { id:"fake_sess3", group_id:"fake_grp_morning", date:daysAgo(9),  topic:"Reading Flow Chart Questions",     notes:"" },
          { id:"fake_sess4", group_id:"fake_grp_morning", date:daysAgo(14), topic:"Mock Test Day #3",                 notes:"Full IELTS Academic mock — 3 hrs", is_mock_test_day:true },
          { id:"fake_sess5", group_id:"fake_grp_morning", date:daysAgo(16), topic:"Speaking Part 2 & 3 Practice",    notes:"" },
        ],
        "fake_grp_evening": [
          { id:"fake_sess6", group_id:"fake_grp_evening", date:daysAgo(1),  topic:"Vocabulary Building — AWL",        notes:"" },
          { id:"fake_sess7", group_id:"fake_grp_evening", date:daysAgo(4),  topic:"Reading — True/False/NG",          notes:"" },
        ],
      },
      materials: {
        "fake_grp_morning": materials,
        "fake_grp_evening": [
          { id:"fake_m4", title:"AWL Foundation Wordlist", description:"500 most common academic words", file_url:null, created_at:daysAgo(20) },
          { id:"fake_m5", title:"Reading Skills Workbook Ch. 3–5", description:"Skimming and scanning techniques", file_url:null, created_at:daysAgo(15) },
        ],
      },
      tasks: {
        "fake_grp_morning": tasks,
        "fake_grp_evening": [
          { id:"fake_t3", title:"Learn AWL Unit 3 — 50 words", description:"Write a sentence for each word using the collocations from the handout.", due_date:daysAhead(3), created_at:daysAgo(2) },
        ],
      },
    };
    try { localStorage.setItem("lv_fake_teacher", JSON.stringify(fakeTeacher)); } catch {}

    flash(`Sample data seeded for ${students.length} students & teacher`);
  }

  async function addStudent(e) {
    e.preventDefault();
    if (!sForm.username || !sForm.full_name || !sForm.email || !sForm.password) return;
    const hash = await hashStudentPassword(sForm.password);
    const existing = getTestStudents();
    if (existing.find(s => s.username === sForm.username || s.email === sForm.email)) {
      flash("Username or email already exists"); return;
    }
    saveTestStudents([...existing, {
      student_id: studentId(), full_name: sForm.full_name, email: sForm.email,
      username: sForm.username, password_hash: hash, status:"active",
      force_pw_change: false, created_at: new Date().toISOString(), _isTest: true,
    }]);
    setSForm({ username:"", full_name:"", email:"", password:"" });
    flash("Student added"); reload();
  }

  async function addTeacher(e) {
    e.preventDefault();
    if (!tForm.username || !tForm.displayName || !tForm.password) return;
    const db = loadDB();
    if ((db.adminUsers||[]).find(u => u.username === tForm.username)) {
      flash("Username already exists"); return;
    }
    const hash = await hashPassword(tForm.password);
    saveDB({ ...db, adminUsers: [...(db.adminUsers||[]), {
      id: uid(), username: tForm.username, displayName: tForm.displayName,
      role:"teacher", passwordHash: hash, access:[],
    }]});
    setTForm({ username:"", displayName:"", password:"" });
    flash("Teacher added"); reload();
  }

  function removeStudent(student_id) {
    saveTestStudents(getTestStudents().filter(s => s.student_id !== student_id));
    reload();
  }

  function removeTeacher(id) {
    const db = loadDB();
    saveDB({ ...db, adminUsers: (db.adminUsers||[]).filter(u => u.id !== id) });
    reload();
  }

  return (
    <div style={{ minHeight:"100vh", background:AD.bg, fontFamily:"system-ui,sans-serif" }}>
      {/* dev banner */}
      <div style={{ background:"#1a1a2e", padding:"8px 24px",
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:4,
            background:AD.amber, color:"#000", letterSpacing:".06em", textTransform:"uppercase" }}>Dev</span>
          <span style={{ fontSize:12, color:"rgba(255,255,255,.6)", fontWeight:500 }}>
            Local test accounts only · Never touches the real database
          </span>
        </div>
        <button type="button" onClick={() => navigate("/login")} style={{
          background:"none", border:"1px solid rgba(255,255,255,.2)", cursor:"pointer",
          color:"rgba(255,255,255,.6)", fontSize:11, fontWeight:600, borderRadius:6,
          padding:"3px 10px", display:"flex", alignItems:"center", gap:5,
        }}>
          <LogIn size={11}/> Go to Login
        </button>
      </div>

      <main style={{ maxWidth:900, margin:"0 auto", padding:"32px 20px 60px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          marginBottom:28, flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, color:AD.text, letterSpacing:"-0.04em", margin:0 }}>
              Dev Setup
            </h1>
            <p style={{ fontSize:13, color:AD.muted, margin:"4px 0 0", fontWeight:500 }}>
              Create local test accounts to explore the app without touching real data
            </p>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button type="button" onClick={seedDefaults} style={{
              display:"flex", alignItems:"center", gap:7, padding:"10px 18px",
              borderRadius:10, border:`1.5px solid ${AD.border}`, cursor:"pointer",
              background:AD.surface, color:AD.sub, fontSize:13, fontWeight:700,
            }}>
              <RefreshCw size={14}/> Seed Accounts
            </button>
            <button type="button" onClick={seedFakeData} style={{
              display:"flex", alignItems:"center", gap:7, padding:"10px 18px",
              borderRadius:10, border:"none", cursor:"pointer",
              background:AD.blue, color:"#fff", fontSize:13, fontWeight:700,
            }}>
              <Database size={14}/> Seed Sample Data
            </button>
          </div>
        </div>

        {msg && (
          <div style={{ background:AD.greenLt, border:`1px solid ${AD.green}44`, borderRadius:10,
            padding:"10px 16px", marginBottom:20, fontSize:13, color:AD.green, fontWeight:600 }}>
            {msg}
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
          {/* ── STUDENTS ── */}
          <div>
            <div style={{ background:AD.surface, borderRadius:16, border:`1px solid ${AD.border}`,
              padding:"20px 24px", boxShadow:"0 1px 6px rgba(0,0,0,.04)", marginBottom:16 }}>
              <h2 style={{ fontSize:14, fontWeight:800, color:AD.text,
                letterSpacing:"-0.02em", margin:"0 0 16px",
                display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:AD.blueLt,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <User size={14} color={AD.blue}/>
                </div>
                Add Test Student
              </h2>
              <form onSubmit={addStudent} style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  ["Username", "username", "text", "e.g. jane.doe"],
                  ["Full name", "full_name", "text", "e.g. Jane Doe"],
                  ["Email", "email", "email", "e.g. jane@local.dev"],
                  ["Password", "password", "password", "min 6 chars"],
                ].map(([label, key, type, ph]) => (
                  <div key={key}>
                    <label style={{ fontSize:10, fontWeight:700, color:AD.sub,
                      letterSpacing:".06em", textTransform:"uppercase", display:"block", marginBottom:4 }}>
                      {label}
                    </label>
                    <input type={type} placeholder={ph} value={sForm[key]}
                      onChange={e => setSForm(f => ({...f, [key]: e.target.value}))}
                      style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px",
                        borderRadius:9, border:`1.5px solid ${AD.border}`, fontSize:13,
                        color:AD.text, background:AD.surface, outline:"none", fontFamily:"inherit" }}
                      onFocus={e => e.target.style.borderColor = AD.blue}
                      onBlur={e => e.target.style.borderColor = AD.border}
                    />
                  </div>
                ))}
                <button type="submit" style={{ marginTop:4, padding:"9px", borderRadius:9,
                  border:"none", cursor:"pointer", background:AD.blue, color:"#fff",
                  fontSize:13, fontWeight:700, display:"flex", alignItems:"center",
                  justifyContent:"center", gap:7 }}>
                  <Plus size={14}/> Add Student
                </button>
              </form>
            </div>

            {/* student list */}
            {students.length > 0 && (
              <div style={{ background:AD.surface, borderRadius:14, border:`1px solid ${AD.border}`,
                padding:"16px 20px", boxShadow:"0 1px 6px rgba(0,0,0,.04)" }}>
                <div style={{ fontSize:11, fontWeight:700, color:AD.muted,
                  textTransform:"uppercase", letterSpacing:".06em", marginBottom:12 }}>
                  {students.length} Test Student{students.length !== 1 ? "s" : ""}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {students.map(s => (
                    <div key={s.student_id} style={{ display:"flex", alignItems:"center",
                      gap:10, padding:"10px 12px", background:AD.bg, borderRadius:9,
                      border:`1px solid ${AD.border}` }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:AD.text }}>{s.full_name}</div>
                        <div style={{ fontSize:11, color:AD.muted, marginTop:1 }}>
                          @{s.username} · {s.student_id}
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:6 }}>
                        <button type="button"
                          onClick={() => { setStudentSession(s); navigate("/student"); }}
                          style={{ fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:6,
                            border:"none", cursor:"pointer", background:AD.blue, color:"#fff",
                            display:"flex", alignItems:"center", gap:4 }}>
                          <LogIn size={10}/> Login
                        </button>
                        <button type="button"
                          onClick={() => navigate(`/preview/${s.student_id}`)}
                          style={{ fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:6,
                            border:"none", cursor:"pointer", background:AD.blueLt, color:AD.blue }}>
                          Preview
                        </button>
                        <button type="button" onClick={() => removeStudent(s.student_id)}
                          style={{ background:"none", border:"none", cursor:"pointer",
                            color:AD.muted, display:"flex", alignItems:"center", padding:4 }}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── TEACHERS ── */}
          <div>
            <div style={{ background:AD.surface, borderRadius:16, border:`1px solid ${AD.border}`,
              padding:"20px 24px", boxShadow:"0 1px 6px rgba(0,0,0,.04)", marginBottom:16 }}>
              <h2 style={{ fontSize:14, fontWeight:800, color:AD.text,
                letterSpacing:"-0.02em", margin:"0 0 16px",
                display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:AD.greenLt,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <GraduationCap size={14} color={AD.green}/>
                </div>
                Add Test Teacher
              </h2>
              <form onSubmit={addTeacher} style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  ["Username", "username", "text", "e.g. test.teacher"],
                  ["Display name", "displayName", "text", "e.g. Ms. Johnson"],
                  ["Password", "password", "password", "min 6 chars"],
                ].map(([label, key, type, ph]) => (
                  <div key={key}>
                    <label style={{ fontSize:10, fontWeight:700, color:AD.sub,
                      letterSpacing:".06em", textTransform:"uppercase", display:"block", marginBottom:4 }}>
                      {label}
                    </label>
                    <input type={type} placeholder={ph} value={tForm[key]}
                      onChange={e => setTForm(f => ({...f, [key]: e.target.value}))}
                      style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px",
                        borderRadius:9, border:`1.5px solid ${AD.border}`, fontSize:13,
                        color:AD.text, background:AD.surface, outline:"none", fontFamily:"inherit" }}
                      onFocus={e => e.target.style.borderColor = AD.blue}
                      onBlur={e => e.target.style.borderColor = AD.border}
                    />
                  </div>
                ))}
                <button type="submit" style={{ marginTop:4, padding:"9px", borderRadius:9,
                  border:"none", cursor:"pointer", background:AD.green, color:"#fff",
                  fontSize:13, fontWeight:700, display:"flex", alignItems:"center",
                  justifyContent:"center", gap:7 }}>
                  <Plus size={14}/> Add Teacher
                </button>
              </form>
            </div>

            {/* teacher list */}
            {teachers.length > 0 && (
              <div style={{ background:AD.surface, borderRadius:14, border:`1px solid ${AD.border}`,
                padding:"16px 20px", boxShadow:"0 1px 6px rgba(0,0,0,.04)" }}>
                <div style={{ fontSize:11, fontWeight:700, color:AD.muted,
                  textTransform:"uppercase", letterSpacing:".06em", marginBottom:12 }}>
                  {teachers.length} Test Teacher{teachers.length !== 1 ? "s" : ""}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {teachers.map(t => (
                    <div key={t.id} style={{ display:"flex", alignItems:"center",
                      gap:10, padding:"10px 12px", background:AD.bg, borderRadius:9,
                      border:`1px solid ${AD.border}` }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:AD.text }}>{t.displayName}</div>
                        <div style={{ fontSize:11, color:AD.muted, marginTop:1 }}>@{t.username}</div>
                      </div>
                      <button type="button"
                        onClick={() => { setTeacherSession({ id: t.id, username: t.username, displayName: t.displayName, role: t.role, access: t.access||[] }); navigate("/teacher"); }}
                        style={{ fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:6,
                          border:"none", cursor:"pointer", background:AD.green, color:"#fff",
                          display:"flex", alignItems:"center", gap:4 }}>
                        <LogIn size={10}/> Login
                      </button>
                      <button type="button" onClick={() => removeTeacher(t.id)}
                        style={{ background:"none", border:"none", cursor:"pointer",
                          color:AD.muted, display:"flex", alignItems:"center", padding:4 }}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* usage guide */}
            <div style={{ background:AD.surface, borderRadius:14, border:`1.5px dashed ${AD.border}`,
              padding:"18px 20px", marginTop:16 }}>
              <div style={{ fontSize:12, fontWeight:800, color:AD.text, marginBottom:10 }}>How to use</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[
                  ["Student login", "Click Login button next to a student below"],
                  ["Teacher login", "Click Login button next to a teacher below"],
                  ["Student preview", "Click Preview to see their demo page"],
                  ["Admin panel", "Go to /admin (separate login)"],
                ].map(([title, desc]) => (
                  <div key={title} style={{ display:"flex", gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:AD.blue, minWidth:100 }}>{title}</span>
                    <span style={{ fontSize:11, color:AD.muted }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* quick links */}
        <div style={{ marginTop:28, background:AD.surface, borderRadius:14,
          border:`1px solid ${AD.border}`, padding:"16px 20px",
          display:"flex", gap:10, flexWrap:"wrap" }}>
          {[
            ["/login", "Login page"],
            ["/student", "Student dashboard"],
            ["/teacher", "Teacher dashboard"],
            ["/admin", "Admin panel"],
          ].map(([path, label]) => (
            <button key={path} type="button" onClick={() => navigate(path)} style={{
              padding:"7px 16px", borderRadius:8, border:`1.5px solid ${AD.border}`,
              background:"none", cursor:"pointer", fontSize:12, fontWeight:700,
              color:AD.sub, display:"flex", alignItems:"center", gap:6,
            }}>
              <LogIn size={11}/> {label}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
