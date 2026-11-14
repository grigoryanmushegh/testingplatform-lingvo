import { useState, useEffect, useRef } from "react";
import { Bell, CreditCard, UserX, CalendarDays, X, CheckCheck } from "lucide-react";

const C = {
  brand:"#11CD87", brandL:"#E8FDF5", fg:"#0F172A",
  s300:"#CBD5E1", s400:"#94A3B8", s500:"#64748B",
  border:"#E2E8F0", card:"#fff", bg:"#F8FAFC",
  red:"#EF4444", redL:"#FEF2F2",
  amber:"#F59E0B", amberL:"#FFFBEB",
  blue:"#3B82F6", blueL:"#EFF6FF",
};

const STORE_KEY = "lc_notifications";

function loadNotes() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}
function saveNotes(d) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch {}
}

// Build notifications from live data (payments + mock attendance)
function buildNotifications(payments, groups, students) {
  const notes = [];
  const today = new Date().toISOString().split("T")[0];

  // 1. Overdue payments
  (payments||[]).filter(p => p.status === "overdue").forEach(p => {
    const daysOverdue = p.due_date
      ? Math.round((new Date(today) - new Date(p.due_date)) / 864e5)
      : null;
    notes.push({
      id: `overdue_${p.id}`,
      type: "overdue",
      title: `Overdue payment — ${p.student_name || p.student_id}`,
      body: `${(+p.amount).toLocaleString()} ${p.currency}${daysOverdue > 0 ? ` · ${daysOverdue}d overdue` : ""}${p.group_name ? ` · ${p.group_name}` : ""}`,
      severity: "red",
      ts: p.due_date || today,
      nav: "payments",
    });
  });

  // 2. Pending payments overdue soon (due within 3 days)
  (payments||[]).filter(p => p.status === "pending" && p.due_date).forEach(p => {
    const daysLeft = Math.round((new Date(p.due_date) - new Date(today)) / 864e5);
    if (daysLeft >= 0 && daysLeft <= 3) {
      notes.push({
        id: `due_soon_${p.id}`,
        type: "due_soon",
        title: `Payment due soon — ${p.student_name || p.student_id}`,
        body: `${(+p.amount).toLocaleString()} ${p.currency} due in ${daysLeft === 0 ? "today" : `${daysLeft}d`}${p.group_name ? ` · ${p.group_name}` : ""}`,
        severity: "amber",
        ts: p.due_date,
        nav: "payments",
      });
    }
  });

  // 3. Sessions today
  const DAY = new Date().getDay();
  (groups||[]).filter(g => g.status === "active").forEach(g => {
    const slot = (g.schedule||[]).find(s => s.day === DAY);
    if (slot) {
      notes.push({
        id: `session_today_${g.id}`,
        type: "session",
        title: `Class today — ${g.name}`,
        body: `${slot.start}–${slot.end}${g.teacher_username ? ` · ${g.teacher_username}` : ""}`,
        severity: "blue",
        ts: today,
        nav: "lms",
      });
    }
  });

  return notes.sort((a, b) => {
    const sev = { red: 0, amber: 1, blue: 2 };
    return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3);
  });
}

const SEV_CFG = {
  red:   { Icon: CreditCard,   color: C.red,   bg: C.redL   },
  amber: { Icon: CreditCard,   color: C.amber, bg: C.amberL },
  blue:  { Icon: CalendarDays, color: C.blue,  bg: C.blueL  },
};

