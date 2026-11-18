import { useState, useEffect, useCallback, useRef } from "react";
import {
  CreditCard, Plus, Save, Loader, Trash2, Edit2, CheckCircle,
  AlertCircle, Clock, Search, Users, FileText, CalendarClock,
  Printer, Download, X, Mail, Send,
} from "lucide-react";
import { getPayments, createPayment, updatePayment, deletePayment } from "../../lib/lmsDb.js";
import { getAllStudents } from "../../lib/studentDb.js";

// ── AD design tokens ──────────────────────────────────────────────────────────
const AD = {
  blue:"#2D5DDC", blueLt:"#EBF0FF",
  red:"#EF4444",  redLt:"#FEE2E2",
  amber:"#F59E0B",amberLt:"#FEF3C7",
  green:"#10B981",greenLt:"#D1FAE5",
  bg:"#EEEFF1", surface:"#FCFCFC", border:"#E2E6EA",
  text:"#151313", sub:"#64748B", muted:"#94A3B8",
};

const STATUS_CFG = {
  paid:    { label:"Paid",    color:AD.green, bg:AD.greenLt, icon:CheckCircle },
  pending: { label:"Pending", color:AD.amber, bg:AD.amberLt, icon:Clock       },
  overdue: { label:"Overdue", color:AD.red,   bg:AD.redLt,   icon:AlertCircle },
};

const CURRENCIES = ["AMD","USD","EUR","RUB","GBP"];
const TYPES      = ["tuition","deposit","material","exam_fee","other"];

// ── Style helpers ─────────────────────────────────────────────────────────────
const card = (e={}) => ({ background:AD.surface, borderRadius:16, border:`1px solid ${AD.border}`, ...e });
const inp  = { display:"block",width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:8,border:`1px solid ${AD.border}`,fontSize:13,color:AD.text,background:"#fff",outline:"none",fontFamily:"inherit" };
const lbl  = { display:"block",fontSize:11,fontWeight:700,color:AD.sub,marginBottom:4,marginTop:12,textTransform:"uppercase",letterSpacing:"0.07em" };

function PillBtn({ onClick, variant="primary", disabled, children, style={} }) {
  const base = { display:"inline-flex",alignItems:"center",gap:6,padding:"8px 18px",borderRadius:20,fontWeight:700,fontSize:13,cursor:disabled?"not-allowed":"pointer",border:"none",transition:"all .15s",fontFamily:"inherit", ...style };
  if (variant==="primary") return <button onClick={onClick} disabled={disabled} style={{...base,background:AD.blue,color:"#fff",opacity:disabled?.6:1}}>{children}</button>;
  if (variant==="ghost")   return <button onClick={onClick} disabled={disabled} style={{...base,background:"transparent",color:AD.sub,border:`1px solid ${AD.border}`}}>{children}</button>;
  if (variant==="danger")  return <button onClick={onClick} disabled={disabled} style={{...base,background:AD.redLt,color:AD.red,border:`1px solid ${AD.red}30`}}>{children}</button>;
  return <button onClick={onClick} disabled={disabled} style={{...base}}>{children}</button>;
}

