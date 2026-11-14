import { supabase } from "./db.js";
import { hashStudentPassword } from "./studentAuth.js";

// ── ID / password generators ──────────────────────────────────────────────────

function genStudentId() {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `STU-${year}-${rand}`;
}

function genUsername(fullName) {
  const base = (fullName || "student").toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 10) || "student";
  const rand = Math.random().toString(36).substring(2, 5);
  return `${base}${rand}`;
}

const ADJ  = ["Blue","Red","Fast","Smart","Cool","Green","Bold","Bright","Clear","Swift"];
const NOUN = ["River","Eagle","Star","Lion","Moon","Tree","Wave","Peak","Sky","Stone"];
export function genTempPassword() {
  const adj  = ADJ[Math.floor(Math.random() * ADJ.length)];
  const noun = NOUN[Math.floor(Math.random() * NOUN.length)];
  const num  = 1000 + Math.floor(Math.random() * 9000);
  return `${adj}-${noun}-${num}`;
}

// ── Student accounts (admin operations) ───────────────────────────────────────

export async function createStudentAccount({ fullName, email, phone = "", password, createdBy = "admin" }) {
  try {
    const hash       = await hashStudentPassword(password);
    const student_id = genStudentId();
    const username   = genUsername(fullName);
    const newStudent = {
      id: "local_" + Date.now().toString(36),
      student_id,
      full_name: (fullName || "").trim(),
      email: (email || "").trim().toLowerCase(),
      username,
      password_hash: hash,
      phone: phone || "",
      created_by: createdBy,
      status: "active",
      force_pw_change: true,
      created_at: new Date().toISOString(),
    };

    if (!supabase) {
      // Offline: save to localStorage cache
      try {
        const existing = JSON.parse(localStorage.getItem("lv_dev_students")||"[]");
        localStorage.setItem("lv_dev_students", JSON.stringify([newStudent, ...existing]));
      } catch {}
      const { password_hash: _, ...publicStudent } = newStudent;
      return { student: { ...publicStudent, _plainPassword: password } };
    }

    const { data, error } = await supabase.from("student_accounts").insert({
      student_id: newStudent.student_id,
      full_name: newStudent.full_name,
      email: newStudent.email,
      username: newStudent.username,
      password_hash: hash,
      phone: newStudent.phone,
      created_by: createdBy,
      status: "active",
      force_pw_change: true,
    }).select("id,student_id,full_name,email,username,phone,status,force_pw_change,created_at").single();

    if (error) return { error: error.message };
    return { student: { ...data, _plainPassword: password } };
  } catch (e) {
    return { error: e.message || "Failed to create account" };
  }
}

const OFFLINE_DEV_STUDENTS_KEY = "lv_dev_students";

export async function getAllStudents() {
  if (!supabase) {
    try { return JSON.parse(localStorage.getItem(OFFLINE_DEV_STUDENTS_KEY)||"[]"); } catch { return []; }
  }
  const { data } = await supabase
    .from("student_accounts")
    .select("id,student_id,full_name,email,username,phone,status,force_pw_change,created_at,password_hash")
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .limit(1000);
  // Cache for offline login
  if (data) { try { localStorage.setItem(OFFLINE_DEV_STUDENTS_KEY, JSON.stringify(data)); } catch {} }
  return (data || []).map(({ password_hash: _, ...s }) => s);
}

export async function updateStudentAccount(studentId, updates) {
  if (!supabase) {
    // Offline: update dev students cache
    try {
      const students = JSON.parse(localStorage.getItem(OFFLINE_DEV_STUDENTS_KEY)||"[]");
      const updated = students.map(s => s.student_id === studentId ? { ...s, ...updates } : s);
      localStorage.setItem(OFFLINE_DEV_STUDENTS_KEY, JSON.stringify(updated));
    } catch {}
    return { ok: true };
  }
  const { error } = await supabase
    .from("student_accounts")
    .update(updates)
    .eq("student_id", studentId);
  return { ok: !error, error: error?.message };
}

export async function resetStudentPassword(studentId, newPassword) {
  const hash = await hashStudentPassword(newPassword);
  return updateStudentAccount(studentId, { password_hash: hash, force_pw_change: true });
}

export async function deactivateStudent(studentId) {
  return updateStudentAccount(studentId, { status: "inactive" });
}

export async function reactivateStudent(studentId) {
  return updateStudentAccount(studentId, { status: "active" });
}

