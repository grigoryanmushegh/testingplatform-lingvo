/**
 * Top-level route definitions.
 *
 * Phase 2: All routes still render <App />, which derives the active view and
 * tab from useLocation(). Future phases will extract dedicated page components.
 *
 *  PUBLIC
 *    /                      → Home (LandingPage in Phase 3)
 *    /login                 → StudentLogin (Phase 3)
 *    /signup                → SignUpForm (Phase 3)
 *    /guest-registration    → GuestRegistrationPage (Phase 7)
 *
 *  STUDENT  (requires auth)
 *    /student               → StudentDashboard — Home tab
 *    /student/tests         → StudentDashboard — My Tests tab
 *    /student/results       → StudentDashboard — My Results tab
 *    /student/profile       → StudentDashboard — Profile tab
 *
 *  ADMIN  (requires admin auth)
 *    /admin                 → AdminDashboard — Overview
 *    /admin/students        → AdminDashboard — Students
 *    /admin/pending         → AdminDashboard — Pending Students
 *    /admin/participants    → AdminDashboard — Participants (candidate detail)
 *    /admin/tests           → AdminDashboard — Test Suites
 *    /admin/assignments     → AdminDashboard — Assignments
 *    /admin/staff           → AdminDashboard — Staff
 *    /admin/settings        → AdminDashboard — Settings
 *    /admin/users           → AdminDashboard — Admin Users (super-admin only)
 *
 *  TEST ENGINE
 *    /test                  → Full-screen exam (extracted in Phase 5)
 */
import { Routes, Route, Navigate } from "react-router-dom";
import App from "../App.jsx";
import LandingPage from "../pages/public/LandingPage.jsx";
import LoginPage from "../pages/public/LoginPage.jsx";
import SignUpPage from "../pages/public/SignUpPage.jsx";
import AdminPage from "../pages/admin/AdminPage.jsx";
import TestPage from "../pages/test/TestPage.jsx";
import StudentDashboardPage from "../pages/student/StudentDashboardPage.jsx";
import TeacherDashboardPage from "../pages/teacher/TeacherDashboardPage.jsx";
import DemoPage from "../pages/public/DemoPage.jsx";
import DevSetupPage from "../pages/public/DevSetupPage.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public — standalone page components, no App.jsx overhead */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      {/* Student LMS portal */}
      <Route path="/student" element={<StudentDashboardPage />} />
      <Route path="/student/tests" element={<App />} />
      <Route path="/student/results" element={<App />} />
      <Route path="/student/profile" element={<App />} />

      {/* Admin — AdminPage mounts AdminDashboard directly, no test-engine overhead */}
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/students" element={<AdminPage />} />
      <Route path="/admin/students/:id" element={<AdminPage />} />
      <Route path="/admin/pending" element={<AdminPage />} />
      <Route path="/admin/participants" element={<AdminPage />} />
      <Route path="/admin/tests" element={<AdminPage />} />
      <Route path="/admin/assignments" element={<AdminPage />} />
      <Route path="/admin/staff" element={<AdminPage />} />
      <Route path="/admin/settings" element={<AdminPage />} />
      <Route path="/admin/users" element={<AdminPage />} />
      <Route path="/admin/create" element={<AdminPage />} />
      <Route path="/admin/export" element={<AdminPage />} />
      <Route path="/admin/lms" element={<AdminPage />} />
      <Route path="/admin/attendance" element={<AdminPage />} />
      <Route path="/admin/materials" element={<AdminPage />} />
      <Route path="/admin/payments" element={<AdminPage />} />
      <Route path="/admin/certificates" element={<AdminPage />} />

      {/* Teacher LMS portal */}
      <Route path="/teacher" element={<TeacherDashboardPage />} />

      {/* Internal student preview — /preview/:studentId */}
      <Route path="/preview/:studentId" element={<DemoPage />} />

      {/* Dev-only test account setup — /dev */}
      <Route path="/dev" element={<DevSetupPage />} />

      {/* Test Engine — Phase 5: standalone route, no App overhead */}
      <Route path="/test" element={<TestPage />} />

      {/* 404 → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
