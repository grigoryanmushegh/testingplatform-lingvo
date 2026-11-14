import { useState, useEffect, useCallback } from "react";
import {
  CreditCard, Plus, Save, Loader, Trash2, Edit2, CheckCircle,
  AlertCircle, Clock, Search, Users, FileText, CalendarClock,
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

// ── Invoice generator ─────────────────────────────────────────────────────────
function generateInvoice(form, students) {
  const st = students.find(s => s.student_id === form.student_id);
  const name = st?.full_name || form.student_id || "Student";
  const invoiceNo = "INV-" + Date.now().toString(36).toUpperCase();
  const issued = new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});
  const deadlineFmt = form.deadline
    ? new Date(form.deadline).toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})
    : "Upon receipt";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Invoice ${invoiceNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#151313;background:#fff;padding:40px}
  .wrap{max-width:680px;margin:0 auto}
  .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px}
  .brand{font-size:22px;font-weight:800;color:#2D5DDC;letter-spacing:-0.03em}
  .brand small{display:block;font-size:11px;font-weight:500;color:#94A3B8;letter-spacing:0}
  .inv-title{font-size:13px;font-weight:700;color:#94A3B8;text-align:right}
  .inv-no{font-size:22px;font-weight:800;color:#151313}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:40px}
  .party-label{font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}
  .party-name{font-size:15px;font-weight:700;color:#151313}
  .party-sub{font-size:12px;color:#64748B;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:32px}
  th{font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.07em;padding:8px 12px;background:#F8F9FA;border-bottom:2px solid #E2E6EA;text-align:left}
  td{padding:14px 12px;border-bottom:1px solid #F1F5F9;font-size:13px}
  .total-row td{font-weight:800;font-size:16px;color:#151313;border-top:2px solid #E2E6EA;border-bottom:none;padding-top:16px}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
  .status-paid{background:#D1FAE5;color:#059669}
  .status-pending{background:#FEF3C7;color:#D97706}
  .status-overdue{background:#FEE2E2;color:#DC2626}
  .deadline-box{background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:14px 18px;margin-bottom:32px;display:flex;justify-content:space-between;align-items:center}
  .deadline-label{font-size:12px;font-weight:700;color:#92400E}
  .deadline-date{font-size:15px;font-weight:800;color:#92400E}
  .footer{text-align:center;font-size:11px;color:#94A3B8;margin-top:48px;padding-top:24px;border-top:1px solid #E2E6EA}
  @media print{body{padding:20px}.no-print{display:none}}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div class="brand">LingvoConnect<small>IELTS Platform</small></div>
    <div class="inv-title">INVOICE<div class="inv-no">${invoiceNo}</div></div>
  </div>
  <div class="parties">
    <div>
      <div class="party-label">From</div>
      <div class="party-name">LingvoConnect</div>
      <div class="party-sub">Issue date: ${issued}</div>
    </div>
    <div>
      <div class="party-label">Bill to</div>
      <div class="party-name">${name}</div>
      ${st?.email ? `<div class="party-sub">${st.email}</div>` : ""}
    </div>
  </div>
  ${form.deadline ? `
  <div class="deadline-box">
    <div class="deadline-label">⏰ Payment Deadline</div>
    <div class="deadline-date">${deadlineFmt}</div>
  </div>` : ""}
  <table>
    <thead><tr><th>Description</th><th>Type</th><th>Date</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      <tr>
        <td>${form.description || "Tuition fee"}</td>
        <td>${(form.type||"tuition").replace("_"," ").replace(/\b\w/g,c=>c.toUpperCase())}</td>
        <td>${form.date || issued}</td>
        <td style="text-align:right;font-weight:700">${Number(form.amount||0).toLocaleString()} ${form.currency||"AMD"}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3">Total due</td>
        <td style="text-align:right">${Number(form.amount||0).toLocaleString()} ${form.currency||"AMD"}</td>
      </tr>
    </tfoot>
  </table>
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span class="badge status-${form.status||"pending"}">${(form.status||"pending").charAt(0).toUpperCase()+(form.status||"pending").slice(1)}</span>
    ${form.notes ? `<div style="font-size:12px;color:#64748B"><strong>Note:</strong> ${form.notes}</div>` : ""}
  </div>
  <div class="footer">LingvoConnect · lingvoconnect.com · Thank you!</div>
</div>
<script>window.print()</script>
</body></html>`;

  const w = window.open("","_blank","width=800,height=900");
  if (w) { w.document.write(html); w.document.close(); }
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

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <div>
          <h2 style={{margin:0,fontSize:22,fontWeight:800,color:AD.text,letterSpacing:"-0.03em"}}>Payments</h2>
          <p style={{margin:"4px 0 0",color:AD.sub,fontSize:13}}>Record and track student tuition payments</p>
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
            <PillBtn variant="ghost" onClick={()=>generateInvoice(form, students)} style={{gap:6}}>
              <FileText size={14}/> Generate Invoice
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
            gridTemplateColumns:"1.4fr 1fr 100px 80px 90px 90px 110px 80px",
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
                  gridTemplateColumns:"1.4fr 1fr 100px 80px 90px 90px 110px 80px",
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
                  <button onClick={()=>generateInvoice(p, students)} title="Invoice" style={{background:"none",border:`1px solid ${AD.border}`,borderRadius:8,padding:"5px 8px",cursor:"pointer",color:AD.sub,display:"flex",alignItems:"center"}}>
                    <FileText size={13}/>
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
