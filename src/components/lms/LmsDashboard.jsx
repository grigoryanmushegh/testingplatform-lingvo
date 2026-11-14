import { useState, useEffect } from "react";
import {
  CalendarDays, CreditCard, Users, AlertCircle,
  Clock, CheckCircle, ChevronRight, GraduationCap,
  Bell, ArrowRight, Layers
} from "lucide-react";
import { getGroups, getPayments } from "../../lib/lmsDb.js";
import { getAllStudents } from "../../lib/studentDb.js";
import { mockGetAllGroups, mockGetPayments, mockGetAllStudents } from "../../lib/lmsDevMock.js";

const IS_DEV = import.meta.env.DEV;
async function tryOrMock(realFn, mockFn, ...args) {
  if (!IS_DEV) return realFn(...args);
  try { const r = await realFn(...args); if (r && (Array.isArray(r) ? r.length : true)) return r; throw new Error("empty"); }
  catch { return mockFn(...args); }
}

// ── Design tokens (matches App.jsx AD object) ─────────────────────────────────
const T = {
  blue:    "#2D5DDC",
  blueLt:  "#EBF0FF",
  green:   "#C4F03B",
  greenLt: "#F5FCDB",
  teal:    "#2D5DDC",
  tealLt:  "#EBF0FF",
  amber:   "#F59E0B",
  amberLt: "#FEF3C7",
  red:     "#EF4444",
  redLt:   "#FEF2F2",
  bg:      "#EEEFF1",
  border:  "#E2E6EA",
  text:    "#151313",
  sub:     "#64748B",
  muted:   "#94A3B8",
  white:   "#FCFCFC",
};

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_S   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(ds) {
  const d = new Date(ds);
  return `${DAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_S[d.getMonth()]}`;
}
function dayDiff(ds) {
  const now = new Date(); now.setHours(0,0,0,0);
  const d   = new Date(ds); d.setHours(0,0,0,0);
  return Math.round((d-now)/864e5);
}
function upcomingFromSchedule(group, daysAhead = 7) {
  const schedule = group.schedule || [];
  if (!schedule.length) return [];
  const out = [];
  const now = new Date(); now.setHours(0,0,0,0);
  for (let d = 0; d <= daysAhead; d++) {
    const date = new Date(now); date.setDate(date.getDate() + d);
    const slot = schedule.find(s => s.day === date.getDay());
    if (slot) out.push({ group, date: date.toISOString().split("T")[0], start: slot.start, end: slot.end, diff: d });
  }
  return out;
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <span style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>{title}</span>
      {action && (
        <button onClick={onAction} style={{
          display: "flex", alignItems: "center", gap: 4,
          fontSize: 12, color: T.blue, fontWeight: 600,
          background: "none", border: "none", cursor: "pointer",
        }}>
          {action} <ArrowRight size={12}/>
        </button>
      )}
    </div>
  );
}

// ── Session card — Acadence style ─────────────────────────────────────────────
function SessionCard({ item, onNav }) {
  const [hov, setHov] = useState(false);
  const diff    = item.diff;
  const isToday = diff === 0;
  const isTmrw  = diff === 1;
  const label   = isToday ? "Today" : isTmrw ? "Tomorrow" : DAY_NAMES[new Date(item.date).getDay()];
  const dateStr = diff > 1 ? `${label}, ${fmtDate(item.date)}` : label;
  // pick accent from group color, fall back to blue
  const accent  = item.group.color || T.blue;

  return (
    <div
      onClick={() => onNav?.("lms")}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.white,
        borderRadius: 12,
        border: `1px solid ${hov ? T.blue + "55" : T.border}`,
        padding: "16px 18px",
        cursor: "pointer",
        marginBottom: 10,
        transition: "border-color .15s, box-shadow .15s",
        boxShadow: hov ? "0 2px 12px rgba(0,89,160,.08)" : "none",
      }}
    >
      {/* Row 1: tag + today badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: ".07em",
          textTransform: "uppercase",
          color: accent,
          background: `${accent}14`,
          padding: "3px 9px", borderRadius: 5,
        }}>
          Live Session
        </span>
        {isToday && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: T.green, background: T.greenLt,
            padding: "3px 10px", borderRadius: 20,
          }}>Today</span>
        )}
      </div>

      {/* Row 2: group name */}
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 10 }}>
        {item.group.name}
      </div>

      {/* Row 3: time · date · level */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.sub }}>
          <Clock size={12} color={T.muted}/>
          {item.start.slice(0, 5)} – {item.end.slice(0, 5)}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.sub }}>
          <CalendarDays size={12} color={T.muted}/>
          {dateStr}
        </span>
        {item.group.level && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: T.blue, background: T.blueLt,
            padding: "2px 8px", borderRadius: 5,
          }}>
            {item.group.level}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Payment row ───────────────────────────────────────────────────────────────
