import { supabase } from "./db.js";

const SCHOOL = "lingvoconnect";
const OFFLINE = import.meta.env.VITE_OFFLINE === "true";

// ── Offline localStorage helpers ─────────────────────────────────────────────
function lsGet(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── Groups ────────────────────────────────────────────────────────────────────

export async function getGroups() {
  try {
    const { data, error } = await supabase
      .from("lms_groups")
      .select("*")
      .eq("school_id", SCHOOL)
      .order("created_at", { ascending: false });
    if (!error && data?.length) return data;
  } catch {}
  // Fake-data fallback for local dev
  try {
    const ft = JSON.parse(localStorage.getItem("lv_fake_teacher") || "{}");
    if (ft.groups?.length) return ft.groups;
  } catch {}
  return [];
}

export async function createGroup(g) {
  const { data, error } = await supabase
    .from("lms_groups")
    .insert({ ...g, school_id: SCHOOL })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGroup(id, patch) {
  const { data, error } = await supabase
    .from("lms_groups")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveGroup(id) {
  return updateGroup(id, { status: "archived" });
}

// ── Group Students ────────────────────────────────────────────────────────────

export async function getGroupStudents(groupId) {
  try {
    const { data, error } = await supabase
      .from("lms_group_students")
      .select("*")
      .eq("group_id", groupId)
      .eq("status", "active")
      .order("enrolled_at");
    if (!error && data?.length) return data;
  } catch {}
  // Fake-data fallback
  try {
    const ft = JSON.parse(localStorage.getItem("lv_fake_teacher") || "{}");
    return ft.groupStudents?.[groupId] || [];
  } catch { return []; }
}

export async function enrollStudent(groupId, studentId) {
  const { data, error } = await supabase
    .from("lms_group_students")
    .upsert(
      { group_id: groupId, student_id: studentId, status: "active" },
      { onConflict: "group_id,student_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function unenrollStudent(groupId, studentId) {
  const { error } = await supabase
    .from("lms_group_students")
    .update({ status: "dropped" })
    .eq("group_id", groupId)
    .eq("student_id", studentId);
  if (error) throw error;
}

export async function getStudentGroups(studentId) {
  try {
    const { data, error } = await supabase
      .from("lms_group_students")
      .select("*, group:lms_groups(id,name,level,color,schedule)")
      .eq("student_id", studentId)
      .eq("status", "active");
    if (!error && data?.length) return data;
  } catch {}
  // Fake-data fallback: student groups stored flat in lv_fake_data[studentId].groups
  try {
    const all = JSON.parse(localStorage.getItem("lv_fake_data") || "{}");
    return all[studentId]?.groups || [];
  } catch { return []; }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function getSessions(groupId, opts = {}) {
  try {
    let q = supabase
      .from("lms_sessions")
      .select("*")
      .eq("group_id", groupId)
      .order("date", { ascending: false });
    if (opts.from) q = q.gte("date", opts.from);
    if (opts.to)   q = q.lte("date", opts.to);
    const { data, error } = await q;
    if (!error && data?.length) return data;
  } catch {}
  // Fake-data fallback
  try {
    const ft = JSON.parse(localStorage.getItem("lv_fake_teacher") || "{}");
    return ft.sessions?.[groupId] || [];
  } catch { return []; }
}

export async function createSession(s) {
  const { data, error } = await supabase
    .from("lms_sessions")
    .insert(s)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSession(id, patch) {
  const { data, error } = await supabase
    .from("lms_sessions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSession(id) {
  const { error } = await supabase.from("lms_sessions").delete().eq("id", id);
  if (error) throw error;
}

// ── Attendance ────────────────────────────────────────────────────────────────

export async function getAttendance(sessionId) {
  const { data, error } = await supabase
    .from("lms_attendance")
    .select("*")
    .eq("session_id", sessionId);
  if (error) throw error;
  return data || [];
}

export async function markAttendance(sessionId, studentId, status, notes = "") {
  const { data, error } = await supabase
    .from("lms_attendance")
    .upsert(
      { session_id: sessionId, student_id: studentId, status, notes, marked_at: new Date().toISOString() },
      { onConflict: "session_id,student_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPeriodAttendanceSummary(groupId, periodStart, periodEnd) {
  const { data: sessions } = await supabase
    .from("lms_sessions")
    .select("id")
    .eq("group_id", groupId)
    .gte("date", periodStart)
    .lte("date", periodEnd);

  if (!sessions?.length) return {};

  const sessionIds = sessions.map(s => s.id);
  const { data, error } = await supabase
    .from("lms_attendance")
    .select("student_id, status")
    .in("session_id", sessionIds);
  if (error) throw error;

  const summary = {};
  const total = sessions.length;
  (data || []).forEach(r => {
    if (!summary[r.student_id]) summary[r.student_id] = { total, present: 0, late: 0, absent: 0, excused: 0 };
    if (summary[r.student_id][r.status] !== undefined) summary[r.student_id][r.status]++;
  });
  return summary;
}

// ── Student Tags ──────────────────────────────────────────────────────────────

export async function getTagsForStudents(studentIds) {
  if (!studentIds?.length) return {};
  const { data, error } = await supabase
    .from("lms_student_tags")
    .select("*")
    .eq("school_id", SCHOOL)
    .in("student_id", studentIds);
  if (error) throw error;
  const map = {};
  (data || []).forEach(t => {
    if (!map[t.student_id]) map[t.student_id] = [];
    map[t.student_id].push(t);
  });
  return map;
}

export async function addStudentTag(studentId, tag, color = "#3B82F6") {
  const { data, error } = await supabase
    .from("lms_student_tags")
    .upsert({ student_id: studentId, tag, color, school_id: SCHOOL }, { onConflict: "student_id,tag" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeStudentTag(studentId, tag) {
  const { error } = await supabase
    .from("lms_student_tags")
    .delete()
    .eq("student_id", studentId)
    .eq("tag", tag);
  if (error) throw error;
}

export async function getAllTagsInSchool() {
  const { data, error } = await supabase
    .from("lms_student_tags")
    .select("tag, color")
    .eq("school_id", SCHOOL);
  if (error) throw error;
  const seen = new Set();
  const unique = [];
  (data || []).forEach(t => { if (!seen.has(t.tag)) { seen.add(t.tag); unique.push(t); } });
  return unique;
}

// ── Materials ─────────────────────────────────────────────────────────────────

export async function getMaterials(groupId) {
  try {
    const { data, error } = await supabase
      .from("lms_materials")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    if (!error && data?.length) return data;
  } catch {}
  try {
    const ft = JSON.parse(localStorage.getItem("lv_fake_teacher") || "{}");
    return ft.materials?.[groupId] || [];
  } catch { return []; }
}

export async function createMaterial(m) {
  const { data, error } = await supabase
    .from("lms_materials")
    .insert(m)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMaterial(id) {
  const { error } = await supabase.from("lms_materials").delete().eq("id", id);
  if (error) throw error;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getTasks(groupId) {
  try {
    const { data, error } = await supabase
      .from("lms_tasks")
      .select("*")
      .eq("group_id", groupId)
      .order("due_date");
    if (!error && data?.length) return data;
  } catch {}
  try {
    const ft = JSON.parse(localStorage.getItem("lv_fake_teacher") || "{}");
    return ft.tasks?.[groupId] || [];
  } catch { return []; }
}

export async function createTask(t) {
  const { data, error } = await supabase
    .from("lms_tasks")
    .insert(t)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(id, patch) {
  const { data, error } = await supabase
    .from("lms_tasks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTask(id) {
  const { error } = await supabase.from("lms_tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function getTaskSubmissions(taskId) {
  const { data, error } = await supabase
    .from("lms_task_submissions")
    .select("*")
    .eq("task_id", taskId);
  if (error) throw error;
  return data || [];
}

export async function gradeSubmission(taskId, studentId, score, feedback) {
  const { data, error } = await supabase
    .from("lms_task_submissions")
    .update({ score, feedback })
    .eq("task_id", taskId)
    .eq("student_id", studentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Payments ──────────────────────────────────────────────────────────────────
const PAYMENTS_KEY = "lv_offline_payments";

export async function getPayments(filters = {}) {
  if (OFFLINE || !supabase) {
    let rows = lsGet(PAYMENTS_KEY) || [];
    if (filters.student_id) rows = rows.filter(r => r.student_id === filters.student_id);
    if (filters.status)     rows = rows.filter(r => r.status === filters.status);
    return rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }
  let q = supabase
    .from("lms_payments")
    .select("*")
    .eq("school_id", SCHOOL)
    .order("date", { ascending: false })
    .limit(500);
  if (filters.student_id) q = q.eq("student_id", filters.student_id);
  if (filters.status)     q = q.eq("status", filters.status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createPayment(p) {
  if (OFFLINE || !supabase) {
    const rows = lsGet(PAYMENTS_KEY) || [];
    const rec = { ...p, id: genId(), school_id: SCHOOL, created_at: new Date().toISOString() };
    lsSet(PAYMENTS_KEY, [...rows, rec]);
    return rec;
  }
  const { data, error } = await supabase
    .from("lms_payments")
    .insert({ ...p, school_id: SCHOOL })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePayment(id, patch) {
  if (OFFLINE || !supabase) {
    const rows = lsGet(PAYMENTS_KEY) || [];
    const updated = rows.map(r => r.id === id ? { ...r, ...patch } : r);
    lsSet(PAYMENTS_KEY, updated);
    return updated.find(r => r.id === id);
  }
  const { data, error } = await supabase
    .from("lms_payments")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePayment(id) {
  if (OFFLINE || !supabase) {
    const rows = lsGet(PAYMENTS_KEY) || [];
    lsSet(PAYMENTS_KEY, rows.filter(r => r.id !== id));
    return;
  }
  const { error } = await supabase.from("lms_payments").delete().eq("id", id);
  if (error) throw error;
}