export default function NotificationBell({ payments, groups, students, onNav }) {
  const [open,  setOpen]  = useState(false);
  const [read,  setRead]  = useState(() => loadNotes().read || []);
  const ref = useRef(null);

  const notes = buildNotifications(payments, groups, students);
  const unread = notes.filter(n => !read.includes(n.id));

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const markAllRead = () => {
    const ids = notes.map(n => n.id);
    setRead(ids);
    saveNotes({ read: ids });
  };

  const markOne = (id) => {
    const next = [...new Set([...read, id])];
    setRead(next);
    saveNotes({ read: next });
  };

  const handleNav = (note) => {
    markOne(note.id);
    setOpen(false);
    onNav?.(note.nav);
  };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position:"relative", display:"flex", alignItems:"center", justifyContent:"center",
          width:36, height:36, borderRadius:8, border:"none", cursor:"pointer",
          background: open ? "rgba(255,255,255,.12)" : "transparent",
          color:"rgba(255,255,255,.7)", transition:"background .15s",
        }}
      >
        <Bell size={18}/>
        {unread.length > 0 && (
          <span style={{
            position:"absolute", top:4, right:4,
            width:16, height:16, borderRadius:"50%",
            background: C.red, color:"#fff",
            fontSize:9, fontWeight:800,
            display:"flex", alignItems:"center", justifyContent:"center",
            border:"2px solid #0A0F1E",
          }}>{unread.length > 9 ? "9+" : unread.length}</span>
        )}
      </button>

      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 8px)", right:0, zIndex:999,
          width:340, background:C.card, border:`1px solid ${C.border}`,
          borderRadius:10, boxShadow:"0 8px 32px rgba(0,0,0,.14)",
          overflow:"hidden",
        }}>
          {/* Header */}
          <div style={{
            display:"flex", justifyContent:"space-between", alignItems:"center",
            padding:"12px 16px", borderBottom:`1px solid ${C.border}`,
          }}>
            <span style={{ fontWeight:800, fontSize:14, color:C.fg }}>
              Notifications {unread.length > 0 && (
                <span style={{ fontSize:11, fontWeight:600, color:C.red, marginLeft:4 }}>
                  {unread.length} new
                </span>
              )}
            </span>
            {unread.length > 0 && (
              <button onClick={markAllRead} style={{
                display:"flex", alignItems:"center", gap:4,
                fontSize:11, color:C.s500, background:"none", border:"none", cursor:"pointer", fontWeight:600,
              }}>
                <CheckCheck size={13}/> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight:380, overflowY:"auto" }}>
            {notes.length === 0 && (
              <div style={{ padding:"36px 20px", textAlign:"center", color:C.s400, fontSize:13 }}>
                <Bell size={28} color={C.s300} style={{ marginBottom:8, display:"block", margin:"0 auto 8px" }}/>
                All clear — no alerts right now
              </div>
            )}
            {notes.map(n => {
              const isRead = read.includes(n.id);
              const cfg = SEV_CFG[n.severity] || SEV_CFG.blue;
              const Icon = cfg.Icon;
              return (
                <div
                  key={n.id}
                  onClick={() => handleNav(n)}
                  style={{
                    display:"flex", gap:12, padding:"12px 16px", cursor:"pointer",
                    background: isRead ? "transparent" : `${cfg.bg}80`,
                    borderBottom:`1px solid ${C.border}`,
                    transition:"background .1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg}
                  onMouseLeave={e => e.currentTarget.style.background = isRead ? "transparent" : `${cfg.bg}80`}
                >
                  <div style={{
                    width:32, height:32, borderRadius:8, flexShrink:0,
                    background:cfg.bg, display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    <Icon size={15} color={cfg.color}/>
                  </div>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{
                      fontSize:13, fontWeight: isRead ? 500 : 700,
                      color: isRead ? C.s500 : C.fg,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    }}>{n.title}</div>
                    <div style={{ fontSize:11, color:C.s400, marginTop:2, lineHeight:1.4 }}>{n.body}</div>
                  </div>
                  {!isRead && (
                    <div style={{ width:7, height:7, borderRadius:"50%", background:cfg.color, flexShrink:0, marginTop:4 }}/>
                  )}
                </div>
              );
            })}
          </div>

          {notes.length > 0 && (
            <div style={{ padding:"10px 16px", borderTop:`1px solid ${C.border}`, textAlign:"center" }}>
              <button onClick={() => { setOpen(false); onNav?.("payments"); }} style={{
                fontSize:12, color:C.s400, background:"none", border:"none", cursor:"pointer", fontWeight:600,
              }}>View all payments →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