export async function deleteStudentData(studentId) {
  if (!supabase) return false;
  // Delete assignments (cascade handles attempts if added later)
  await supabase.from("student_assignments").delete().eq("student_id", studentId);
  await supabase.from("deletion_requests").delete().eq("student_id", studentId);
  // Anonymise account (keep row for audit, remove PII)
  const ts = Date.now();
  await supabase.from("student_accounts").update({
    status: "deleted",
    full_name: "[Deleted]",
    email: `deleted_${ts}@deleted.invalid`,
    username: `deleted_${ts}`,
    phone: "",
    password_hash: "deleted",
  }).eq("student_id", studentId);
  return true;
}

// ── Assignments (admin operations) ────────────────────────────────────────────

export async function createAssignment({ studentId, suiteId, suiteName, deadline, isWeekTest = false, assignedBy = "admin", moduleConfig = null }) {
  const assignmentData = {
    id: "asgn_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,6),
    student_id: studentId,
    test_suite_id: suiteId || "",
    test_suite_name: suiteName || "",
    is_week_test: isWeekTest,
    assigned_by: assignedBy,
    deadline: deadline || null,
    status: "not_started",
    assigned_at: new Date().toISOString(),
    ...(moduleConfig ? { auto_save: { moduleConfig } } : {}),
  };
  if (!supabase) {
    const all = _loadOfflineAssignments();
    _saveOfflineAssignments([assignmentData, ...all]);
    return { assignment: assignmentData };
  }
  const { data, error } = await supabase.from("student_assignments").insert({
    student_id: assignmentData.student_id,
    test_suite_id: assignmentData.test_suite_id,
    test_suite_name: assignmentData.test_suite_name,
    is_week_test: assignmentData.is_week_test,
    assigned_by: assignmentData.assigned_by,
    deadline: assignmentData.deadline,
    assigned_at: assignmentData.assigned_at,
    status: "not_started",
    ...(moduleConfig ? { auto_save: { moduleConfig } } : {}),
  }).select().single();
  if (error) console.error("[createAssignment] Supabase error:", error.message, error);
  return error ? { error: error.message } : { assignment: data };
}

