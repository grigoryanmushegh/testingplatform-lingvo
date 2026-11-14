// ── Dev mock data for LMS — used when Supabase tables don't exist yet ─────────
// Persists attendance/materials/tasks in localStorage so state survives refresh.

const STORE_KEY = "lc_lms_dev_mock";

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function save(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
}
function get(key, def) { const s = load(); return s[key] ?? def; }
function set(key, val)  { const s = load(); s[key] = val; save(s); }

// ── Fake students ─────────────────────────────────────────────────────────────
export const MOCK_STUDENTS = [
  { student_id:"mock_s1", full_name:"Ani Petrosyan",   email:"ani@example.com",    status:"active" },
  { student_id:"mock_s2", full_name:"Aram Gevorgyan",  email:"aram@example.com",   status:"active" },
  { student_id:"mock_s3", full_name:"Nare Hakobyan",   email:"nare@example.com",   status:"active" },
  { student_id:"mock_s4", full_name:"Tigran Sargsyan", email:"tigran@example.com", status:"active" },
  { student_id:"mock_s5", full_name:"Lusine Vardanyan",email:"lusine@example.com", status:"active" },
  { student_id:"mock_s6", full_name:"Davit Grigoryan", email:"davit@example.com",  status:"active" },
  { student_id:"mock_s7", full_name:"Mariam Simonyan", email:"mariam@example.com", status:"active" },
  { student_id:"mock_s8", full_name:"Hayk Avagyan",    email:"hayk@example.com",   status:"active" },
];

// ── Fake groups ───────────────────────────────────────────────────────────────
export const MOCK_GROUPS = [
  {
    id: "mock_g1",
    school_id: "lingvoconnect",
    name: "IELTS Prep — Group A",
    level: "B2",
    teacher_username: "demo_teacher",
    status: "active",
    color: "#11CD87",
    description: "Morning intensive IELTS preparation",
    max_students: 10,
    period_start: "2026-10-01",
    period_months: 1,
    schedule: [
      { day: 1, start: "09:00", end: "10:30" },  // Monday
      { day: 3, start: "09:00", end: "10:30" },  // Wednesday
      { day: 5, start: "09:00", end: "10:30" },  // Friday
    ],
    created_at: "2026-10-01T08:00:00Z",
  },
  {
    id: "mock_g2",
    school_id: "lingvoconnect",
    name: "Speaking Club — Advanced",
    level: "C1",
    teacher_username: "demo_teacher",
    status: "active",
    color: "#8B5CF6",
    description: "Advanced speaking practice",
    max_students: 8,
    period_start: "2026-10-01",
    period_months: 1,
    schedule: [
      { day: 2, start: "14:00", end: "15:30" },  // Tuesday
      { day: 4, start: "14:00", end: "15:30" },  // Thursday
    ],
    created_at: "2026-10-01T08:00:00Z",
  },
];

// ── Fake enrollments ──────────────────────────────────────────────────────────
export const MOCK_ENROLLMENTS = {
  mock_g1: ["mock_s1","mock_s2","mock_s3","mock_s4","mock_s5","mock_s6"],
  mock_g2: ["mock_s3","mock_s4","mock_s5","mock_s7","mock_s8"],
};

// ── Fake sessions ─────────────────────────────────────────────────────────────
export const MOCK_SESSIONS = {
  mock_g1: [
    { id:"mock_sess_g1_1", group_id:"mock_g1", title:"Listening skills — Section 3",   date:"2026-10-20", start_time:"09:00", end_time:"10:30" },
    { id:"mock_sess_g1_2", group_id:"mock_g1", title:"Reading — True/False/NG",        date:"2026-10-22", start_time:"09:00", end_time:"10:30" },
    { id:"mock_sess_g1_3", group_id:"mock_g1", title:"Writing Task 2 — Arguments",     date:"2026-10-24", start_time:"09:00", end_time:"10:30" },
    { id:"mock_sess_g1_4", group_id:"mock_g1", title:"Mock Test Review",               date:"2026-10-27", start_time:"09:00", end_time:"10:30" },
  ],
  mock_g2: [
    { id:"mock_sess_g2_1", group_id:"mock_g2", title:"Part 2 — Cue Card Practice",     date:"2026-10-21", start_time:"14:00", end_time:"15:30" },
    { id:"mock_sess_g2_2", group_id:"mock_g2", title:"Part 3 — Discussion strategies", date:"2026-10-23", start_time:"14:00", end_time:"15:30" },
    { id:"mock_sess_g2_3", group_id:"mock_g2", title:"Fluency drills + recording",     date:"2026-10-28", start_time:"14:00", end_time:"15:30" },
  ],
};