function PaymentRow({ p, sMap, isLast }) {
  const st  = sMap[p.student_id];
  const cfg = p.status === "overdue"
    ? { color: T.red,   bg: T.redLt,   label: "Overdue" }
    : { color: T.amber, bg: T.amberLt, label: "Pending" };

  const initials = (p.student_name || st?.full_name || "?")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 0",
      borderBottom: isLast ? "none" : `1px solid ${T.border}`,
    }}>
      {/* Avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: T.blueLt,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, color: T.blue,
        }}>{initials}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontWeight: 600, fontSize: 13, color: T.text, marginBottom: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {p.student_name || st?.full_name || p.student_id}
          </div>
          <div style={{ fontSize: 11, color: T.muted }}>
            {p.group_name || p.description || p.type}
          </div>
        </div>
      </div>

      {/* Amount + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: cfg.color }}>
          {(+p.amount).toLocaleString()} <span style={{ fontSize: 10, fontWeight: 500, color: T.muted }}>AMD</span>
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: cfg.color, background: cfg.bg,
          padding: "3px 9px", borderRadius: 20,
        }}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

// ── Group summary card ─────────────────────────────────────────────────────────
function GroupCard({ g, onNav }) {
  const [hov, setHov] = useState(false);
  const days = (g.schedule || []).map(s => DAY_SHORT[s.day]).join(" · ");
  return (
    <div
      onClick={() => onNav?.("lms")}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.white,
        borderRadius: 12,
        border: `1px solid ${hov ? T.border : T.border}`,
        padding: "14px 16px",
        cursor: "pointer",
        marginBottom: 8,
        boxShadow: hov ? "0 2px 8px rgba(0,0,0,.05)" : "none",
        transition: "box-shadow .15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{g.name}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 3, display: "flex", alignItems: "center", gap: 8 }}>
            {g.level && (
              <span style={{ fontWeight: 700, color: T.blue, background: T.blueLt, padding: "1px 7px", borderRadius: 4 }}>
                {g.level}
              </span>
            )}
            {g.teacher_username && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <GraduationCap size={10}/> {g.teacher_username}
              </span>
            )}
            {days && <span>{days}</span>}
          </div>
        </div>
        <ChevronRight size={14} color={T.muted}/>
      </div>
    </div>
  );
}

// ── Total summary tile ─────────────────────────────────────────────────────────
function TotalTile({ label, value, color, colorLt }) {
  return (
    <div style={{
      background: T.white,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: "16px 18px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>
        {value.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 500, color: T.muted }}>AMD</span>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function LmsDashboard({ session, onNav }) {
  const [groups,   setGroups]   = useState([]);
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [ready,    setReady]    = useState(false);

  const role      = session?.role || "admin";
  const username  = session?.username || "";
  const isTeacher = role === "teacher";
  const isAdmin   = role === "admin" || role === "superadmin";

  useEffect(() => {
    Promise.all([
      tryOrMock(getGroups,     mockGetAllGroups),
      tryOrMock(getPayments,   mockGetPayments),
      tryOrMock(getAllStudents, mockGetAllStudents),
    ])
      .then(([g, p, s]) => { setGroups(g||[]); setPayments(p||[]); setStudents(s||[]); setReady(true); })
      .catch(() => setReady(true));
  }, []);

  if (!ready) return null;

  const sMap         = Object.fromEntries(students.map(s => [s.student_id, s]));
  const activeGroups = groups.filter(g => g.status === "active");
  const myGroups     = isTeacher
    ? activeGroups.filter(g => g.teacher_username === username)
    : activeGroups;

  const upcoming = myGroups
    .flatMap(g => upcomingFromSchedule(g, 7))
    .sort((a, b) => a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date));

  const overduePayments = payments.filter(p => p.status === "overdue")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const pendingPayments = payments.filter(p => p.status === "pending")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const overdueTotal = overduePayments.reduce((s, p) => s + (+p.amount || 0), 0);
  const pendingTotal = pendingPayments.reduce((s, p) => s + (+p.amount || 0), 0);

  // ── Teacher layout ──────────────────────────────────────────────────────────
  if (isTeacher) {
    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <SectionHeader title="Your Classes This Week" action="Go to Groups" onAction={() => onNav?.("lms")}/>
            {upcoming.length === 0
              ? <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: 36, textAlign: "center" }}>
                  <CalendarDays size={28} color={T.muted} style={{ marginBottom: 8 }}/>
                  <div style={{ fontSize: 13, color: T.muted }}>No classes scheduled this week.</div>
                </div>
              : upcoming.slice(0, 6).map((u, i) => <SessionCard key={i} item={u} onNav={onNav}/>)
            }
          </div>
          <div>
            <SectionHeader title="My Groups" action="Manage" onAction={() => onNav?.("lms")}/>
            {myGroups.length === 0
              ? <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: 36, textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: T.muted }}>No groups assigned yet.</div>
                </div>
              : myGroups.map(g => <GroupCard key={g.id} g={g} onNav={onNav}/>)
            }
          </div>
        </div>
      </div>
    );
  }

  // ── Admin / SuperAdmin layout ───────────────────────────────────────────────
  if (isAdmin) {
    return (
      <div style={{ marginBottom: 32 }}>

        {/* Overdue alert banner */}
        {overduePayments.length > 0 && (
          <div onClick={() => onNav?.("payments")} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 18px",
            background: T.redLt,
            border: `1px solid ${T.red}30`,
            borderRadius: 12,
            marginBottom: 20,
            cursor: "pointer",
          }}>
            <Bell size={16} color={T.red}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: T.red }}>
                {overduePayments.length} overdue payment{overduePayments.length !== 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 11, color: `${T.red}99` }}>
                Total: {overdueTotal.toLocaleString()} AMD — click to review
              </div>
            </div>
            <ChevronRight size={14} color={T.red}/>
          </div>
        )}

        {/* Two-column: sessions + payments */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Left — upcoming sessions */}
          <div>
            <SectionHeader title="Upcoming Live Sessions" action="All Groups →" onAction={() => onNav?.("lms")}/>
            {upcoming.length === 0
              ? <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: 36, textAlign: "center" }}>
                  <CalendarDays size={28} color={T.muted} style={{ marginBottom: 8 }}/>
                  <div style={{ fontSize: 13, color: T.muted }}>No sessions scheduled this week.</div>
                </div>
              : upcoming.slice(0, 6).map((u, i) => <SessionCard key={i} item={u} onNav={onNav}/>)
            }
          </div>

          {/* Right — payment alerts */}
          <div>
            <SectionHeader title="Payment Alerts" action="View All →" onAction={() => onNav?.("payments")}/>

            {overduePayments.length === 0 && pendingPayments.length === 0
              ? <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: 36, textAlign: "center" }}>
                  <CheckCircle size={28} color={T.green} style={{ marginBottom: 8 }}/>
                  <div style={{ fontSize: 13, color: T.muted }}>All payments are up to date.</div>
                </div>
              : <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: "0 18px" }}>

                  {overduePayments.length > 0 && (
                    <>
                      <div style={{
                        padding: "14px 0 4px",
                        fontSize: 11, fontWeight: 800, color: T.red,
                        textTransform: "uppercase", letterSpacing: ".07em",
                      }}>Overdue</div>
                      {overduePayments.slice(0, 4).map((p, i) =>
                        <PaymentRow key={p.id} p={p} sMap={sMap}
                          isLast={i === overduePayments.slice(0, 4).length - 1 && pendingPayments.length === 0}/>
                      )}
                    </>
                  )}

                  {pendingPayments.length > 0 && (
                    <>
                      <div style={{
                        padding: "14px 0 4px",
                        fontSize: 11, fontWeight: 800, color: T.amber,
                        textTransform: "uppercase", letterSpacing: ".07em",
                        borderTop: overduePayments.length > 0 ? `1px solid ${T.border}` : "none",
                      }}>Pending</div>
                      {pendingPayments.slice(0, 4).map((p, i) =>
                        <PaymentRow key={p.id} p={p} sMap={sMap}
                          isLast={i === pendingPayments.slice(0, 4).length - 1}/>
                      )}
                    </>
                  )}
                </div>
            }

            {/* Summary tiles */}
            {(overdueTotal > 0 || pendingTotal > 0) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                {overdueTotal > 0 && <TotalTile label="Total Overdue" value={overdueTotal} color={T.red} colorLt={T.redLt}/>}
                {pendingTotal > 0 && <TotalTile label="Total Pending" value={pendingTotal} color={T.amber} colorLt={T.amberLt}/>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Staff / Coordinator layout ──────────────────────────────────────────────
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <SectionHeader title="Overdue Payments" action="View All →" onAction={() => onNav?.("payments")}/>
          {overduePayments.length === 0
            ? <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: 32, textAlign: "center" }}>
                <CheckCircle size={28} color={T.green} style={{ marginBottom: 8 }}/>
                <div style={{ fontSize: 13, color: T.muted }}>No overdue payments.</div>
              </div>
            : <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: "0 18px" }}>
                {overduePayments.slice(0, 6).map((p, i) =>
                  <PaymentRow key={p.id} p={p} sMap={sMap} isLast={i === Math.min(overduePayments.length, 6) - 1}/>
                )}
              </div>
          }
          {overdueTotal > 0 && <div style={{ marginTop: 10 }}><TotalTile label="Total Overdue" value={overdueTotal} color={T.red} colorLt={T.redLt}/></div>}
        </div>

        <div>
          <SectionHeader title="Pending Payments" action="View All →" onAction={() => onNav?.("payments")}/>
          {pendingPayments.length === 0
            ? <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: 32, textAlign: "center" }}>
                <CheckCircle size={28} color={T.green} style={{ marginBottom: 8 }}/>
                <div style={{ fontSize: 13, color: T.muted }}>No pending payments.</div>
              </div>
            : <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: "0 18px" }}>
                {pendingPayments.slice(0, 6).map((p, i) =>
                  <PaymentRow key={p.id} p={p} sMap={sMap} isLast={i === Math.min(pendingPayments.length, 6) - 1}/>
                )}
              </div>
          }
          {pendingTotal > 0 && <div style={{ marginTop: 10 }}><TotalTile label="Total Pending" value={pendingTotal} color={T.amber} colorLt={T.amberLt}/></div>}
        </div>
      </div>
    </div>
  );
}