export async function createBulkAssignments(studentIds, { suiteId, suiteName, deadline, isWeekTest = false, assignedBy = "admin" }) {
  if (!supabase) return { error: "No database connection" };
  const rows = studentIds.map(sid => ({
    student_id: sid,
    test_suite_id: suiteId,
    test_suite_name: suiteName || "",
    is_week_test: isWeekTest,
    assigned_by: assignedBy,
    deadline: deadline || null,
    status: "not_started",
    assigned_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("student_assignments").insert(rows);
  return error ? { error: error.message } : { ok: true, count: rows.length };
}

export async function setWeekTest({ suiteId, suiteName, studentIds, deadline, assignedBy = "admin" }) {
  if (!supabase || !studentIds?.length) return { error: "No students selected" };
  // Clear existing week tests for these students
  await supabase.from("student_assignments")
    .update({ is_week_test: false })
    .in("student_id", studentIds)
    .eq("is_week_test", true)
    .eq("status", "not_started");
  return createBulkAssignments(studentIds, { suiteId, suiteName, deadline, isWeekTest: true, assignedBy });
}

const OFFLINE_ASSIGNMENTS_KEY = "lv_offline_assignments";
const _loadOfflineAssignments = () => { try { return JSON.parse(localStorage.getItem(OFFLINE_ASSIGNMENTS_KEY)||"[]"); } catch { return []; } };
const _saveOfflineAssignments = a => { try { localStorage.setItem(OFFLINE_ASSIGNMENTS_KEY, JSON.stringify(a)); } catch {} };

export async function getAllAssignments() {
  if (!supabase) return _loadOfflineAssignments();
  const { data, error } = await supabase
    .from("student_assignments")
    .select("*")
    .order("assigned_at", { ascending: false })
    .limit(2000);
  if (error) console.warn("[studentDb] getAllAssignments error:", error.message);
  return data || [];
}

export async function getStudentAssignments(studentId) {
  if (!supabase) return _loadOfflineAssignments().filter(a => a.student_id === studentId);
  const { data } = await supabase
    .from("student_assignments")
    .select("*")
    .eq("student_id", studentId)
    .order("is_week_test", { ascending: false })
    .order("assigned_at", { ascending: false });
  return data || [];
}

export async function updateAssignment(assignmentId, updates) {
  if (!supabase) {
    const all = _loadOfflineAssignments().map(a => a.id === assignmentId ? { ...a, ...updates } : a);
    _saveOfflineAssignments(all);
    return true;
  }
  const { error } = await supabase
    .from("student_assignments")
    .update(updates)
    .eq("id", assignmentId);
  return !error;
}

export async function deleteAssignment(assignmentId) {
  if (!supabase) {
    _saveOfflineAssignments(_loadOfflineAssignments().filter(a => a.id !== assignmentId));
    return true;
  }
  const { error } = await supabase.from("student_assignments").delete().eq("id", assignmentId);
  return !error;
}

export async function startAssignment(assignmentId) {
  return updateAssignment(assignmentId, {
    status: "in_progress",
    started_at: new Date().toISOString(),
  });
}

export async function submitAssignment(assignmentId, scores, sessionId, resultData = null) {
  return updateAssignment(assignmentId, {
    scores,
    status: "submitted",
    completed_at: new Date().toISOString(),
    session_id: sessionId || "",
    ...(resultData ? { result_data: resultData } : {}),
  });
}

export async function getStudentAttempts(email) {
  if (!supabase || !email) return [];
  const { data } = await supabase
    .from("participants")
    .select("id, email, data, created_at")
    .eq("email", email.toLowerCase().trim())
    .in("type", ["attempt", "registration"])
    .order("created_at", { ascending: false });
  if (!data) return [];
  // Deduplicate by data.id (keep newest row per session), include all statuses
  const seen = {};
  const rows = [];
  for (const row of data) {
    const item = { ...row.data, _rowId: row.id, _createdAt: row.created_at };
    const key = item.id || row.id;
    if (!seen[key]) { seen[key] = true; rows.push(item); }
  }
  // Show complete/submitted first; also include in_progress (interrupted tests)
  return rows.filter(r => r.status === "complete" || r.status === "submitted" || r.status === "in_progress");
}

export async function updateParticipantData(rowId, updates) {
  if (!supabase || !rowId) return { ok: false, error: "Missing id" };
  const { data: row } = await supabase.from("participants").select("data").eq("id", rowId).maybeSingle();
  if (!row) return { ok: false, error: "Attempt not found" };
  const merged = { ...row.data, ...updates };
  const { error } = await supabase.from("participants").update({ data: merged }).eq("id", rowId);
  return { ok: !error, error: error?.message };
}

export async function autoSaveAssignment(assignmentId, saveData) {
  return updateAssignment(assignmentId, {
    auto_save: saveData,
    status: "in_progress",
    started_at: new Date().toISOString(),
  });
}

// ── Deletion requests ─────────────────────────────────────────────────────────

export async function createDeletionRequest(studentId, studentName, studentEmail, reason = "") {
  if (!supabase) return false;
  // Prevent duplicate pending requests
  await supabase.from("deletion_requests")
    .delete()
    .eq("student_id", studentId)
    .eq("status", "pending");
  const { error } = await supabase.from("deletion_requests").insert({
    student_id: studentId,
    student_name: studentName,
    student_email: studentEmail,
    reason: reason || "Student requested account deletion",
    status: "pending",
  });
  return !error;
}

export async function getDeletionRequests() {
  if (!supabase) return [];
  const { data } = await supabase
    .from("deletion_requests")
    .select("*")
    .order("requested_at", { ascending: false });
  return data || [];
}

export async function processDeletionRequest(requestId, approve, processedBy, studentId) {
  if (!supabase) return false;
  await supabase.from("deletion_requests").update({
    status: approve ? "approved" : "rejected",
    processed_at: new Date().toISOString(),
    processed_by: processedBy || "admin",
  }).eq("id", requestId);
  if (approve && studentId) await deleteStudentData(studentId);
  return true;
}

// ── Self-registration (student sign-up flow) ──────────────────────────────────

export async function selfRegisterStudent({ fullName, email, phone = "", password }) {
  if (!supabase) return { error: "No database connection" };
  try {
    const hash       = await hashStudentPassword(password);
    const student_id = genStudentId();
    const username   = genUsername(fullName);
    const { data, error } = await supabase.from("student_accounts").insert({
      student_id,
      full_name: (fullName || "").trim(),
      email: (email || "").trim().toLowerCase(),
      username,
      password_hash: hash,
      phone: phone || "",
      status: "pending",
      force_pw_change: false,
    }).select("id,student_id,full_name,email,username,status").single();
    if (error) return { error: error.message };
    return { student: data };
  } catch(e) { return { error: e.message || "Registration failed" }; }
}

// ── Pending approval management ────────────────────────────────────────────────

export async function getPendingStudents() {
  if (!supabase) return [];
  const { data } = await supabase
    .from("student_accounts")
    .select("id,student_id,full_name,email,username,phone,status,created_at")
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false });
  return data || [];
}

export async function approveStudent(studentId) {
  return updateStudentAccount(studentId, { status: "active" });
}

export async function rejectStudent(studentId) {
  return updateStudentAccount(studentId, { status: "rejected" });
}

// ── Fetch single assignment with full result ───────────────────────────────────

export async function getAssignmentResult(assignmentId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from("student_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  return data || null;
}