// ── Seed attendance (only on first load) ──────────────────────────────────────
function seedAttendanceIfNeeded() {
  const s = load();
  if (s._seeded) return;
  const att = {};
  const seed = {
    mock_sess_g1_1: { mock_s1:"present",mock_s2:"present",mock_s3:"late",mock_s4:"absent",mock_s5:"present",mock_s6:"excused" },
    mock_sess_g1_2: { mock_s1:"present",mock_s2:"late",   mock_s3:"present",mock_s4:"present",mock_s5:"absent",mock_s6:"present" },
    mock_sess_g1_3: { mock_s1:"present",mock_s2:"present",mock_s3:"present",mock_s4:"late",  mock_s5:"present",mock_s6:"present" },
    mock_sess_g2_1: { mock_s3:"present",mock_s4:"present",mock_s5:"late",mock_s7:"present",mock_s8:"absent" },
    mock_sess_g2_2: { mock_s3:"late",   mock_s4:"present",mock_s5:"present",mock_s7:"present",mock_s8:"present" },
  };
  Object.entries(seed).forEach(([sessId, students]) => {
    Object.entries(students).forEach(([sid, status]) => {
      att[`${sessId}__${sid}`] = { session_id:sessId, student_id:sid, status, notes:"" };
    });
  });
  s.attendance = att;
  s.materials  = s.materials || {};
  s.tasks      = s.tasks || {};
  s._seeded    = true;
  save(s);
}

// ── Public API (mirrors lmsDb.js signatures) ──────────────────────────────────

export function mockGetGroups(teacherUsername) {
  seedAttendanceIfNeeded();
  return Promise.resolve(MOCK_GROUPS.filter(g => g.teacher_username === teacherUsername));
}

export function mockGetGroupStudents(groupId) {
  const ids = MOCK_ENROLLMENTS[groupId] || [];
  return Promise.resolve(ids.map(sid => ({ group_id:groupId, student_id:sid, status:"active", enrolled_at:"2026-10-01T00:00:00Z" })));
}

export function mockGetSessions(groupId) {
  return Promise.resolve([...(MOCK_SESSIONS[groupId]||[])].sort((a,b)=>b.date.localeCompare(a.date)));
}

export function mockGetAttendance(sessionId) {
  const att = get("attendance", {});
  return Promise.resolve(
    Object.values(att).filter(a => a.session_id === sessionId)
  );
}

export function mockMarkAttendance(sessionId, studentId, status, notes="") {
  const att = get("attendance", {});
  att[`${sessionId}__${studentId}`] = { session_id:sessionId, student_id:studentId, status, notes };
  set("attendance", att);
  return Promise.resolve(att[`${sessionId}__${studentId}`]);
}

export function mockGetMaterials(groupId) {
  const mats = get("materials", {});
  return Promise.resolve((mats[groupId]||[]).sort((a,b)=>b.created_at.localeCompare(a.created_at)));
}

export function mockCreateMaterial(m) {
  const mats = get("materials", {});
  if (!mats[m.group_id]) mats[m.group_id] = [];
  const item = { ...m, id:`mat_${Date.now()}`, created_at:new Date().toISOString() };
  mats[m.group_id].unshift(item);
  set("materials", mats);
  return Promise.resolve(item);
}

export function mockDeleteMaterial(id) {
  const mats = get("materials", {});
  Object.keys(mats).forEach(gid => { mats[gid] = mats[gid].filter(m => m.id !== id); });
  set("materials", mats);
  return Promise.resolve();
}

export function mockGetTasks(groupId) {
  const tasks = get("tasks", {});
  return Promise.resolve((tasks[groupId]||[]).sort((a,b)=>(a.due_date||"").localeCompare(b.due_date||"")));
}

