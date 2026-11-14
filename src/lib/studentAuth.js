import { supabase } from "./db.js";

const SESSION_KEY = "lv_student_v1";
const SALT = "lv_lingvo_student_2025";

export async function hashStudentPassword(pw) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(pw + SALT)
  );
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function getStudentSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}

export function setStudentSession(student) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...student, _sessionTs: Date.now() }));
  } catch {}
}

export function clearStudentSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export function isStudentLoggedIn() {
  const s = getStudentSession();
  return !!(s?.student_id && s?.status && s.status !== "deleted" && s.status !== "rejected");
}

// Simple in-memory rate limiter — resets on page reload (good enough for browser-side)
const _loginAttempts = {};
const LOGIN_MAX = 5;
const LOGIN_LOCK_MS = 5 * 60 * 1000; // 5 minutes

export function getStudentLoginLockout(login) {
  const key = (login || "").trim().toLowerCase();
  const rec = _loginAttempts[key];
  if (!rec) return { locked: false, remainingSec: 0 };
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
    return { locked: true, remainingSec: Math.ceil((rec.lockedUntil - Date.now()) / 1000) };
  }
  return { locked: false, remainingSec: 0 };
}

const OFFLINE_DEV_STUDENTS_KEY = "lv_dev_students";
export const TEST_STUDENTS_KEY = "lv_test_students"; // local test accounts — never touch real DB

export function getTestStudents() {
  try { return JSON.parse(localStorage.getItem(TEST_STUDENTS_KEY)||"[]"); } catch { return []; }
}
export function saveTestStudents(list) {
  try { localStorage.setItem(TEST_STUDENTS_KEY, JSON.stringify(list)); } catch {}
}

export async function loginStudent(login, password) {
  // LOCAL TEST ACCOUNTS — checked first, always, even in online mode. These live only in localStorage.
  {
    const hash = await hashStudentPassword(password);
    const testStudents = (() => { try { return JSON.parse(localStorage.getItem(TEST_STUDENTS_KEY)||"[]"); } catch { return []; } })();
    const loginLower = (login||"").trim().toLowerCase();
    const found = testStudents.find(s =>
      (s.email === loginLower || s.username === loginLower || s.student_id === loginLower) &&
      s.password_hash === hash &&
      s.status !== "deleted" && s.status !== "rejected"
    );
    if (found) {
      if (found.status === "inactive") return { error: "Your account has been deactivated." };
      setStudentSession(found);
      return { student: found };
    }
  }

  // Offline dev mode: check against students cached in localStorage by the admin
  if (!supabase) {
    const hash = await hashStudentPassword(password);
    const devStudents = (() => { try { return JSON.parse(localStorage.getItem(OFFLINE_DEV_STUDENTS_KEY)||"[]"); } catch { return []; } })();
    const loginLower = (login||"").trim().toLowerCase();
    const found = devStudents.find(s =>
      (s.email === loginLower || s.username === loginLower) &&
      s.password_hash === hash &&
      s.status !== "deleted" && s.status !== "rejected"
    );
    if (!found) return { error: "Invalid username or password. (Offline mode — check dev student list)" };
    if (found.status === "inactive") return { error: "Your account has been deactivated." };
    setStudentSession(found);
    return { student: found };
  }

  const key = (login || "").trim().toLowerCase();
  const lockout = getStudentLoginLockout(key);
  if (lockout.locked) {
    return { error: `Too many failed attempts. Try again in ${lockout.remainingSec}s.` };
  }

  try {
    const hash = await hashStudentPassword(password);
    const loginLower = (login || "").trim().toLowerCase();

    // Use two separate .eq() queries instead of interpolated .or() to avoid injection
    const FIELDS = "id,student_id,full_name,email,username,phone,status,force_pw_change,created_at";
    const base = () => supabase.from("student_accounts").select(FIELDS)
      .eq("password_hash", hash)
      .not("status", "eq", "deleted")
      .not("status", "eq", "rejected");

    const [byEmail, byUsername] = await Promise.all([
      base().eq("email",    loginLower).maybeSingle(),
      base().eq("username", loginLower).maybeSingle(),
    ]);

    const error = byEmail.error && byUsername.error ? byEmail.error : null;
    const data  = byEmail.data || byUsername.data || null;

    if (error) return { error: "Login failed. Please try again." };
    if (!data) {
      // Track failed attempt
      const rec = _loginAttempts[key] || { count: 0 };
      rec.count += 1;
      if (rec.count >= LOGIN_MAX) {
        rec.lockedUntil = Date.now() + LOGIN_LOCK_MS;
        rec.count = 0;
      }
      _loginAttempts[key] = rec;
      const remaining = LOGIN_MAX - (rec.count || 0);
      return { error: remaining > 0
        ? `Invalid username or password. (${remaining} attempt${remaining !== 1 ? "s" : ""} left)`
        : "Too many failed attempts. Try again in 5 minutes." };
    }
    if (data.status === "inactive") return { error: "Your account has been deactivated. Please contact your administrator." };

    // Clear failed attempts on success
    delete _loginAttempts[key];
    setStudentSession(data);
    return { student: data };
  } catch (e) {
    return { error: "Network error. Please check your connection." };
  }
}

export async function changeStudentPassword(studentId, newPassword) {
  if (!supabase) return { ok: false, error: "No database connection" };
  try {
    const hash = await hashStudentPassword(newPassword);
    const { error } = await supabase
      .from("student_accounts")
      .update({ password_hash: hash, force_pw_change: false })
      .eq("student_id", studentId);
    if (error) return { ok: false, error: error.message };
    // Update session
    const s = getStudentSession();
    if (s) setStudentSession({ ...s, force_pw_change: false });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Failed to update password." };
  }
}
