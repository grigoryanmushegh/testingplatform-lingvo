import { useState } from "react";
import {
  LayoutDashboard, School, GraduationCap, BookOpen,
  CreditCard, ArrowLeft, Bell, User,
  CalendarDays, ChevronRight, Search, Plus,
} from "lucide-react";
import GroupManager from "./GroupManager.jsx";
import MaterialsTasksManager from "./MaterialsTasksManager.jsx";
import PaymentsManager from "./PaymentsManager.jsx";
import LmsDashboard from "./LmsDashboard.jsx";
import NotificationBell from "../admin/NotificationBell.jsx";
import { MOCK_PAYMENTS, MOCK_GROUPS, MOCK_STUDENTS } from "../../lib/lmsDevMock.js";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BRAND   = "#C4F03B";
const SIDEBAR = "#151313";
const T = {
  bg:      "#EEEFF1",
  surface: "#FCFCFC",
  border:  "#E2E6EA",
  fg:      "#151313",
  sub:     "#64748B",
  muted:   "#94A3B8",
};

// ── Navigation structure ──────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: null,
    items: [{ id: "overview", label: "Dashboard", Icon: LayoutDashboard }],
  },
  {
    label: "ACADEMIC",
    items: [
      { id: "groups",   label: "Groups",   Icon: School },
      { id: "students", label: "Students", Icon: GraduationCap },
    ],
  },
  {
    label: "CONTENT",
    items: [
      { id: "materials", label: "Materials & Tasks", Icon: BookOpen },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { id: "payments", label: "Payments", Icon: CreditCard },
    ],
  },
];

const ADMIN_TAB_MAP = { lms: "groups", materials: "materials", payments: "payments" };

// ── LmsApp ────────────────────────────────────────────────────────────────────
export default function LmsApp({ db, session, initialTab = "overview", onBack }) {
  const startTab = ADMIN_TAB_MAP[initialTab] ?? initialTab;
  const [tab, setTab] = useState(startTab);

  const PAGE_TITLE = {
    overview:  "Dashboard",
    groups:    "Groups",
    students:  "Students",
    materials: "Materials & Tasks",
    payments:  "Payments",
  }[tab] ?? "LMS";

  const navTo = (dest) => {
    const mapped = ADMIN_TAB_MAP[dest] ?? dest;
    if (mapped in { overview:1, groups:1, students:1, materials:1, payments:1 }) {
      setTab(mapped);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 150,
      display: "flex",
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
      background: T.bg,
    }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 228, flexShrink: 0,
        background: SIDEBAR,
        display: "flex", flexDirection: "column",
        borderRight: "1px solid rgba(255,255,255,.05)",
      }}>

        {/* Brand */}
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
          <img
            src="/logo-white.png"
            alt="LingvoConnect"
            style={{ height: 22, width: "auto", display: "block", marginBottom: 10 }}
          />
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: `${BRAND}1A`,
            border: `1px solid ${BRAND}33`,
            borderRadius: 5, padding: "3px 9px",
          }}>
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
              color: BRAND, textTransform: "uppercase",
            }}>LMS Portal</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "10px 0", scrollbarWidth: "none" }}>
          {NAV_SECTIONS.map(({ label, items }) => (
            <div key={label ?? "__top"} style={{ marginBottom: 2 }}>
              {label && (
                <div style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em",
                  color: "rgba(255,255,255,.18)",
                  padding: "12px 20px 5px",
                  textTransform: "uppercase",
                }}>{label}</div>
              )}
              {items.map(({ id, label: lbl, Icon }) => {
                const active = tab === id;
                return (
                  <NavItem
                    key={id}
                    id={id} label={lbl} Icon={Icon}
                    active={active}
                    onClick={() => setTab(id)}
                  />
                );
              })}
            </div>
          ))}
        </nav>

        {/* Back to Admin */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <button
            onClick={onBack}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "8px 12px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 7, cursor: "pointer",
              color: "rgba(255,255,255,.3)",
              fontSize: 12, fontWeight: 500,
              transition: "all .12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.05)"; e.currentTarget.style.color = "rgba(255,255,255,.55)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,.3)"; }}
          >
            <ArrowLeft size={13}/>
            Back to Admin
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          height: 54,
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 15, fontWeight: 700, color: T.fg,
              letterSpacing: "-0.025em",
            }}>{PAGE_TITLE}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {session && (
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "4px 10px 4px 7px",
                background: T.bg, borderRadius: 20,
                border: `1px solid ${T.border}`,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: `${BRAND}22`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <User size={11} color={BRAND}/>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: T.sub }}>
                  {session.username}
                </span>
              </div>
            )}
            {/* Bell in a small dark wrapper so it's visible */}
            <div style={{
              background: SIDEBAR, borderRadius: 8,
              display: "flex", alignItems: "center",
            }}>
              <NotificationBell
                payments={MOCK_PAYMENTS}
                groups={MOCK_GROUPS}
                onNav={navTo}
              />
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{
          flex: 1, overflowY: "auto",
          padding: 28,
          scrollbarWidth: "thin",
          scrollbarColor: "#CBD5E1 transparent",
        }}>
          {tab === "overview"  && <LmsDashboard session={session} onNav={navTo}/>}
          {tab === "groups"    && <GroupManager db={db}/>}
          {tab === "students"  && <LmsStudents/>}
          {tab === "materials" && <MaterialsTasksManager/>}
          {tab === "payments"  && <PaymentsManager/>}
        </main>
      </div>
    </div>
  );
}

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({ id, label, Icon, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        width: "100%", padding: "7px 18px 7px 18px",
        border: "none", cursor: "pointer", textAlign: "left",
        background: active
          ? `${BRAND}14`
          : hov ? "rgba(255,255,255,.04)" : "transparent",
        color: active
          ? BRAND
          : hov ? "rgba(255,255,255,.65)" : "rgba(255,255,255,.38)",
        borderLeft: `2px solid ${active ? BRAND : "transparent"}`,
        fontSize: 13, fontWeight: active ? 600 : 400,
        transition: "background .1s, color .1s",
      }}
    >
      <Icon size={14} strokeWidth={active ? 2.2 : 1.6}/>
      {label}
    </button>
  );
}

