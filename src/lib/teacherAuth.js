import { hashPassword, loadDB } from "./db.js";

const SESSION_KEY = "lv_teacher_v1";

export function getTeacherSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}

export function setTeacherSession(teacher) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ ...teacher, _ts: Date.now() })); } catch {}
}

export function clearTeacherSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export function isTeacherLoggedIn() {
  const s = getTeacherSession();
  return !!(s?.id && s?.role === "teacher");
}

export async function loginTeacher(username, password) {
  // Load the admin DB to check staff accounts
  const db = await loadDB().catch(() => null);
  const staff = db?.adminUsers || [];
  const hash = await hashPassword(password);
  const found = staff.find(u =>
    u.username?.trim().toLowerCase() === username.trim().toLowerCase() &&
    u.passwordHash === hash &&
    u.role === "teacher"
  );
  if (!found) return null;
  const session = {
    id: found.id,
    username: found.username,
    displayName: found.displayName || found.username,
    role: "teacher",
    access: found.access || [],
  };
  setTeacherSession(session);
  return session;
}
