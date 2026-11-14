/**
 * Route guards for Phase 1 routing infrastructure.
 *
 * Phase 1: These are stubs — App.jsx still enforces auth internally via <Navigate>.
 * Phases 2-4 will use these as proper wrappers when pages are extracted from App.jsx.
 */
import { Navigate } from "react-router-dom";
import { isStudentLoggedIn, getStudentSession } from "../lib/studentAuth.js";
import { getAdminSession } from "../lib/db.js";

/** Requires an active (non-pending) student session; redirects to /login otherwise. */
export function StudentRoute({ children }) {
  if (!isStudentLoggedIn()) return <Navigate to="/login" replace />;
  const s = getStudentSession();
  if (s?.status === "pending") return <Navigate to="/student" replace />;
  return children;
}

/** Requires an admin session; redirects to / otherwise. */
export function AdminRoute({ children }) {
  if (!getAdminSession()) return <Navigate to="/" replace />;
  return children;
}

/** Requires any authenticated student (including pending); redirects to /login otherwise. */
export function AnyStudentRoute({ children }) {
  if (!isStudentLoggedIn()) return <Navigate to="/login" replace />;
  return children;
}