// ── Students tab (from mock data) ─────────────────────────────────────────────
function LmsStudents() {
  const [search, setSearch] = useState("");
  const filtered = MOCK_STUDENTS.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header row */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: T.fg, margin: 0, letterSpacing: "-0.03em" }}>
            Students
          </h1>
          <p style={{ fontSize: 13, color: T.muted, margin: "3px 0 0" }}>
            {MOCK_STUDENTS.length} enrolled students
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 8, padding: "7px 12px",
          }}>
            <Search size={13} color={T.muted}/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search students…"
              style={{
                border: "none", outline: "none", background: "transparent",
                fontSize: 13, color: T.fg, width: 180,
              }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10, overflow: "hidden",
      }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto auto",
          padding: "10px 20px",
          borderBottom: `1px solid ${T.border}`,
          background: T.bg,
        }}>
          {["Name", "Email", "Status", ""].map(h => (
            <span key={h} style={{
              fontSize: 11, fontWeight: 700, color: T.muted,
              letterSpacing: "0.04em", textTransform: "uppercase",
            }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {filtered.map((s, i) => (
          <StudentRow key={s.student_id} student={s} last={i === filtered.length - 1}/>
        ))}

        {filtered.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>
            No students match your search.
          </div>
        )}
      </div>
    </div>
  );
}

function StudentRow({ student, last }) {
  const [hov, setHov] = useState(false);
  const initials = student.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const COLORS = ["#11CD87", "#8B5CF6", "#3B82F6", "#F59E0B", "#EF4444", "#EC4899"];
  const color = COLORS[student.student_id.charCodeAt(student.student_id.length - 1) % COLORS.length];

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto auto",
        padding: "12px 20px",
        alignItems: "center",
        borderBottom: last ? "none" : `1px solid ${T.border}`,
        background: hov ? T.bg : "transparent",
        transition: "background .1s",
      }}
    >
      {/* Name + avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: `${color}18`, border: `1px solid ${color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, color, flexShrink: 0,
        }}>{initials}</div>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.fg }}>{student.full_name}</span>
      </div>

      {/* Email */}
      <span style={{ fontSize: 12, color: T.sub }}>{student.email}</span>

      {/* Status */}
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: student.status === "active" ? BRAND : T.muted,
        background: student.status === "active" ? `${BRAND}15` : T.bg,
        padding: "2px 8px", borderRadius: 4,
      }}>{student.status}</span>

      {/* Arrow */}
      <ChevronRight size={14} color={T.muted} style={{ opacity: hov ? 1 : 0, transition: "opacity .1s" }}/>
    </div>
  );
}