// ── Build invoice HTML ────────────────────────────────────────────────────────
function buildInvoiceHtml(payment, students) {
  const st = students.find(s => s.student_id === payment.student_id);
  const name = st?.full_name || payment.student_id || "Student";
  const invoiceNo = "INV-" + (payment.id ? payment.id.toString(36).toUpperCase().slice(-8) : Date.now().toString(36).toUpperCase().slice(-6));
  const issued = new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});
  const paymentDate = payment.date
    ? new Date(payment.date).toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})
    : issued;
  const deadlineFmt = payment.deadline
    ? new Date(payment.deadline).toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})
    : null;
  const typeFmt = (payment.type||"tuition").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  const statusColor = payment.status==="paid"?"#059669":payment.status==="overdue"?"#DC2626":"#D97706";
  const statusBg    = payment.status==="paid"?"#D1FAE5":payment.status==="overdue"?"#FEE2E2":"#FEF3C7";
  const statusLabel = (payment.status||"pending").charAt(0).toUpperCase()+(payment.status||"pending").slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Invoice ${invoiceNo} — LingvoConnect</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;color:#151313;background:#fff;padding:40px 20px}
  .wrap{max-width:680px;margin:0 auto}
  /* ─── Header ─── */
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px;gap:16px}
  .brand-name{font-size:24px;font-weight:800;color:#2D5DDC;letter-spacing:-0.03em;line-height:1}
  .brand-sub{font-size:11px;font-weight:500;color:#94A3B8;margin-top:3px;letter-spacing:.04em;text-transform:uppercase}
  .inv-block{text-align:right}
  .inv-label{font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.07em}
  .inv-num{font-size:22px;font-weight:800;color:#151313;margin-top:4px;letter-spacing:-0.02em}
  .inv-issued{font-size:12px;color:#64748B;margin-top:4px}
  /* ─── Parties ─── */
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:36px}
  .party-label{font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}
  .party-name{font-size:16px;font-weight:800;color:#151313}
  .party-id{font-size:12px;color:#64748B;margin-top:2px}
  .party-email{font-size:12px;color:#2D5DDC;margin-top:2px}
  /* ─── Deadline banner ─── */
  .deadline-banner{background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 20px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center}
  .dl-label{font-size:12px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:.05em}
  .dl-date{font-size:16px;font-weight:800;color:#92400E}
  /* ─── Line-items table ─── */
  table{width:100%;border-collapse:collapse;margin-bottom:28px}
  thead th{font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.07em;padding:10px 14px;background:#F8F9FA;border-bottom:2px solid #E2E6EA;text-align:left}
  thead th:last-child{text-align:right}
  tbody td{padding:16px 14px;border-bottom:1px solid #F1F5F9;font-size:13px;color:#151313;vertical-align:top}
  tbody td:last-child{text-align:right;font-weight:800;font-size:14px}
  .item-desc{font-weight:700;font-size:14px;color:#151313}
  .item-type{font-size:12px;color:#64748B;margin-top:3px}
  /* ─── Totals ─── */
  .totals{display:flex;justify-content:flex-end;margin-bottom:28px}
  .totals-box{min-width:260px}
  .total-row{display:flex;justify-content:space-between;padding:8px 0;font-size:13px;color:#64748B;border-bottom:1px solid #F1F5F9}
  .grand-total{display:flex;justify-content:space-between;padding:14px 0 0;font-size:18px;font-weight:800;color:#151313;border-top:2px solid #151313;margin-top:4px}
  /* ─── Status + Notes ─── */
  .footer-row{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:40px}
  .status-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700}
  .notes-box{font-size:12px;color:#64748B;background:#F8F9FA;border-radius:8px;padding:10px 14px;flex:1;min-width:200px}
  .notes-label{font-weight:700;color:#151313;margin-bottom:3px;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  /* ─── Page footer ─── */
  .page-footer{text-align:center;font-size:11px;color:#94A3B8;padding-top:20px;border-top:1px solid #E2E6EA}
  .page-footer strong{color:#2D5DDC}
  /* ─── Print ─── */
  .no-print{display:block}
  @media print{
    .no-print{display:none!important}
    body{padding:20px}
  }
</style>
</head>
<body>
<div class="wrap">

  <!-- Print button (hidden when printing) -->
  <div class="no-print" style="text-align:right;margin-bottom:20px;display:flex;gap:10px;justify-content:flex-end">
    <button onclick="window.print()" style="background:#2D5DDC;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px">
      Print / Save as PDF
    </button>
  </div>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand-name">LingvoConnect</div>
      <div class="brand-sub">IELTS Platform</div>
    </div>
    <div class="inv-block">
      <div class="inv-label">Invoice</div>
      <div class="inv-num">${invoiceNo}</div>
      <div class="inv-issued">Issued ${issued}</div>
    </div>
  </div>

  <!-- Parties -->
  <div class="parties">
    <div>
      <div class="party-label">From</div>
      <div class="party-name">LingvoConnect</div>
      <div class="party-id">IELTS Preparation Platform</div>
    </div>
    <div>
      <div class="party-label">Bill to</div>
      <div class="party-name">${name}</div>
      ${st?.username ? `<div class="party-id">@${st.username}</div>` : ""}
      ${st?.email ? `<div class="party-email">${st.email}</div>` : ""}
    </div>
  </div>

  ${deadlineFmt ? `
  <!-- Deadline -->
  <div class="deadline-banner">
    <div class="dl-label">Payment Due</div>
    <div class="dl-date">${deadlineFmt}</div>
  </div>` : ""}

  <!-- Line items -->
  <table>
    <thead>
      <tr>
        <th style="width:50%">Description</th>
        <th>Type</th>
        <th>Date</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div class="item-desc">${payment.description || "Tuition Fee"}</div>
          ${payment.notes ? `<div class="item-type">${payment.notes}</div>` : ""}
        </td>
        <td style="font-size:12px;color:#64748B">${typeFmt}</td>
        <td style="font-size:12px;color:#64748B">${paymentDate}</td>
        <td>${Number(payment.amount||0).toLocaleString()} <span style="font-size:11px;color:#94A3B8;font-weight:500">${payment.currency||"AMD"}</span></td>
      </tr>
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-box">
      <div class="total-row"><span>Subtotal</span><span>${Number(payment.amount||0).toLocaleString()} ${payment.currency||"AMD"}</span></div>
      <div class="total-row"><span>Tax / VAT</span><span>Included</span></div>
      <div class="grand-total"><span>Total Due</span><span>${Number(payment.amount||0).toLocaleString()} ${payment.currency||"AMD"}</span></div>
    </div>
  </div>

  <!-- Status + Notes -->
  <div class="footer-row">
    <span class="status-badge" style="background:${statusBg};color:${statusColor}">
      ${statusLabel}
    </span>
    ${payment.notes ? `
    <div class="notes-box">
      <div class="notes-label">Internal Note</div>
      ${payment.notes}
    </div>` : ""}
  </div>

  <!-- Page footer -->
  <div class="page-footer">
    <strong>LingvoConnect</strong> · lingvoconnect.com · Thank you for your payment!
  </div>

</div>
</body>
</html>`;
}

// ── Invoice Modal ─────────────────────────────────────────────────────────────
function InvoiceModal({ payment, students, onClose }) {
  const iframeRef = useRef(null);
  const html = buildInvoiceHtml(payment, students);
  const st   = students.find(s => s.student_id === payment.student_id);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState("");

  // Close on Escape
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const invoiceNo = "INV-" + (payment.id ? payment.id.toString(36).toUpperCase().slice(-8) : Date.now().toString(36).toUpperCase().slice(-6));
    a.href     = url;
    a.download = `${invoiceNo}-${(st?.full_name||"student").replace(/\s+/g,"-")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendEmail = () => {
    if (!st?.email) {
      setSendMsg("No email on file for this student.");
      return;
    }
    const invoiceNo = "INV-" + (payment.id ? payment.id.toString(36).toUpperCase().slice(-8) : Date.now().toString(36).toUpperCase().slice(-6));
    const subject  = encodeURIComponent(`Invoice ${invoiceNo} from LingvoConnect`);
    const bodyText = `Dear ${st.full_name},\n\nPlease find your invoice details below:\n\nInvoice No: ${invoiceNo}\nDescription: ${payment.description||"Tuition Fee"}\nAmount: ${Number(payment.amount||0).toLocaleString()} ${payment.currency||"AMD"}\nStatus: ${payment.status||"pending"}\n${payment.deadline ? `\nPayment deadline: ${payment.deadline}` : ""}\n\nThank you for choosing LingvoConnect.\n\nBest regards,\nLingvoConnect Team`;
    const body = encodeURIComponent(bodyText);
    window.open(`mailto:${st.email}?subject=${subject}&body=${body}`, "_blank");
    setSendMsg(`Email composer opened for ${st.email}`);
    setTimeout(() => setSendMsg(""), 5000);
  };

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:9999,
      background:"rgba(0,0,0,.55)",backdropFilter:"blur(4px)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      padding:"16px",
    }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width:"100%",maxWidth:760,maxHeight:"90vh",
        background:AD.surface,borderRadius:20,border:`1px solid ${AD.border}`,
        boxShadow:"0 24px 64px rgba(0,0,0,.3)",
        display:"flex",flexDirection:"column",overflow:"hidden",
      }}>
        {/* Modal header */}
        <div style={{
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"14px 20px",borderBottom:`1px solid ${AD.border}`,
          background:AD.bg,flexShrink:0,
        }}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <FileText size={16} color={AD.blue}/>
            <span style={{fontWeight:800,fontSize:14,color:AD.text}}>Invoice Preview</span>
            {st && <span style={{fontSize:12,color:AD.sub}}>— {st.full_name}</span>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:AD.sub,display:"flex",padding:4,borderRadius:6}}>
            <X size={18}/>
          </button>
        </div>

        {/* Action bar */}
        <div style={{
          display:"flex",gap:8,padding:"10px 16px",
          borderBottom:`1px solid ${AD.border}`,
          background:"#fff",flexShrink:0,flexWrap:"wrap",alignItems:"center",
        }}>
          <PillBtn onClick={handlePrint} style={{gap:6,padding:"7px 14px"}}>
            <Printer size={14}/> Print / Save PDF
          </PillBtn>
          <PillBtn variant="ghost" onClick={handleDownload} style={{gap:6,padding:"7px 14px"}}>
            <Download size={14}/> Download
          </PillBtn>
          <PillBtn variant="ghost" onClick={handleSendEmail} disabled={sending} style={{gap:6,padding:"7px 14px"}}>
            <Send size={14}/> Send Invoice
          </PillBtn>
          {sendMsg && (
            <span style={{fontSize:12,color:sendMsg.startsWith("No")?AD.red:AD.green,fontWeight:600}}>
              {sendMsg}
            </span>
          )}
        </div>

        {/* Invoice iframe */}
        <iframe
          ref={iframeRef}
          srcDoc={html}
          title="Invoice Preview"
          style={{flex:1,border:"none",minHeight:400}}
          sandbox="allow-scripts allow-modals"
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PaymentsManager() {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRec, setEditRec]   = useState(null);
  const [search, setSearch]     = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStudent, setFilterStudent] = useState("");
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");
  const [hoverId, setHoverId]   = useState(null);
  const [invoiceRec, setInvoiceRec] = useState(null);

  const today = new Date().toISOString().split("T")[0];
  const emptyForm = () => ({ student_id:"", amount:"", currency:"AMD", type:"tuition", status:"paid", date:today, deadline:"", description:"", notes:"" });
  const [form, setForm] = useState(emptyForm());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([getPayments(), getAllStudents()]);
      setPayments(p||[]); setStudents(s||[]);
    } catch(e) {
      console.warn("[PaymentsManager] load error:", e?.message);
      setPayments([]); setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(emptyForm()); setEditRec(null); setErr(""); setShowForm(true); };
  const openEdit = p => {
    setEditRec(p);
    setForm({ student_id:p.student_id, amount:p.amount, currency:p.currency, type:p.type,
              status:p.status, date:p.date, deadline:p.deadline||"", description:p.description||"", notes:p.notes||"" });
    setErr(""); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditRec(null); setErr(""); };

  const save = async () => {
    if (!form.student_id) { setErr("Select a student"); return; }
    if (!form.amount || +form.amount <= 0) { setErr("Enter a valid amount"); return; }
    setSaving(true); setErr("");
    try {
      if (editRec) await updatePayment(editRec.id, form);
      else await createPayment(form);
      closeForm(); load();
    } catch(e) { setErr(e.message||"Failed to save"); }
    setSaving(false);
  };

  const remove = async id => {
    if (!window.confirm("Delete this payment record?")) return;
    await deletePayment(id); load();
  };

  const sMap = Object.fromEntries(students.map(s=>[s.student_id,s]));

  const totalPaid    = payments.filter(p=>p.status==="paid").reduce((s,p)=>s+(+p.amount||0),0);
  const totalPending = payments.filter(p=>p.status==="pending").reduce((s,p)=>s+(+p.amount||0),0);
  const totalOverdue = payments.filter(p=>p.status==="overdue").reduce((s,p)=>s+(+p.amount||0),0);

  const filtered = payments.filter(p => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterStudent && p.student_id !== filterStudent) return false;
    if (search) {
      const q = search.toLowerCase();
      const st = sMap[p.student_id];
      if (!(st?.full_name||"").toLowerCase().includes(q) && !(p.description||"").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:80,gap:12}}>
      <Loader size={22} color={AD.blue} style={{animation:"spin 1s linear infinite"}}/>
      <span style={{color:AD.sub,fontSize:13}}>Loading payments…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{padding:"4px 0",fontFamily:"inherit"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Invoice Modal */}
      {invoiceRec && (
        <InvoiceModal
          payment={invoiceRec}
          students={students}
          onClose={() => setInvoiceRec(null)}
        />
      )}

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <div>
          <h2 style={{margin:0,fontSize:22,fontWeight:800,color:AD.text,letterSpacing:"-0.03em"}}>Payments</h2>
          <p style={{margin:"4px 0 0",color:AD.sub,fontSize:13}}>Record, track and invoice student tuition payments</p>
        </div>
        <PillBtn onClick={openNew}><Plus size={15}/> New Payment</PillBtn>
      </div>

      {/* Summary tiles */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:20}}>
        {[
          {label:"Total Paid",   val:totalPaid,    color:AD.green,  bg:AD.greenLt, Icon:CheckCircle},
          {label:"Pending",      val:totalPending,  color:AD.amber,  bg:AD.amberLt, Icon:Clock},
          {label:"Overdue",      val:totalOverdue,  color:AD.red,    bg:AD.redLt,   Icon:AlertCircle},
          {label:"All Records",  val:payments.length, color:AD.blue, bg:AD.blueLt,  Icon:Users, isCount:true},
        ].map(({label,val,color,bg,Icon,isCount}) => (
          <div key={label} style={{...card({padding:"16px 18px"}),display:"flex",flexDirection:"column",gap:8}}>
            <div style={{width:32,height:32,borderRadius:8,background:bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Icon size={16} color={color}/>
            </div>
            <div style={{fontSize:isCount?24:16,fontWeight:800,color:AD.text,fontVariantNumeric:"tabular-nums",lineHeight:1}}>
              {isCount ? val : val.toLocaleString()}
            </div>
            <div style={{fontSize:11,color:AD.muted,fontWeight:600}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div style={{...card({padding:"20px 24px",marginBottom:20})}}>
          <div style={{fontWeight:800,fontSize:15,color:AD.text,marginBottom:16}}>
            {editRec ? "Edit Payment" : "New Payment"}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <div style={{gridColumn:"1/-1"}}>
              <label style={lbl}>Student *</label>
              <select style={inp} value={form.student_id} onChange={e=>setForm(f=>({...f,student_id:e.target.value}))}>
                <option value="">— Select student —</option>
                {students.filter(s=>s.status==="active").map(s=>(
                  <option key={s.student_id} value={s.student_id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Amount *</label>
              <input style={inp} type="number" min={0} step={1000} placeholder="e.g. 50000"
                value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>
            </div>
            <div>
              <label style={lbl}>Currency</label>
              <select style={inp} value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}>
                {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Type</label>
              <select style={inp} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.replace("_"," ").slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Status</label>
              <select style={inp} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Payment Date</label>
              <input style={inp} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
            </div>
            <div>
              <label style={lbl}>Payment Deadline</label>
              <div style={{position:"relative"}}>
                <CalendarClock size={13} color={AD.muted} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
                <input style={{...inp,paddingLeft:30}} type="date" value={form.deadline}
                  onChange={e=>setForm(f=>({...f,deadline:e.target.value}))}/>
              </div>
            </div>
            <div>
              <label style={lbl}>Description</label>
              <input style={inp} placeholder="e.g. November tuition" value={form.description}
                onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={lbl}>Notes (internal)</label>
              <input style={inp} placeholder="Optional internal notes…" value={form.notes}
                onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
            </div>
          </div>

          {err && <div style={{color:AD.red,fontSize:12,marginTop:8,fontWeight:600}}>{err}</div>}

          <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",marginTop:18,flexWrap:"wrap"}}>
            <PillBtn variant="ghost" onClick={()=>{
              if (!form.student_id) { setErr("Select a student first"); return; }
              setInvoiceRec({...form, id: editRec?.id || null});
            }} style={{gap:6}}>
              <FileText size={14}/> Preview Invoice
            </PillBtn>
            <div style={{display:"flex",gap:8}}>
              <PillBtn variant="ghost" onClick={closeForm}>Cancel</PillBtn>
              <PillBtn onClick={save} disabled={saving}>
                {saving ? <Loader size={14} style={{animation:"spin 1s linear infinite"}}/> : <Save size={14}/>}
                {saving ? "Saving…" : "Save Payment"}
              </PillBtn>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{position:"relative",flex:1,minWidth:180}}>
          <Search size={13} color={AD.muted} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}/>
          <input style={{...inp,paddingLeft:30}} placeholder="Search student or description…"
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select style={{...inp,width:"auto"}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </select>
        <select style={{...inp,width:"auto"}} value={filterStudent} onChange={e=>setFilterStudent(e.target.value)}>
          <option value="">All students</option>
          {students.filter(s=>s.status==="active").map(s=>(
            <option key={s.student_id} value={s.student_id}>{s.full_name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{...card({padding:56,textAlign:"center"})}}>
          <CreditCard size={36} color={AD.muted} style={{marginBottom:12}}/>
          <div style={{color:AD.sub,fontSize:14,fontWeight:600,marginBottom:4}}>No payment records</div>
          <div style={{color:AD.muted,fontSize:12}}>Add your first payment with the button above.</div>
        </div>
      ) : (
        <div style={{...card({padding:0,overflow:"hidden"})}}>
          {/* Table header */}
          <div style={{
            display:"grid",
            gridTemplateColumns:"1.4fr 1fr 100px 80px 90px 90px 110px 100px",
            padding:"10px 16px",
            background:AD.bg,borderBottom:`1px solid ${AD.border}`,
            fontSize:11,fontWeight:700,color:AD.muted,textTransform:"uppercase",letterSpacing:".07em",
          }}>
            <div>Student</div><div>Description</div><div>Amount</div>
            <div>Type</div><div>Date</div><div>Deadline</div><div>Status</div><div></div>
          </div>

          {filtered.map((p, i) => {
            const st   = sMap[p.student_id];
            const cfg  = STATUS_CFG[p.status] || STATUS_CFG.pending;
            const Icon = cfg.icon;
            const isH  = hoverId === p.id;
            return (
              <div key={p.id}
                onMouseEnter={()=>setHoverId(p.id)}
                onMouseLeave={()=>setHoverId(null)}
                style={{
                  display:"grid",
                  gridTemplateColumns:"1.4fr 1fr 100px 80px 90px 90px 110px 100px",
                  padding:"13px 16px",
                  borderBottom: i<filtered.length-1?`1px solid ${AD.border}`:"none",
                  background: isH?"#F8F9FF":AD.surface,
                  alignItems:"center",transition:"background .1s",
                }}>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:AD.text}}>{st?.full_name||p.student_id}</div>
                  {st?.email&&<div style={{fontSize:11,color:AD.muted}}>{st.email}</div>}
                </div>
                <div style={{fontSize:12,color:AD.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.description||"—"}</div>
                <div style={{fontSize:13,fontWeight:700,color:AD.text,fontVariantNumeric:"tabular-nums"}}>
                  {(+p.amount).toLocaleString()} <span style={{fontSize:10,color:AD.muted}}>{p.currency}</span>
                </div>
                <div style={{fontSize:12,color:AD.sub,textTransform:"capitalize"}}>{p.type?.replace("_"," ")}</div>
                <div style={{fontSize:12,color:AD.muted}}>{p.date}</div>
                <div style={{fontSize:12}}>
                  {p.deadline
                    ? <span style={{color: new Date(p.deadline)<new Date()&&p.status!=="paid" ? AD.red : AD.muted}}>{p.deadline}</span>
                    : <span style={{color:AD.border}}>—</span>}
                </div>
                <div>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:cfg.bg,color:cfg.color}}>
                    <Icon size={11}/>{cfg.label}
                  </span>
                </div>
                <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                  <button onClick={()=>setInvoiceRec(p)} title="View Invoice" style={{background:AD.blueLt,border:`1px solid ${AD.blue}30`,borderRadius:8,padding:"5px 8px",cursor:"pointer",color:AD.blue,display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:600}}>
                    <FileText size={12}/> Invoice
                  </button>
                  <button onClick={()=>openEdit(p)} title="Edit" style={{background:"none",border:`1px solid ${AD.border}`,borderRadius:8,padding:"5px 8px",cursor:"pointer",color:AD.sub,display:"flex",alignItems:"center"}}>
                    <Edit2 size={13}/>
                  </button>
                  <button onClick={()=>remove(p.id)} title="Delete" style={{background:"none",border:`1px solid ${AD.red}40`,borderRadius:8,padding:"5px 8px",cursor:"pointer",color:AD.red,display:"flex",alignItems:"center"}}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