export function mockCreateTask(t) {
  const tasks = get("tasks", {});
  if (!tasks[t.group_id]) tasks[t.group_id] = [];
  const item = { ...t, id:`task_${Date.now()}`, created_at:new Date().toISOString() };
  tasks[t.group_id].push(item);
  set("tasks", tasks);
  return Promise.resolve(item);
}

export function mockGetAllStudents() {
  return Promise.resolve(MOCK_STUDENTS);
}

export function mockGetAllGroups() {
  seedAttendanceIfNeeded();
  return Promise.resolve(MOCK_GROUPS);
}

// ── Fake payments ─────────────────────────────────────────────────────────────
export const MOCK_PAYMENTS = [
  { id:"mock_p1",  student_id:"mock_s1", student_name:"Ani Petrosyan",   group_id:"mock_g1", group_name:"IELTS Prep — Group A",      amount:45000, currency:"AMD", status:"paid",    date:"2026-10-01", due_date:"2026-10-01", month_label:"October 2026", notes:"" },
  { id:"mock_p2",  student_id:"mock_s2", student_name:"Aram Gevorgyan",  group_id:"mock_g1", group_name:"IELTS Prep — Group A",      amount:45000, currency:"AMD", status:"paid",    date:"2026-10-01", due_date:"2026-10-01", month_label:"October 2026", notes:"" },
  { id:"mock_p3",  student_id:"mock_s3", student_name:"Nare Hakobyan",   group_id:"mock_g1", group_name:"IELTS Prep — Group A",      amount:45000, currency:"AMD", status:"overdue", date:null,         due_date:"2026-10-05", month_label:"October 2026", notes:"" },
  { id:"mock_p4",  student_id:"mock_s4", student_name:"Tigran Sargsyan", group_id:"mock_g1", group_name:"IELTS Prep — Group A",      amount:45000, currency:"AMD", status:"pending", date:null,         due_date:"2026-10-15", month_label:"October 2026", notes:"" },
  { id:"mock_p5",  student_id:"mock_s5", student_name:"Lusine Vardanyan",group_id:"mock_g1", group_name:"IELTS Prep — Group A",      amount:45000, currency:"AMD", status:"paid",    date:"2026-10-03", due_date:"2026-10-01", month_label:"October 2026", notes:"" },
  { id:"mock_p6",  student_id:"mock_s6", student_name:"Davit Grigoryan", group_id:"mock_g1", group_name:"IELTS Prep — Group A",      amount:45000, currency:"AMD", status:"overdue", date:null,         due_date:"2026-10-01", month_label:"October 2026", notes:"" },
  { id:"mock_p7",  student_id:"mock_s3", student_name:"Nare Hakobyan",   group_id:"mock_g2", group_name:"Speaking Club — Advanced",  amount:35000, currency:"AMD", status:"paid",    date:"2026-10-02", due_date:"2026-10-01", month_label:"October 2026", notes:"" },
  { id:"mock_p8",  student_id:"mock_s4", student_name:"Tigran Sargsyan", group_id:"mock_g2", group_name:"Speaking Club — Advanced",  amount:35000, currency:"AMD", status:"pending", date:null,         due_date:"2026-10-15", month_label:"October 2026", notes:"" },
  { id:"mock_p9",  student_id:"mock_s5", student_name:"Lusine Vardanyan",group_id:"mock_g2", group_name:"Speaking Club — Advanced",  amount:35000, currency:"AMD", status:"overdue", date:null,         due_date:"2026-10-05", month_label:"October 2026", notes:"" },
  { id:"mock_p10", student_id:"mock_s7", student_name:"Mariam Simonyan", group_id:"mock_g2", group_name:"Speaking Club — Advanced",  amount:35000, currency:"AMD", status:"paid",    date:"2026-10-01", due_date:"2026-10-01", month_label:"October 2026", notes:"" },
  { id:"mock_p11", student_id:"mock_s8", student_name:"Hayk Avagyan",    group_id:"mock_g2", group_name:"Speaking Club — Advanced",  amount:35000, currency:"AMD", status:"pending", date:null,         due_date:"2026-10-20", month_label:"October 2026", notes:"" },
];

export function mockGetPayments(filters = {}) {
  let rows = [...MOCK_PAYMENTS];
  if (filters.status) rows = rows.filter(p => p.status === filters.status);
  if (filters.group_id) rows = rows.filter(p => p.group_id === filters.group_id);
  return Promise.resolve(rows);
}
