/**
 * Admin section entry point.
 *
 * All /admin/* routes render this component, which mounts AdminDashboard directly —
 * without the test-engine state and hooks that App.jsx carries. AdminDashboard manages
 * its own authentication, DB subscriptions, and URL-based tab routing (Phase 2).
 *
 * Phase 4 of the platform restructure.
 */
import { useNavigate } from "react-router-dom";
import { AdminDashboard } from "../../App.jsx";

export default function AdminPage() {
  const navigate = useNavigate();
  return <AdminDashboard onExit={() => navigate("/")} />;
}
