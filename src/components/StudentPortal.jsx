import { useState, useEffect, useCallback, useMemo } from "react";
import { Home, ClipboardList, Trophy, Settings, BarChart2, CheckCircle, Clock, Copy, Check, BookOpen, Microscope, Calendar, User, Info, LogOut, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Trash2, TrendingUp, FileText, Link, AlertCircle, Award, Plus, Mic, Headphones, Pencil, Eye, EyeOff, GraduationCap, Lightbulb } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { C, AD } from "../lib/constants.js";
import { loadDB, supabase } from "../lib/db.js";
import { readingBand, overallBand } from "../lib/utils.js";
import {
  loginStudent, clearStudentSession, changeStudentPassword, getStudentSession, setStudentSession,
} from "../lib/studentAuth.js";
import {
  getAllStudents, createStudentAccount, updateStudentAccount,
  resetStudentPassword, deactivateStudent, reactivateStudent,
  createAssignment, setWeekTest, getAllAssignments, getStudentAssignments,
  deleteAssignment, updateAssignment, selfRegisterStudent, getPendingStudents,
  approveStudent, rejectStudent, createDeletionRequest,
  getDeletionRequests, processDeletionRequest, genTempPassword,
  getStudentAttempts, updateParticipantData,
} from "../lib/studentDb.js";

// ── Shared helpers ────────────────────────────────────────────────────────────
const mk = {
  btn: (v="primary", dis=false) => ({
    padding:"10px 20px", borderRadius:10, border:"none", cursor:dis?"not-allowed":"pointer",
    fontSize:13, fontWeight:700, opacity:dis?.5:1, transition:"all .15s",
    background: v==="primary"?AD.blue : v==="danger"?AD.red : v==="success"?"#10B981" : "transparent",
    color: ["primary","danger","success"].includes(v)?"#fff":AD.sub,
    outline: v==="ghost"?`1.5px solid ${AD.border}`:"none",
  }),
  card: (x={}) => ({ background:AD.surface, borderRadius:16, border:`1px solid ${AD.border}`,
    boxShadow:"0 2px 8px rgba(0,0,0,.06)", ...x }),
  input: (x={}) => ({ width:"100%", padding:"10px 14px", borderRadius:10, fontSize:14,
    border:`1.5px solid ${AD.border}`, outline:"none", boxSizing:"border-box",
    fontFamily:"inherit", ...x }),
  label: { fontSize:12, fontWeight:700, color:AD.sub, marginBottom:4, display:"block",
    textTransform:"uppercase", letterSpacing:"0.06em" },
};

const bandColor = b => b>=7?"#059669":b>=5.5?"#D97706":"#DC2626";

function F({ children }) { return <div style={{marginBottom:16}}>{children}</div>; }

function Badge({ status }) {
  const m = {
    not_started:["#F1F5F9","#64748B","Not Started"],in_progress:["#FEF3C7","#D97706","In Progress"],
    interrupted:["#FEE2E2","#DC2626","Interrupted"],
    submitted:["#D1FAE5","#059669","Submitted"],expired:["#FEE2E2","#DC2626","Expired"],
    active:["#D1FAE5","#059669","Active"],inactive:["#F1F5F9","#64748B","Inactive"],
    pending:["#FEF3C7","#D97706","Pending Approval"],approved:["#D1FAE5","#059669","Approved"],
    rejected:["#FEE2E2","#DC2626","Rejected"],deleted:["#F1F5F9","#94A3B8","Deleted"],
  };
  const [bg,col,lbl] = m[status]||["#F1F5F9","#64748B",status];
  return <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:bg,color:col}}>{lbl}</span>;
}

function Modal({ title, onClose, children, width=520 }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.7)",zIndex:1000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:24,backdropFilter:"blur(4px)"}}>
      <div style={{...mk.card(),width:"100%",maxWidth:width,maxHeight:"90vh",overflow:"auto"}}>
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${AD.border}`,
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <h3 style={{margin:0,fontSize:16,fontWeight:800,color:AD.text}}>{title}</h3>
          <button onClick={onClose} style={{...mk.btn("ghost"),padding:"4px 10px",fontSize:20,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:24}}>{children}</div>
      </div>
    </div>
  );
}

function Msg({ text }) {
  if (!text) return null;
  const ok = text.startsWith("✓");
  return (
    <div style={{padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:16,
      background:ok?"#D1FAE5":"#FEE2E2",color:ok?"#065F46":"#991B1B"}}>{text}</div>
  );
}

// ── Writing Feedback Display ──────────────────────────────────────────────────
const bandBg = b => b>=7?"#D1FAE5":b>=5.5?"#FEF3C7":"#FEE2E2";
const WRITING_CRITERIA = [
  ["taskAchievement","Task Response"],
  ["coherenceCohesion","Coherence & Cohesion"],
  ["lexicalResource","Lexical Resource"],
  ["grammaticalRange","Grammatical Range & Accuracy"],
];

function WritingFeedbackCard({ feedback, texts }) {
  if (!feedback && !texts) return null;

  // Support both numeric keys (0,1 from new AI eval) and string keys (task1/task2 legacy)
  const taskEntries = feedback
    ? [0,1].map(i=>[i, feedback[i]||feedback[`task${i+1}`]]).filter(([,v])=>v)
    : [];
  const hasNewFormat = taskEntries.some(([,v])=>typeof v==="object"&&(v.summary||v.taskAchievement));

  return (
    <div style={{marginTop:8}}>
      {/* Submitted texts */}
      {texts && Object.entries(texts).filter(([,v])=>v).map(([k,v])=>{
        const idx = k==="task1"||k==="0"||k===0 ? 0 : 1;
        return (
          <div key={k} style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:AD.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>
              Writing Task {idx+1} — Your Response
            </div>
            <div style={{background:AD.bg,borderRadius:8,padding:"10px 14px",fontSize:12,color:AD.sub,
              lineHeight:1.7,maxHeight:120,overflowY:"auto",whiteSpace:"pre-wrap"}}>{v}</div>
          </div>
        );
      })}

      {/* Per-task AI evaluation */}
      {taskEntries.map(([tIdx,fb])=>{
        if(!fb||fb._error) return null;
        const isNew = typeof fb==="object"&&(fb.summary||fb.taskAchievement);
        return (
          <div key={tIdx} style={{...mk.card({padding:20,marginBottom:16})}}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,paddingBottom:14,borderBottom:`1px solid ${AD.border}`}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:AD.blue,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>
                  Writing Task {Number(tIdx)+1} — AI Evaluation
                </div>
                <div style={{fontSize:13,fontWeight:700,color:AD.text}}>Nova's Assessment</div>
              </div>
              {fb.band!=null&&(
                <div style={{textAlign:"center",background:bandBg(fb.band),borderRadius:10,padding:"8px 18px",border:`1.5px solid ${bandColor(fb.band)}30`,flexShrink:0}}>
                  <div style={{fontSize:28,fontWeight:900,color:bandColor(fb.band),lineHeight:1}}>{fb.band}</div>
                  <div style={{fontSize:9,fontWeight:700,color:bandColor(fb.band),letterSpacing:"0.1em",marginTop:1}}>BAND</div>
                </div>
              )}
            </div>

            {isNew ? (
              <>
                {/* Summary */}
                {fb.summary&&(
                  <div style={{background:AD.bg,borderRadius:10,padding:"12px 16px",marginBottom:16,borderLeft:`3px solid ${AD.blue}`}}>
                    <div style={{fontSize:10,fontWeight:700,color:AD.blue,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Overall Assessment</div>
                    <p style={{fontSize:12,color:AD.text,lineHeight:1.8,margin:0}}>{fb.summary}</p>
                  </div>
                )}

                {/* Criteria breakdown */}
                {WRITING_CRITERIA.some(([k])=>fb[k]?.band!=null)&&(
                  <>
                    <div style={{fontSize:12,fontWeight:700,color:AD.text,marginBottom:10}}>Criteria Breakdown</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                      {WRITING_CRITERIA.map(([k,lbl])=>{
                        const crit = fb[k]||{};
                        const b = typeof crit==="object"?crit.band:null;
                        const comment = typeof crit==="object"?crit.comment:"";
                        if(b==null) return null;
                        return (
                          <div key={k} style={{background:AD.surface,border:`1.5px solid ${bandColor(b)}25`,borderRadius:10,padding:"12px 14px"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                              <div style={{fontSize:10,fontWeight:700,color:AD.muted,textTransform:"uppercase",letterSpacing:"0.05em"}}>{lbl}</div>
                              <div style={{fontSize:17,fontWeight:900,color:bandColor(b)}}>{b}</div>
                            </div>
                            <div style={{height:3,background:AD.border,borderRadius:99,marginBottom:6}}>
                              <div style={{width:`${(b-1)/8*100}%`,height:"100%",background:bandColor(b),borderRadius:99}}/>
                            </div>
                            {comment&&<p style={{fontSize:11,color:AD.sub,lineHeight:1.6,margin:0}}>{comment}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Strengths & Improvements */}
                {(fb.strengths?.length>0||fb.improvements?.length>0)&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                    {fb.strengths?.length>0&&(
                      <div style={{background:"#F0FDF4",border:"1.5px solid #BBF7D0",borderRadius:10,padding:"12px 14px"}}>
                        <div style={{fontSize:10,fontWeight:700,color:"#16A34A",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>✓ Strengths</div>
                        {fb.strengths.map((s,i)=>(
                          <div key={i} style={{display:"flex",gap:6,marginBottom:5,fontSize:11,color:"#166534",lineHeight:1.6}}>
                            <span style={{color:"#16A34A",flexShrink:0}}>•</span><span>{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {fb.improvements?.length>0&&(
                      <div style={{background:"#FFFBEB",border:"1.5px solid #FDE68A",borderRadius:10,padding:"12px 14px"}}>
                        <div style={{fontSize:10,fontWeight:700,color:"#D97706",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>↑ To Improve</div>
                        {fb.improvements.map((s,i)=>(
                          <div key={i} style={{display:"flex",gap:6,marginBottom:5,fontSize:11,color:"#92400E",lineHeight:1.6}}>
                            <span style={{color:"#D97706",flexShrink:0}}>•</span><span>{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Key tip */}
                {fb.keyTip&&(
                  <div style={{background:"#F8F7FF",border:"1.5px solid #DDD6FE",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#7C3AED",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6,display:"flex",alignItems:"center",gap:4}}><Lightbulb size={10}/>Key Tip</div>
                    <p style={{fontSize:12,color:"#4C1D95",lineHeight:1.7,margin:0,display:"flex",alignItems:"flex-start",gap:6}}><Lightbulb size={12} color="#7C3AED" style={{flexShrink:0,marginTop:2}}/>{fb.keyTip}</p>
                  </div>
                )}
              </>
            ) : (
              // Legacy feedback string
              <>
                {typeof fb==="object"&&fb.feedback&&(
                  <div style={{background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:8,padding:"10px 14px",fontSize:12,color:AD.sub,lineHeight:1.7}}>{fb.feedback}</div>
                )}
                {typeof fb==="string"&&(
                  <div style={{background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:8,padding:"10px 14px",fontSize:12,color:AD.sub,lineHeight:1.7}}>{fb}</div>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Legacy overall feedback */}
      {feedback?.overall&&typeof feedback.overall==="string"&&(
        <div style={{background:`${AD.blue}10`,border:`1px solid ${AD.blue}30`,borderRadius:8,padding:"10px 14px",fontSize:12,color:AD.sub,lineHeight:1.7}}>
          <strong style={{color:AD.blue}}>Overall Feedback: </strong>{feedback.overall}
        </div>
      )}
    </div>
  );
}

// ── Result Detail Card (shared by student & admin) ────────────────────────────
function ResultDetailCard({ assignment: a, defaultOpen=false }) {
  const [open, setOpen]       = useState(defaultOpen);
  const [qTab, setQTab]       = useState("listening"); // "listening"|"reading"
  const [showQA, setShowQA]   = useState(false);
  const rd = a.result_data || {};
  const s  = a.scores || {};
  const bands = [s.listeningBand,s.readingBand,s.writingBand,s.speakingBand].filter(b=>b!=null);
  const overall = s.overall ?? (bands.length?(bands.reduce((x,b)=>x+b,0)/bands.length).toFixed(1):null);

  // Answer check helper (same logic as admin ParticipantDetail)
  const checkAns = (studentVal, correct) => {
    const av = (typeof studentVal==="object"?studentVal.text:(studentVal||"")).trim().toLowerCase();
    const cv = (correct||"").trim().toLowerCase();
    if(!av||!cv) return false;
    return av===cv||av.includes(cv)||cv.includes(av)||
      (av.replace(/[^a-h]/g,"")[0]===cv.replace(/[^a-h]/g,"")[0]&&av.replace(/[^a-h]/g,"").length>0);
  };
  const lQs = rd.allListeningQuestions||[];
  const rQs = rd.allReadingQuestions||[];
  const lAns = rd.listeningAnswers||{};
  const rAns = rd.readingAnswers||{};

  return (
    <div style={{...mk.card({marginBottom:10})}}>
      <div style={{padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",
        cursor:"pointer",gap:12}} onClick={()=>setOpen(p=>!p)}>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14,color:AD.text,marginBottom:4}}>
            {a.is_week_test&&<span style={{fontSize:10,background:`${AD.blue}20`,color:AD.blue,
              padding:"2px 8px",borderRadius:10,fontWeight:700,marginRight:8,display:"inline-flex",alignItems:"center",gap:3}}><Trophy size={9}/>Week Test</span>}
            {a.test_suite_name||"IELTS Test"}
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            <Badge status={a.status}/>
            <span style={{fontSize:12,color:AD.muted}}>
              Completed {a.completed_at?new Date(a.completed_at).toLocaleDateString("en-GB"):"—"}
            </span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          {overall&&<div style={{textAlign:"center"}}>
            <div style={{fontSize:10,color:AD.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:1}}>Overall</div>
            <div style={{fontSize:26,fontWeight:900,color:bandColor(overall),lineHeight:1}}>{overall}</div>
          </div>}
          <span style={{color:AD.muted,display:"flex"}}>{open?<ChevronUp size={20}/>:<ChevronDown size={20}/>}</span>
        </div>
      </div>

      {open&&(
        <div style={{padding:"0 20px 20px",borderTop:`1px solid ${AD.bg}`}}>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",padding:"16px 0 12px"}}>
            {[[Headphones,"Listening","listeningBand"],[BookOpen,"Reading","readingBand"],
              [Pencil,"Writing","writingBand"],[Mic,"Speaking","speakingBand"]].map(([Icon,name,key])=>
              s[key]!=null&&(
                <div key={key} style={{textAlign:"center",minWidth:72,...mk.card({padding:"10px 14px"})}}>
                  <div style={{display:"flex",justifyContent:"center",marginBottom:4}}><Icon size={16} color={AD.muted} strokeWidth={1.5}/></div>
                  <div style={{fontSize:10,color:AD.muted,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>{name}</div>
                  <div style={{fontSize:20,fontWeight:900,color:bandColor(s[key])}}>{s[key]}</div>
                </div>
              )
            )}
          </div>
          {(rd.writingFeedback||rd.writingTexts)&&(
            <div style={{marginTop:8}}>
              <div style={{fontSize:12,fontWeight:700,color:AD.muted,textTransform:"uppercase",
                letterSpacing:"0.06em",marginBottom:8}}>Writing Feedback</div>
              <WritingFeedbackCard feedback={rd.writingFeedback} texts={rd.writingTexts}/>
            </div>
          )}
          {s.speakingBand!=null&&(
            <div style={{marginTop:12,padding:"10px 14px",background:`${AD.blue}10`,
              border:`1px solid ${AD.blue}30`,borderRadius:8}}>
              <span style={{fontSize:12,color:AD.blue,fontWeight:700,display:"flex",alignItems:"center",gap:4}}><Mic size={12}/>Speaking Band: {s.speakingBand}</span>
              {rd.speakingFeedback&&<div style={{fontSize:12,color:AD.sub,marginTop:4}}>{rd.speakingFeedback}</div>}
            </div>
          )}
          {(rd.listeningScore||rd.readingScore)&&(
            <div style={{marginTop:12,display:"flex",gap:10,flexWrap:"wrap"}}>
              {rd.listeningScore&&<span style={{fontSize:12,color:AD.muted,background:AD.bg,padding:"4px 10px",borderRadius:8,display:"inline-flex",alignItems:"center",gap:4}}><Headphones size={11}/>{rd.listeningScore}</span>}
              {rd.readingScore&&<span style={{fontSize:12,color:AD.muted,background:AD.bg,padding:"4px 10px",borderRadius:8,display:"inline-flex",alignItems:"center",gap:4}}><BookOpen size={11}/>{rd.readingScore}</span>}
            </div>
          )}

          {/* Per-question answer breakdown */}
          {(lQs.length>0||rQs.length>0)&&(
            <div style={{marginTop:16}}>
              <button onClick={()=>setShowQA(p=>!p)} style={{
                background:"none",border:`1px solid ${AD.border}`,borderRadius:8,
                padding:"7px 14px",fontSize:12,fontWeight:700,color:AD.sub,cursor:"pointer",
              }}>
                {showQA?<ChevronUp size={14}/>:<ChevronDown size={14}/>} {showQA?"Hide":"View"} Answer Breakdown
              </button>

              {showQA&&(
                <div style={{marginTop:12}}>
                  {/* Sub-tabs */}
                  <div style={{display:"flex",gap:4,marginBottom:12,background:AD.bg,borderRadius:10,padding:3,alignSelf:"flex-start"}}>
                    {lQs.length>0&&<button onClick={()=>setQTab("listening")} style={{
                      border:"none",cursor:"pointer",padding:"6px 14px",fontSize:12,fontWeight:700,
                      background:qTab==="listening"?AD.surface:"transparent",borderRadius:8,
                      color:qTab==="listening"?C.brand:AD.muted,
                      boxShadow:qTab==="listening"?"0 1px 4px rgba(0,0,0,.08)":"none",
                      display:"inline-flex",alignItems:"center",gap:4,transition:"all .15s",
                    }}><Headphones size={11}/>Listening ({lQs.length})</button>}
                    {rQs.length>0&&<button onClick={()=>setQTab("reading")} style={{
                      border:"none",cursor:"pointer",padding:"6px 14px",fontSize:12,fontWeight:700,
                      background:qTab==="reading"?AD.surface:"transparent",borderRadius:8,
                      color:qTab==="reading"?C.brand:AD.muted,
                      boxShadow:qTab==="reading"?"0 1px 4px rgba(0,0,0,.08)":"none",
                      display:"inline-flex",alignItems:"center",gap:4,transition:"all .15s",
                    }}><BookOpen size={11}/>Reading ({rQs.length})</button>}
                  </div>

                  {/* Question rows */}
                  {(qTab==="listening"?lQs:rQs).map((q,i)=>{
                    const answerMap = qTab==="listening"?lAns:rAns;
                    const studentVal = answerMap[q.id]||"";
                    const correct = (q.correct||"").trim();
                    const isRight = checkAns(studentVal, correct);
                    const displayAns = typeof studentVal==="object"?studentVal.text:(studentVal||"—");
                    return (
                      <div key={q.id||i} style={{
                        display:"grid",gridTemplateColumns:"28px 1fr 80px 80px",gap:8,
                        padding:"6px 0",borderBottom:`1px solid ${AD.bg}`,alignItems:"center",fontSize:12,
                      }}>
                        <span style={{fontWeight:700,color:AD.muted}}>Q{i+1}</span>
                        <span style={{color:AD.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={q.text||""}>
                          {q.text?q.text.slice(0,60)+(q.text.length>60?"…":""):"—"}
                        </span>
                        <span style={{fontWeight:700,color:isRight?"#059669":"#DC2626",textAlign:"center"}}>
                          {isRight?"✓":displayAns||"—"}
                        </span>
                        {!isRight&&correct&&(
                          <span style={{fontSize:11,color:AD.muted,textAlign:"center"}}>✓ {correct}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT SIGN UP
// ══════════════════════════════════════════════════════════════════════════════
export function SignUpForm({ onBack }) {
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pw, setPw]       = useState("");
  const [pw2, setPw2]     = useState("");
  const [err, setErr]     = useState("");
  const [done, setDone]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [focused, setFocused] = useState("");

  const submit = async e => {
    e.preventDefault();
    if (!name.trim()||!email.trim()||!pw) { setErr("Name, email, and password are required."); return; }
    if (pw.length<8) { setErr("Password must be at least 8 characters."); return; }
    if (pw!==pw2) { setErr("Passwords do not match."); return; }
    setLoading(true); setErr("");
    const { error } = await selfRegisterStudent({ fullName:name, email, phone, password:pw });
    setLoading(false);
    if (error) { setErr(error.includes("unique")||error.includes("duplicate")?"An account with this email already exists.":error); return; }
    setDone(true);
  };

  const fieldStyle = (key) => ({
    width:"100%", padding:"11px 14px 11px 40px", borderRadius:10, fontSize:14,
    border: focused===key ? `2px solid ${AD.blue}` : `1.5px solid ${AD.border}`,
    outline:"none", boxSizing:"border-box", fontFamily:"inherit", color:AD.text,
    background:"#fff", transition:"border-color .15s, box-shadow .15s",
    boxShadow: focused===key ? `0 0 0 3px ${AD.blue}22` : "none",
  });
  const iconStyle = (key) => ({
    position:"absolute", left:13, top:"50%", transform:"translateY(-50%)",
    color: focused===key ? AD.blue : AD.muted, pointerEvents:"none",
    transition:"color .15s",
  });

  if (done) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"linear-gradient(160deg,#0D1B4B,#1a3278 50%,#1e3a8a)",padding:24}}>
      <div style={{width:"100%",maxWidth:420,background:"#fff",borderRadius:24,
        boxShadow:"0 24px 80px rgba(0,0,0,.3)",padding:40,textAlign:"center"}}>
        <div style={{width:72,height:72,borderRadius:20,background:"#D1FAE5",display:"flex",
          alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
          <CheckCircle size={36} color="#10B981" strokeWidth={2}/>
        </div>
        <h2 style={{fontSize:22,fontWeight:800,color:AD.text,marginBottom:10,letterSpacing:"-0.02em"}}>
          You're on the list!
        </h2>
        <p style={{fontSize:14,color:AD.sub,lineHeight:1.8,marginBottom:28}}>
          Your account is <strong style={{color:AD.text}}>pending approval</strong> by an administrator.
          You'll be able to sign in as soon as it's approved — usually within 24 hours.
        </p>
        <button onClick={onBack} style={{...mk.btn("primary"),width:"100%",padding:13,fontSize:15,borderRadius:12,background:AD.blue,boxShadow:`0 4px 16px ${AD.blue}44`}}>
          Back to Sign In
        </button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"linear-gradient(160deg,#0D1B4B,#1a3278 50%,#1e3a8a)",padding:"24px 16px"}}>
      <div style={{width:"100%",maxWidth:440}}>

        {/* Header */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:16}}>
            <div style={{width:42,height:42,borderRadius:12,background:AD.blue,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 16px ${AD.blue}55`}}>
              <GraduationCap size={22} color="#fff" strokeWidth={2}/>
            </div>
            <span style={{fontSize:17,fontWeight:800,color:"#fff",letterSpacing:"-0.02em"}}>LingvoConnect</span>
          </div>
          <h1 style={{fontSize:26,fontWeight:800,color:"#fff",letterSpacing:"-0.03em",marginBottom:8,lineHeight:1.2}}>
            Create your account
          </h1>
          <p style={{color:"rgba(255,255,255,.55)",fontSize:14,margin:0}}>
            Join LingvoConnect and track your IELTS progress
          </p>
        </div>

        {/* Card */}
        <div style={{background:"#fff",borderRadius:20,boxShadow:"0 24px 80px rgba(0,0,0,.3)",overflow:"hidden"}}>
          <form onSubmit={submit} style={{padding:"28px 28px 24px"}}>
            <div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:20}}>

              {/* Full Name */}
              <div>
                <label style={{...mk.label,marginBottom:7}}>Full Name <span style={{color:"#EF4444"}}>*</span></label>
                <div style={{position:"relative"}}>
                  <User size={15} style={iconStyle("name")}/>
                  <input value={name} onChange={e=>setName(e.target.value)}
                    onFocus={()=>setFocused("name")} onBlur={()=>setFocused("")}
                    placeholder="e.g. Aiko Tanaka" autoFocus
                    style={fieldStyle("name")}/>
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={{...mk.label,marginBottom:7}}>Email Address <span style={{color:"#EF4444"}}>*</span></label>
                <div style={{position:"relative"}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle("email")}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                    onFocus={()=>setFocused("email")} onBlur={()=>setFocused("")}
                    placeholder="you@example.com"
                    style={fieldStyle("email")}/>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label style={{...mk.label,marginBottom:7}}>Phone <span style={{color:AD.muted,fontWeight:400,textTransform:"none",letterSpacing:0}}>(optional)</span></label>
                <div style={{position:"relative"}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle("phone")}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.42a16 16 0 006.67 6.67l1.78-1.34a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                  <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}
                    onFocus={()=>setFocused("phone")} onBlur={()=>setFocused("")}
                    placeholder="+374 99 000000"
                    style={fieldStyle("phone")}/>
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{...mk.label,marginBottom:7}}>Password <span style={{color:"#EF4444"}}>*</span></label>
                <div style={{position:"relative"}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle("pw")}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  <input type={showPw?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)}
                    onFocus={()=>setFocused("pw")} onBlur={()=>setFocused("")}
                    placeholder="At least 8 characters"
                    style={{...fieldStyle("pw"),paddingRight:44}}/>
                  <button type="button" onClick={()=>setShowPw(p=>!p)}
                    style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                      background:"none",border:"none",cursor:"pointer",color:AD.muted,display:"flex",padding:0}}>
                    {showPw?<EyeOff size={16}/>:<Eye size={16}/>}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label style={{...mk.label,marginBottom:7}}>Confirm Password <span style={{color:"#EF4444"}}>*</span></label>
                <div style={{position:"relative"}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyle("pw2")}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  <input type="password" value={pw2} onChange={e=>setPw2(e.target.value)}
                    onFocus={()=>setFocused("pw2")} onBlur={()=>setFocused("")}
                    placeholder="Repeat your password"
                    style={fieldStyle("pw2")}/>
                </div>
              </div>
            </div>

            {/* Error */}
            {err&&(
              <div style={{display:"flex",alignItems:"center",gap:8,background:"#FEF2F2",border:"1px solid #FECACA",
                borderRadius:10,padding:"10px 14px",marginBottom:16,color:"#DC2626",fontSize:13}}>
                <AlertCircle size={14} style={{flexShrink:0}}/>{err}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{...mk.btn("primary",loading),width:"100%",padding:14,fontSize:15,fontWeight:700,
                borderRadius:12,background:loading?"#93A3B8":`linear-gradient(90deg,${AD.blue},#4f6fe8)`,
                boxShadow:loading?"none":`0 4px 20px ${AD.blue}44`,border:"none",cursor:loading?"not-allowed":"pointer"}}>
              {loading?"Creating Account…":"Create Account →"}
            </button>
          </form>

          <div style={{padding:"0 28px 20px",textAlign:"center",borderTop:`1px solid ${AD.border}`,paddingTop:16}}>
            <span style={{fontSize:13,color:AD.muted}}>Already have an account? </span>
            <button onClick={onBack}
              style={{background:"none",border:"none",color:AD.blue,fontSize:13,fontWeight:700,cursor:"pointer",padding:0}}>
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT LOGIN
// ══════════════════════════════════════════════════════════════════════════════
export function StudentLogin({ onLogin, onBack, onSignUp }) {
  const [loginVal, setLoginVal] = useState("");
  const [pw, setPw]             = useState("");
  const [err, setErr]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (!loginVal.trim()||!pw) { setErr("Please enter your username/email and password."); return; }
    setLoading(true); setErr("");
    const { student, error } = await loginStudent(loginVal, pw);
    setLoading(false);
    if (error) { setErr(error); return; }
    onLogin(student);
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:AD.bg,padding:24}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{marginBottom:12,display:"flex",justifyContent:"center"}}><GraduationCap size={52} color={AD.blue} strokeWidth={1.5}/></div>
          <h1 style={{fontSize:28,fontWeight:900,color:AD.text,marginBottom:8,letterSpacing:"-0.03em"}}>Student Portal</h1>
          <p style={{color:AD.sub,fontSize:14,margin:0}}>Sign in with your student credentials</p>
        </div>
        <div style={{...mk.card(),padding:32}}>
          <form onSubmit={submit}>
            <F><label style={mk.label}>Username or Email</label>
              <input style={mk.input()} value={loginVal} onChange={e=>setLoginVal(e.target.value)}
                placeholder="yourname123 or you@email.com" autoComplete="username" autoFocus/></F>
            <F><label style={mk.label}>Password</label>
              <div style={{position:"relative"}}>
                <input type={showPw?"text":"password"} style={mk.input({paddingRight:44})}
                  value={pw} onChange={e=>setPw(e.target.value)} placeholder="Your password" autoComplete="current-password"/>
                <button type="button" onClick={()=>setShowPw(p=>!p)}
                  style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                    background:"none",border:"none",cursor:"pointer",color:AD.muted,fontSize:16}}>{showPw?"🙈":"👁️"}</button>
              </div></F>
            <Msg text={err}/>
            <button type="submit" disabled={loading}
              style={{...mk.btn("primary",loading),width:"100%",padding:13,fontSize:15,borderRadius:12}}>
              {loading?"Signing in…":"Sign In →"}
            </button>
          </form>
          {onSignUp&&<div style={{marginTop:16,textAlign:"center",borderTop:`1px solid ${AD.bg}`,paddingTop:16}}>
            <span style={{fontSize:13,color:AD.muted}}>Don't have an account? </span>
            <button onClick={onSignUp} style={{background:"none",border:"none",color:AD.blue,fontSize:13,fontWeight:700,cursor:"pointer"}}>
              Sign Up
            </button>
          </div>}
          <div style={{marginTop:12,textAlign:"center"}}>
            <button onClick={onBack} style={{background:"none",border:"none",color:AD.muted,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>
              ← Back to home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CHANGE PASSWORD
// ══════════════════════════════════════════════════════════════════════════════
export function ChangePasswordScreen({ student, onDone }) {
  const [pw, setPw]   = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (pw.length<8) { setErr("Password must be at least 8 characters."); return; }
    if (pw!==pw2) { setErr("Passwords do not match."); return; }
    setSaving(true); setErr("");
    const { ok, error } = await changeStudentPassword(student.student_id, pw);
    setSaving(false);
    if (!ok) { setErr(error||"Failed to update password."); return; }
    onDone();
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:AD.bg,padding:24}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:48,marginBottom:12}}>🔐</div>
          <h2 style={{fontSize:22,fontWeight:800,color:AD.text,marginBottom:8,letterSpacing:"-0.03em"}}>Set Your Password</h2>
          <p style={{color:AD.muted,fontSize:14,margin:0}}>Welcome, {student.full_name}! Please set a personal password.</p>
        </div>
        <div style={{...mk.card(),padding:32}}>
          <form onSubmit={submit}>
            <F><label style={mk.label}>New Password</label>
              <div style={{position:"relative"}}>
                <input type={showPw?"text":"password"} style={mk.input({paddingRight:44})}
                  value={pw} onChange={e=>setPw(e.target.value)} placeholder="At least 8 characters" autoFocus/>
                <button type="button" onClick={()=>setShowPw(p=>!p)}
                  style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                    background:"none",border:"none",cursor:"pointer",color:AD.muted,fontSize:16}}>{showPw?"🙈":"👁️"}</button>
              </div></F>
            <F><label style={mk.label}>Confirm Password</label>
              <input type="password" style={mk.input()} value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Repeat password"/></F>
            <Msg text={err}/>
            <button type="submit" disabled={saving}
              style={{...mk.btn("primary",saving),width:"100%",padding:13,fontSize:15,borderRadius:12}}>
              {saving?"Saving…":"Set Password & Continue →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PENDING APPROVAL SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export function PendingApprovalScreen({ student, onLogout }) {
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:AD.bg,padding:24}}>
      <div style={{width:"100%",maxWidth:440,textAlign:"center"}}>
        <div style={{width:80,height:80,borderRadius:24,background:"#FEF3C7",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}><Clock size={40} color="#D97706" strokeWidth={1.5}/></div>
        <h2 style={{fontSize:22,fontWeight:800,color:AD.text,marginBottom:12,letterSpacing:"-0.03em"}}>
          Account Pending Approval
        </h2>
        <p style={{fontSize:14,color:AD.sub,lineHeight:1.8,marginBottom:32,maxWidth:340,margin:"0 auto 32px"}}>
          Your account is currently <strong>pending approval</strong> by an administrator.
          You will be notified once your account is activated. Please check back later.
        </p>
        <div style={{background:"#FEF3C7",borderRadius:12,padding:"16px 20px",marginBottom:24,textAlign:"left"}}>
          <div style={{fontSize:12,color:"#92400E",fontWeight:700}}>Registered as:</div>
          <div style={{fontSize:14,color:"#78350F",fontWeight:600,marginTop:2}}>{student?.full_name}</div>
          <div style={{fontSize:13,color:"#92400E"}}>{student?.email}</div>
        </div>
        <button onClick={onLogout} style={{...mk.btn("ghost"),padding:"10px 28px"}}>Sign Out</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT HISTORY VIEW — mirrors admin ParticipantDetail History tab
// ══════════════════════════════════════════════════════════════════════════════
function StudentHistoryView({ attempts = [], canEdit = false, onSave = null, onRecheck = null }) {
  const [expanded, setExpanded]   = useState(null);
  const [secTab, setSecTab]       = useState({});
  const [scoreEdit, setScoreEdit] = useState({}); // {i: {l,r,w,s,o}}
  const [scoreDraft, setScoreDraft] = useState({}); // {i: {l,r,w,s,o}}
  const [scoreSaving, setScoreSaving] = useState({});
  const [fbDraft, setFbDraft]     = useState({}); // {i: string}
  const [fbSaving, setFbSaving]   = useState({});
  const [ovrides, setOvrides]     = useState({}); // {[i]: {reading: {[qId]: bool}}}
  const [ovSaving, setOvSaving]   = useState({});
  const [ovSaved, setOvSaved]     = useState({});

  const rawTxt = v => (v && typeof v === "object") ? v.text : (v || "");
  const bColor = b => b >= 7 ? "#059669" : b >= 5.5 ? "#D97706" : "#DC2626";
  const bBg    = b => b >= 7 ? "#D1FAE5" : b >= 5.5 ? "#FEF3C7" : "#FEE2E2";

  function BandPill({ val, large }) {
    if (val == null) return <span style={{color:AD.muted,fontWeight:600,fontSize:large?18:13}}>—</span>;
    return (
      <span style={{background:bBg(val),color:bColor(val),borderRadius:6,padding:large?"4px 12px":"2px 8px",
        fontWeight:900,fontSize:large?18:13,display:"inline-block"}}>
        {val}
      </span>
    );
  }

  const checkAns = (ansText, correct) => {
    const av = ansText.trim().toLowerCase();
    const cv = (correct || "").trim().toLowerCase();
    return av && cv && (av === cv || av.includes(cv) || cv.includes(av) ||
      (av.replace(/[^a-h]/g,"")[0] === cv.replace(/[^a-h]/g,"")[0] && av.replace(/[^a-h]/g,"").length > 0));
  };

  if (attempts.length === 0) return (
    <div style={{...mk.card({padding:48,textAlign:"center"})}}>
      <div style={{width:64,height:64,borderRadius:20,background:AD.bg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><BarChart2 size={32} color={AD.muted} strokeWidth={1.5}/></div>
      <div style={{fontSize:16,fontWeight:700,color:AD.sub}}>No test attempts yet</div>
      <div style={{color:AD.muted,fontSize:13,marginTop:8}}>Complete a test to see your full history here.</div>
    </div>
  );

  // Performance summary
  const best = k => { const v=attempts.map(a=>a[k]).filter(x=>x!=null); return v.length?Math.max(...v):null; };
  const avg  = k => { const v=attempts.map(a=>a[k]).filter(x=>x!=null); return v.length?(v.reduce((s,x)=>s+x,0)/v.length).toFixed(1):null; };
  const skills = [
    {lbl:"Listening",key:"listeningBand",Icon:Headphones},
    {lbl:"Reading",  key:"readingBand",  Icon:BookOpen},
    {lbl:"Writing",  key:"writingBand",  Icon:Pencil},
    {lbl:"Speaking", key:"speakingBand", Icon:Mic},
    {lbl:"Overall",  key:"overall",      Icon:Award},
  ];

  return (
    <div>
      <h2 style={{fontSize:18,fontWeight:800,color:AD.text,marginBottom:16}}>
        Test History — {attempts.length} attempt{attempts.length !== 1 ? "s" : ""}
      </h2>

      {/* Performance summary */}
      <div style={{...mk.card({padding:16,marginBottom:20}),background:"linear-gradient(135deg,#F0FDF4,#fff)",border:`1.5px solid ${AD.blue}30`}}>
        <div style={{fontSize:11,fontWeight:800,color:AD.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>
          Performance Summary · {attempts.filter(a=>a.status==="complete").length}/{attempts.length} complete
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
          {skills.map(({lbl,key,Icon})=>{
            const b=best(key), a2=avg(key);
            return (
              <div key={key} style={{textAlign:"center",padding:"10px 6px",background:AD.surface,borderRadius:10,border:`1px solid ${AD.border}`}}>
                <div style={{display:"flex",justifyContent:"center",marginBottom:4}}><Icon size={16} color={b!=null?bColor(b):AD.border} strokeWidth={1.5}/></div>
                <div style={{fontSize:9,color:AD.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>{lbl}</div>
                <div style={{fontSize:20,fontWeight:900,color:b!=null?bColor(b):AD.border,lineHeight:1}}>
                  {b != null ? b : "—"}
                </div>
                {a2 != null && <div style={{fontSize:10,color:AD.muted,marginTop:3}}>avg {a2}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Attempt list */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {attempts.map((a, i) => {
          const isOpen = expanded === i;
          const curSec = secTab[i] || "listening";
          const setSec = s => setSecTab(p => ({...p,[i]:s}));
          const lAns = a.listeningAnswers || {};
          const rAns = a.readingAnswers || {};
          const lQs  = a.allListeningQuestions || [];
          const rQs  = a.allReadingQuestions || [];
          const atx  = a.writingTexts || {};
          const afb  = a.writingFeedback || {};

          const inScoreEdit = !!scoreEdit[i];
          const sd = scoreDraft[i] || {};
          const openScoreEdit = () => {
            setScoreDraft(p=>({...p,[i]:{l:a.listeningBand??'',r:a.readingBand??'',w:a.writingBand??'',s:a.speakingBand??'',o:a.overall??''}}));
            setScoreEdit(p=>({...p,[i]:true}));
          };
          const saveScores = async e => {
            e.stopPropagation();
            if(!onSave||!a._rowId) return;
            setScoreSaving(p=>({...p,[i]:true}));
            const parse = v => { const n=parseFloat(v); return isNaN(n)?null:Math.round(n*2)/2; };
            const updates = {
              listeningBand: parse(sd.l), readingBand: parse(sd.r),
              writingBand: parse(sd.w), speakingBand: parse(sd.s), overall: parse(sd.o)
            };
            await onSave(a._rowId, updates);
            setScoreEdit(p=>({...p,[i]:false}));
            setScoreSaving(p=>({...p,[i]:false}));
          };

          return (
            <div key={a._rowId||i} style={{...mk.card({overflow:"hidden"}),border:`1px solid ${isOpen?AD.blue:AD.border}`}}>
              {/* Row header */}
              <div onClick={()=>setExpanded(isOpen?null:i)}
                style={{display:"grid",gridTemplateColumns:"160px 1fr 1fr 1fr 1fr auto",
                  gap:10,padding:"13px 16px",alignItems:"center",cursor:"pointer",
                  background:isOpen?`${AD.blue}08`:"",transition:"background .15s"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:AD.text,marginBottom:2}}>
                    {a.date || (a._createdAt ? new Date(a._createdAt).toLocaleDateString("en-GB") : "—")}
                    {a.status==="complete"&&<span style={{fontSize:9,fontWeight:800,color:AD.blue,background:`${AD.blue}20`,borderRadius:4,padding:"1px 5px",marginLeft:6,display:"inline-flex",alignItems:"center",gap:2}}><CheckCircle size={8}/>DONE</span>}
                    {a.status==="in_progress"&&<span style={{fontSize:9,fontWeight:800,color:"#D97706",background:"#FEF3C7",borderRadius:4,padding:"1px 5px",marginLeft:6,display:"inline-flex",alignItems:"center",gap:2}}><AlertCircle size={8}/>INTERRUPTED</span>}
                  </div>
                  <div style={{fontSize:10,color:AD.muted}}>
                    {a.listeningScore&&`L:${a.listeningScore} `}{a.readingScore&&`R:${a.readingScore}`}
                  </div>
                  {a.suiteId && <div style={{fontSize:9,color:AD.blue,fontWeight:600,marginTop:2,display:"flex",alignItems:"center",gap:3}}><BookOpen size={9}/>{a.suiteName||"Test Suite"}</div>}
                  {canEdit&&!inScoreEdit&&(
                    <button type="button" onClick={e=>{e.stopPropagation();openScoreEdit();}}
                      style={{marginTop:4,fontSize:9,padding:"2px 7px",borderRadius:4,border:`1px solid ${AD.border}`,background:AD.surface,cursor:"pointer",color:AD.sub,fontWeight:600}}>
                      <Pencil size={9} style={{marginRight:3}}/>Edit Scores
                    </button>
                  )}
                  {canEdit&&inScoreEdit&&(
                    <div onClick={e=>e.stopPropagation()} style={{marginTop:6,display:"flex",gap:4,flexWrap:"wrap"}}>
                      {[["L",sd.l,"l"],["R",sd.r,"r"],["W",sd.w,"w"],["S",sd.s,"s"],["Ovr",sd.o,"o"]].map(([lbl,val,key])=>(
                        <div key={key} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                          <span style={{fontSize:8,color:AD.muted,fontWeight:700}}>{lbl}</span>
                          <input type="number" min={0} max={9} step={0.5} value={val} onChange={e=>setScoreDraft(p=>({...p,[i]:{...p[i],[key]:e.target.value}}))}
                            style={{width:38,fontSize:11,padding:"2px 4px",border:`1px solid ${AD.blue}`,borderRadius:4,textAlign:"center",fontWeight:700}}/>
                        </div>
                      ))}
                      <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",gap:2}}>
                        <button type="button" disabled={scoreSaving[i]} onClick={saveScores}
                          style={{fontSize:9,padding:"3px 8px",background:AD.blue,color:"#fff",border:"none",borderRadius:4,cursor:"pointer",fontWeight:700}}>
                          {scoreSaving[i]?"…":"Save"}
                        </button>
                        <button type="button" onClick={e=>{e.stopPropagation();setScoreEdit(p=>({...p,[i]:false}));}}
                          style={{fontSize:9,padding:"3px 8px",background:AD.bg,color:AD.sub,border:"none",borderRadius:4,cursor:"pointer"}}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:9,color:AD.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.07em"}}>Listening</div>
                  <BandPill val={a.listeningBand}/>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:9,color:AD.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.07em"}}>Reading</div>
                  <BandPill val={a.readingBand}/>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:9,color:AD.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.07em"}}>Writing</div>
                  <BandPill val={a.writingBand}/>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:9,color:AD.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.07em"}}>Overall</div>
                  <BandPill val={a.overall} large/>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                  {canEdit && onRecheck && Object.keys(atx).length > 0 && a.writingBand == null && (
                    <button
                      type="button"
                      onClick={e=>{e.stopPropagation();onRecheck(a, a._assignmentId||null);}}
                      disabled={!!a._rechecking}
                      style={{fontSize:10,fontWeight:700,padding:"4px 10px",borderRadius:6,border:"none",
                        background:a._rechecking?"#94A3B8":"#F59E0B",color:"#fff",cursor:a._rechecking?"not-allowed":"pointer",
                        whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}>
                      {a._rechecking?"…":"✦ Check Writing"}
                    </button>
                  )}
                  <div style={{fontSize:20,color:AD.blue,transition:"transform .2s",transform:isOpen?"rotate(90deg)":""}}>›</div>
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{borderTop:`1px solid ${AD.border}`}}>
                  {/* Section tabs */}
                  <div style={{display:"flex",gap:4,padding:"10px 16px 8px",background:AD.bg}}>
                    <div style={{display:"flex",gap:4,background:AD.border,borderRadius:10,padding:3}}>
                    {[["listening",Headphones,"Listening"],["reading",BookOpen,"Reading"],["writing",Pencil,"Writing"],["speaking",Mic,"Speaking"]].map(([k,Icon,lbl])=>(
                      <button key={k} onClick={()=>setSec(k)} style={{
                        padding:"6px 13px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,
                        fontWeight:curSec===k?700:500,background:curSec===k?AD.surface:"transparent",
                        color:curSec===k?AD.blue:AD.muted,
                        boxShadow:curSec===k?"0 1px 4px rgba(0,0,0,.08)":"none",
                        display:"flex",alignItems:"center",gap:5,transition:"all .15s",
                      }}><Icon size={12}/> {lbl}</button>
                    ))}
                    </div>
                  </div>

                  <div style={{padding:20,background:AD.surface}}>

                    {/* LISTENING */}
                    {curSec==="listening"&&(
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                          {a.listeningBand!=null&&<span style={{background:bBg(a.listeningBand),color:bColor(a.listeningBand),
                            borderRadius:8,padding:"6px 14px",fontWeight:900,fontSize:22}}>{a.listeningBand}</span>}
                          <div>
                            <div style={{fontWeight:700,fontSize:13,color:AD.text}}>Listening Score</div>
                            <div style={{fontSize:12,color:AD.muted}}>{a.listeningScore||"—"} correct</div>
                          </div>
                        </div>
                        {lQs.length > 0 ? (<>
                          {/* Answer Grid */}
                          <div style={{marginBottom:16}}>
                            <div style={{fontSize:11,fontWeight:700,color:AD.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Answer Grid</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                              {lQs.map((q,qi)=>{
                                const ans=lAns[q.id]; const at=rawTxt(ans);
                                const cv=(q.correct||"").trim().toLowerCase();
                                const correct=at?checkAns(at,q.correct):false;
                                const unanswered=!at;
                                const bg=unanswered?"#e5e7eb":correct?"#86efac":"#fca5a5";
                                const fg=unanswered?AD.muted:correct?"#15803d":"#b91c1c";
                                return (
                                  <div key={qi} title={`Q${qi+1}: ${at||"—"} ${!unanswered?"("+(correct?"✓ correct":"✗ wrong")+")":""}`}
                                    style={{width:24,height:24,background:bg,borderRadius:4,display:"flex",
                                      alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:fg}}>
                                    {qi+1}
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{display:"flex",gap:12,marginTop:8,fontSize:10,color:AD.muted}}>
                              <span><span style={{display:"inline-block",width:10,height:10,background:"#86efac",borderRadius:2,marginRight:3}}/>Correct</span>
                              <span><span style={{display:"inline-block",width:10,height:10,background:"#fca5a5",borderRadius:2,marginRight:3}}/>Wrong</span>
                              <span><span style={{display:"inline-block",width:10,height:10,background:"#e5e7eb",borderRadius:2,marginRight:3}}/>Skipped</span>
                            </div>
                          </div>
                          {/* Q&A rows */}
                          {lQs.map((q,qi)=>{
                            const at=rawTxt(lAns[q.id]);
                            const correct=at?checkAns(at,q.correct):false;
                            const noKey=!(q.correct||"").trim();
                            return (
                              <div key={qi} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 0",borderBottom:`1px solid ${AD.bg}`}}>
                                <span style={{fontSize:10,fontWeight:700,color:AD.blue,background:`${AD.blue}15`,borderRadius:4,
                                  padding:"2px 6px",flexShrink:0,marginTop:2}}>Q{qi+1}</span>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:12,color:AD.text,marginBottom:3}}>{q.text||""}</div>
                                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                                    <span style={{fontSize:11,fontWeight:600,color:at?(noKey?AD.muted:correct?"#059669":"#DC2626"):AD.muted}}>
                                      {at ? `Your answer: "${at}"` : "Not answered"}
                                    </span>
                                    {!noKey&&at&&!correct&&<span style={{fontSize:11,color:"#059669",fontWeight:600}}>✓ Key: "{q.correct}"</span>}
                                    {!noKey&&at&&correct&&<span style={{fontSize:11,color:"#059669"}}>✓ Correct</span>}
                                  </div>
                                </div>
                                <span style={{flexShrink:0,fontSize:14,fontWeight:700,color:at?(correct?"#059669":"#DC2626"):AD.muted,marginTop:4}}>
                                  {at ? (correct ? "✓" : "✗") : "—"}
                                </span>
                              </div>
                            );
                          })}
                        </>) : <div style={{color:AD.muted,fontSize:12,fontStyle:"italic",padding:"12px 0"}}>Detailed question data not available for this attempt.</div>}
                      </div>
                    )}

                    {/* READING */}
                    {curSec==="reading"&&(()=>{
                      const rOvrs=(ovrides[i]||{}).reading||{};
                      const isSaving=!!ovSaving[i];
                      const isSaved=!!ovSaved[i];
                      const saveReadingCorrections=async()=>{
                        if(!onSave||!a._rowId) return;
                        setOvSaving(s=>({...s,[i]:true}));
                        const nCorrect=rQs.filter(q=>{
                          if(q.id in rOvrs) return rOvrs[q.id];
                          const at=rawTxt(rAns[q.id]);
                          return at?checkAns(at,q.correct):false;
                        }).length;
                        const tot=rQs.length||40;
                        const newRB=readingBand(nCorrect,tot);
                        const newRScore=`${nCorrect}/${tot}`;
                        const bands=[a.listeningBand,newRB,a.writingBand,a.speakingBand].filter(b=>b!=null);
                        const newOverall=bands.length?overallBand(bands):a.overall;
                        await onSave(a._rowId,{readingBand:newRB,readingScore:newRScore,overall:newOverall});
                        setOvSaving(s=>({...s,[i]:false}));
                        setOvSaved(s=>({...s,[i]:true}));
                        setTimeout(()=>setOvSaved(s=>({...s,[i]:false})),3000);
                      };
                      return (
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
                          {a.readingBand!=null&&<span style={{background:bBg(a.readingBand),color:bColor(a.readingBand),
                            borderRadius:8,padding:"6px 14px",fontWeight:900,fontSize:22}}>{a.readingBand}</span>}
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:13,color:AD.text}}>Reading Score</div>
                            <div style={{fontSize:12,color:AD.muted}}>{a.readingScore||"—"} correct</div>
                          </div>
                          {canEdit&&rQs.length>0&&(
                            <button onClick={saveReadingCorrections} disabled={isSaving}
                              style={{padding:"6px 14px",borderRadius:8,border:"none",cursor:isSaving?"wait":"pointer",
                                background:isSaved?"#059669":"#0F766E",color:"#fff",fontSize:11,fontWeight:700}}>
                              {isSaving?"Saving…":isSaved?"✓ Saved!":"💾 Save Corrections"}
                            </button>
                          )}
                        </div>
                        {rQs.length > 0 ? (<>
                          {/* Answer Grid */}
                          <div style={{marginBottom:16}}>
                            <div style={{fontSize:11,fontWeight:700,color:AD.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Answer Grid</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                              {rQs.map((q,qi)=>{
                                const ans=rAns[q.id]; const at=rawTxt(ans);
                                const isOvr=q.id in rOvrs;
                                const correct=isOvr?rOvrs[q.id]:(at?checkAns(at,q.correct):false);
                                const unanswered=!at;
                                const bg=unanswered?"#e5e7eb":correct?"#86efac":"#fca5a5";
                                const fg=unanswered?AD.muted:correct?"#15803d":"#b91c1c";
                                return (
                                  <div key={qi} title={`Q${qi+1}: ${at||"—"} ${!unanswered?"("+(correct?"✓ correct":"✗ wrong")+")":""}`}
                                    style={{width:24,height:24,background:bg,borderRadius:4,display:"flex",
                                      alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:fg}}>
                                    {qi+1}
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{display:"flex",gap:12,marginTop:8,fontSize:10,color:AD.muted}}>
                              <span><span style={{display:"inline-block",width:10,height:10,background:"#86efac",borderRadius:2,marginRight:3}}/>Correct</span>
                              <span><span style={{display:"inline-block",width:10,height:10,background:"#fca5a5",borderRadius:2,marginRight:3}}/>Wrong</span>
                              <span><span style={{display:"inline-block",width:10,height:10,background:"#e5e7eb",borderRadius:2,marginRight:3}}/>Skipped</span>
                            </div>
                          </div>
                          {rQs.map((q,qi)=>{
                            const at=rawTxt(rAns[q.id]);
                            const isOvr=q.id in rOvrs;
                            const correct=isOvr?rOvrs[q.id]:(at?checkAns(at,q.correct):false);
                            const noKey=!(q.correct||"").trim();
                            return (
                              <div key={qi} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 0",borderBottom:`1px solid ${AD.bg}`}}>
                                <span style={{fontSize:10,fontWeight:700,color:AD.blue,background:`${AD.blue}15`,borderRadius:4,
                                  padding:"2px 6px",flexShrink:0,marginTop:2}}>Q{qi+1}</span>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:12,color:AD.text,marginBottom:3}}>{q.text||""}</div>
                                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                                    <span style={{fontSize:11,fontWeight:600,color:at?(noKey?AD.muted:correct?"#059669":"#DC2626"):AD.muted}}>
                                      {at ? `Your answer: "${at}"` : "Not answered"}
                                    </span>
                                    {!noKey&&at&&!correct&&<span style={{fontSize:11,color:"#059669",fontWeight:600}}>✓ Key: "{q.correct}"</span>}
                                    {!noKey&&at&&correct&&<span style={{fontSize:11,color:"#059669"}}>✓ Correct</span>}
                                    {isOvr&&<span style={{fontSize:10,color:"#7C3AED",fontWeight:600}}>· overridden</span>}
                                  </div>
                                </div>
                                {canEdit ? (
                                  <button onClick={()=>setOvrides(s=>{
                                    const prev=s[i]||{}; const prevR=prev.reading||{};
                                    return {...s,[i]:{...prev,reading:{...prevR,[q.id]:!correct}}};
                                  })} style={{flexShrink:0,padding:"4px 10px",borderRadius:6,marginTop:2,cursor:"pointer",fontSize:11,fontWeight:700,
                                    border:`2px solid ${correct?"#059669":"#DC2626"}`,
                                    background:correct?"#D1FAE5":"#FEE2E2",color:correct?"#059669":"#DC2626"}}>
                                    {correct?"✓ Correct":"✗ Wrong"}
                                  </button>
                                ) : (
                                  <span style={{flexShrink:0,fontSize:14,fontWeight:700,color:at?(correct?"#059669":"#DC2626"):AD.muted,marginTop:4}}>
                                    {at ? (correct ? "✓" : "✗") : "—"}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </>) : <div style={{color:AD.muted,fontSize:12,fontStyle:"italic",padding:"12px 0"}}>Detailed question data not available for this attempt.</div>}
                      </div>
                      );
                    })()}

                    {/* WRITING */}
                    {curSec==="writing"&&(
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
                          {a.writingBand!=null&&<span style={{background:bBg(a.writingBand),color:bColor(a.writingBand),
                            borderRadius:8,padding:"6px 14px",fontWeight:900,fontSize:22}}>{a.writingBand}</span>}
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:13,color:AD.text}}>Writing Score</div>
                            {a.writingBand==null&&Object.keys(atx).length>0&&(
                              <div style={{fontSize:11,color:"#D97706",fontWeight:600,marginTop:2}}>⚠ Awaiting evaluation</div>
                            )}
                          </div>
                          {onRecheck&&Object.keys(atx).length>0&&(
                            <button
                              onClick={()=>onRecheck(a, a._assignmentId||null)}
                              disabled={!!a._rechecking}
                              style={{...mk.btn("primary",!!a._rechecking),padding:"6px 14px",fontSize:12}}
                            >
                              {a._rechecking?"Checking…":"Re-check AI"}
                            </button>
                          )}
                        </div>
                        {Object.keys(atx).length>0||Object.keys(afb).length>0 ? (
                          <WritingFeedbackCard feedback={afb} texts={atx}/>
                        ) : <div style={{color:AD.muted,fontSize:12,fontStyle:"italic",padding:"12px 0"}}>No writing data for this attempt.</div>}
                      </div>
                    )}

                    {/* SPEAKING */}
                    {curSec==="speaking"&&(
                      <div>
                        {a.speakingBand!=null ? (
                          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                            <span style={{background:bBg(a.speakingBand),color:bColor(a.speakingBand),
                              borderRadius:8,padding:"6px 14px",fontWeight:900,fontSize:22}}>{a.speakingBand}</span>
                            <div style={{fontWeight:700,fontSize:13,color:AD.text}}>Speaking Band</div>
                          </div>
                        ) : (
                          <div style={{color:AD.muted,fontSize:12,fontStyle:"italic",padding:"12px 0 16px"}}>No speaking band recorded yet.</div>
                        )}
                        {a.speakingFeedback&&!canEdit&&(
                          <div style={{background:`${AD.blue}08`,border:`1px solid ${AD.blue}30`,borderRadius:10,padding:14,marginBottom:12}}>
                            <div style={{fontSize:11,fontWeight:700,color:AD.blue,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>🗣️ Speaking Feedback</div>
                            <div style={{fontSize:13,color:AD.text,whiteSpace:"pre-wrap",lineHeight:1.6}}>{a.speakingFeedback}</div>
                          </div>
                        )}
                        {canEdit&&(
                          <div style={{marginTop:8}}>
                            <div style={{fontSize:11,fontWeight:700,color:AD.sub,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Speaking Feedback</div>
                            <textarea rows={5} value={fbDraft[i]??a.speakingFeedback??""} onChange={e=>setFbDraft(p=>({...p,[i]:e.target.value}))}
                              placeholder="Enter speaking feedback for this student…"
                              style={{width:"100%",boxSizing:"border-box",padding:10,borderRadius:8,border:`1px solid ${AD.border}`,
                                fontSize:13,fontFamily:"inherit",resize:"vertical",lineHeight:1.6,color:AD.text}}/>
                            <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
                              <button type="button" disabled={fbSaving[i]||!onSave||!a._rowId}
                                onClick={async()=>{
                                  if(!onSave||!a._rowId) return;
                                  setFbSaving(p=>({...p,[i]:true}));
                                  await onSave(a._rowId, {speakingFeedback: fbDraft[i]??a.speakingFeedback??""});
                                  setFbSaving(p=>({...p,[i]:false}));
                                }}
                                style={{...mk.btn("primary",fbSaving[i]),padding:"8px 20px",fontSize:13}}>
                                {fbSaving[i]?"Saving…":"Save Feedback"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
export function StudentDashboard({ student, onStartTest, onLogout }) {
  const [assignments, setAssignments] = useState([]);
  const [attempts, setAttempts]       = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const tab = location.pathname === "/student/tests"   ? "tests"
            : location.pathname === "/student/results" ? "results"
            : location.pathname === "/student/profile" ? "profile"
            : "home";
  const setTab = t => navigate(t === "home" ? "/student" : `/student/${t}`);
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [asgn, atts] = await Promise.all([
      getStudentAssignments(student.student_id),
      getStudentAttempts(student.email),
    ]);
    setAssignments(asgn);
    setAttempts(atts);
    setLoading(false);
  }, [student.student_id, student.email]);

  useEffect(() => { load(); }, [load]);

  const weekTest  = assignments.find(a=>a.is_week_test && a.status!=="submitted");
  const active    = assignments.filter(a=>!a.is_week_test && ["not_started","in_progress","interrupted"].includes(a.status));
  const completed = assignments.filter(a=>a.status==="submitted");

  const STUDENT_TAB_ICONS = { home: Home, tests: ClipboardList, results: Trophy, profile: Settings };
  const tabs = [["home","Home"],["tests","My Tests"],
    ["results","Results & Feedback"],["profile","Profile"]];

  const isExpired = a => a.deadline && new Date(a.deadline)<new Date() && a.status!=="submitted";

  const handleStart = a => {
    if (!isExpired(a)) onStartTest({ assignment: a, candidateInfo: { name: student.full_name, email: student.email, phone: student.phone||"" } });
  };

  return (
    <div style={{minHeight:"100vh",background:AD.bg}}>
      <div style={{background:AD.blue,padding:"0 24px",display:"flex",alignItems:"center",
        justifyContent:"space-between",height:64}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:20,fontWeight:900,color:"#fff",letterSpacing:"-0.03em"}}>LingvoConnect</span>
          <span style={{background:"rgba(255,255,255,.18)",color:"#fff",fontSize:10,fontWeight:700,
            padding:"3px 8px",borderRadius:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Student</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{display:"flex",alignItems:"center",gap:6,color:"rgba(255,255,255,.75)",fontSize:13}}><User size={13}/>{student.full_name}</span>
          <button onClick={onLogout} style={{...mk.btn("ghost"),color:"rgba(255,255,255,.75)",
            outline:"1px solid rgba(255,255,255,.25)",fontSize:12,padding:"7px 14px"}}>Sign Out</button>
        </div>
      </div>

      <div style={{maxWidth:860,margin:"0 auto",padding:"28px 24px"}}>
        <div style={{display:"flex",gap:4,marginBottom:28,background:"#fff",borderRadius:12,padding:4,border:`1px solid ${AD.border}`}}>
          {tabs.map(([t,lbl])=>{
            const TabIcon = STUDENT_TAB_ICONS[t] || Home;
            const active = tab===t;
            return (
              <button key={t} onClick={()=>setTab(t)} style={{display:"flex",alignItems:"center",gap:6,
                background:active?AD.blue:"transparent",border:"none",
                padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:active?700:500,
                color:active?"#fff":AD.sub,borderRadius:9,
                boxShadow:active?"0 2px 8px rgba(45,93,220,.2)":"none",
                transition:"all .15s"}}>
                <TabIcon size={14} strokeWidth={active?2.5:2}/>{lbl}
              </button>
            );
          })}
        </div>

        {tab==="home"&&(
          <div>
            {weekTest&&(
              <div style={{background:`linear-gradient(135deg,${AD.blue},#11CD87)`,borderRadius:16,
                padding:"24px 28px",marginBottom:24,color:"#fff",
                display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",opacity:.85,marginBottom:6,display:"flex",alignItems:"center",gap:5}}><Trophy size={12}/>Test of the Week</div>
                  <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>{weekTest.test_suite_name||"IELTS Test"}</div>
                  {weekTest.deadline&&<div style={{fontSize:12,opacity:.8}}>Due {new Date(weekTest.deadline).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</div>}
                </div>
                <button onClick={()=>handleStart(weekTest)} style={{background:"rgba(255,255,255,.2)",
                  border:"2px solid rgba(255,255,255,.4)",color:"#fff",borderRadius:12,
                  padding:"12px 28px",fontSize:14,fontWeight:800,cursor:"pointer"}}>
                  {weekTest.status==="in_progress"?"Continue →":weekTest.status==="interrupted"?"Restart →":"Start Test →"}
                </button>
              </div>
            )}
            {active.length>0&&(
              <>
                <h3 style={{fontSize:14,fontWeight:700,color:AD.muted,textTransform:"uppercase",
                  letterSpacing:"0.06em",marginBottom:12}}>Active Assignments</h3>
                {active.map(a=>(
                  <div key={a.id} style={{...mk.card({padding:"16px 20px",marginBottom:10}),
                    display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:AD.text,marginBottom:4}}>{a.test_suite_name||"IELTS Test"}</div>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <Badge status={isExpired(a)?"expired":a.status}/>
                        {a.deadline&&<span style={{fontSize:12,color:new Date(a.deadline)<new Date()?"#DC2626":AD.muted}}>
                          Due {new Date(a.deadline).toLocaleDateString("en-GB")}
                        </span>}
                      </div>
                    </div>
                    {!isExpired(a)&&<button onClick={()=>handleStart(a)}
                      style={{...mk.btn("primary"),padding:"10px 22px",whiteSpace:"nowrap"}}>
                      {a.status==="in_progress"?"Continue →":a.status==="interrupted"?"Restart →":"Start Test →"}
                    </button>}
                  </div>
                ))}
              </>
            )}
            {attempts.length>0&&(
              <>
                <h3 style={{fontSize:14,fontWeight:700,color:AD.muted,textTransform:"uppercase",
                  letterSpacing:"0.06em",marginBottom:12,marginTop:24}}>Last Test</h3>
                {(()=>{
                  const a = attempts[0];
                  const bColor = b => b>=7?"#059669":b>=5.5?"#D97706":"#DC2626";
                  const bBg    = b => b>=7?"#D1FAE5":b>=5.5?"#FEF3C7":"#FEE2E2";
                  const sections=[[Headphones,"L",a.listeningBand],[BookOpen,"R",a.readingBand],[Pencil,"W",a.writingBand],[Mic,"S",a.speakingBand]].filter(([,, b])=>b!=null);
                  return (
                    <div style={{...mk.card({padding:"18px 20px"})}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:15,color:AD.text,marginBottom:4}}>
                            {a.date||(a._createdAt?new Date(a._createdAt).toLocaleDateString("en-GB"):"—")}
                            {a.status==="complete"&&<span style={{fontSize:9,fontWeight:800,color:AD.blue,background:`${AD.blue}20`,borderRadius:4,padding:"1px 5px",marginLeft:8}}>✓ DONE</span>}
                          </div>
                          {a.listeningScore&&<div style={{fontSize:11,color:AD.muted}}>L:{a.listeningScore}{a.readingScore?` R:${a.readingScore}`:""}</div>}
                        </div>
                        {a.overall!=null&&(
                          <div style={{textAlign:"center"}}>
                            <div style={{fontSize:9,color:AD.muted,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Overall</div>
                            <div style={{fontSize:32,fontWeight:900,color:bColor(a.overall),lineHeight:1}}>{a.overall}</div>
                          </div>
                        )}
                      </div>
                      {sections.length>0&&(
                        <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}>
                          {sections.map(([Icon,lbl,b])=>(
                            <div key={lbl} style={{textAlign:"center",padding:"8px 14px",...mk.card({border:`1px solid ${AD.border}`})}}>
                              <div style={{marginBottom:2,display:"flex",justifyContent:"center",color:AD.muted}}><Icon size={14}/></div>
                              <div style={{fontSize:10,color:AD.muted,marginBottom:2,fontWeight:700}}>{lbl}</div>
                              <div style={{fontSize:18,fontWeight:900,color:bColor(b)}}>{b}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={()=>setTab("results")} style={{...mk.btn("ghost"),marginTop:14,fontSize:12,padding:"7px 16px"}}>
                        View full history & answers →
                      </button>
                    </div>
                  );
                })()}
              </>
            )}
            {!loading&&assignments.length===0&&(
              <div style={{...mk.card({padding:48,textAlign:"center"})}}>
                <div style={{fontSize:48,marginBottom:16}}>📭</div>
                <div style={{fontSize:16,fontWeight:700,color:AD.sub,marginBottom:8}}>No tests assigned yet</div>
                <div style={{color:AD.muted,fontSize:13}}>Your administrator will assign tests to you soon.</div>
              </div>
            )}
          </div>
        )}

        {tab==="tests"&&(
          <div>
            {loading?<div style={{textAlign:"center",padding:48,color:AD.muted}}>Loading…</div>:
              assignments.filter(a=>a.status!=="submitted").length===0?
              <div style={{...mk.card({padding:48,textAlign:"center"}),color:AD.muted}}>No active tests.</div>:
              assignments.filter(a=>a.status!=="submitted").map(a=>(
                <div key={a.id} style={{...mk.card({padding:"18px 22px",marginBottom:10}),
                  display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:AD.text,marginBottom:6}}>
                      {a.is_week_test&&<span style={{fontSize:10,background:`${AD.blue}20`,color:AD.blue,
                        padding:"2px 8px",borderRadius:10,fontWeight:700,marginRight:8,display:"inline-flex",alignItems:"center",gap:3}}><Trophy size={9}/>Week Test</span>}
                      {a.test_suite_name||"IELTS Test"}
                    </div>
                    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                      <Badge status={isExpired(a)?"expired":a.status}/>
                      {a.deadline&&<span style={{fontSize:12,color:new Date(a.deadline)<new Date()&&a.status!=="submitted"?"#DC2626":AD.muted}}>
                        {new Date(a.deadline)<new Date()&&a.status!=="submitted"?"⚠ Overdue — ":"Due "}
                        {new Date(a.deadline).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
                      </span>}
                    </div>
                  </div>
                  {!isExpired(a)&&a.status!=="submitted"&&(
                    <button onClick={()=>handleStart(a)} style={{...mk.btn("primary"),padding:"10px 22px",whiteSpace:"nowrap"}}>
                      {a.status==="in_progress"?"Continue →":a.status==="interrupted"?"Restart →":"Start Test →"}
                    </button>
                  )}
                </div>
              ))
            }
          </div>
        )}

        {tab==="results"&&(
          <div>
            {loading
              ? <div style={{textAlign:"center",padding:48,color:AD.muted}}>Loading…</div>
              : <>
                  <StudentHistoryView attempts={attempts}/>
                  {assignments.filter(a=>a.status==="submitted"&&a.result_data?.adminFeedback).length>0&&(
                    <div style={{marginTop:28}}>
                      <h3 style={{fontSize:14,fontWeight:700,color:AD.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:14}}>Feedback from Teacher</h3>
                      {assignments.filter(a=>a.status==="submitted"&&a.result_data?.adminFeedback).map(a=>(
                        <div key={a.id} style={{...mk.card({padding:"16px 20px",marginBottom:10})}}>
                          <div style={{fontWeight:700,fontSize:14,color:AD.text,marginBottom:8}}>{a.test_suite_name||"IELTS Test"}</div>
                          <div style={{background:`${AD.blue}08`,border:`1px solid ${AD.blue}30`,borderRadius:8,padding:12}}>
                            <div style={{fontSize:11,fontWeight:700,color:AD.blue,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Teacher Feedback</div>
                            <div style={{fontSize:13,color:AD.text,whiteSpace:"pre-wrap",lineHeight:1.6}}>{a.result_data.adminFeedback.text}</div>
                            {a.result_data.adminFeedback.addedAt&&<div style={{fontSize:11,color:AD.muted,marginTop:6}}>{new Date(a.result_data.adminFeedback.addedAt).toLocaleDateString("en-GB")}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
            }
          </div>
        )}

        {tab==="profile"&&<StudentProfileTab student={student} onLogout={onLogout}/>}
      </div>
    </div>
  );
}

function StudentProfileTab({ student, onLogout }) {
  const [showDel, setShowDel]     = useState(false);
  const [reason, setReason]       = useState("");
  const [msg, setMsg]             = useState("");

  // Change email
  const [newEmail, setNewEmail]   = useState("");
  const [emailMsg, setEmailMsg]   = useState("");
  const [emailSaving, setEmailSaving] = useState(false);

  // Change password
  const [curPw, setCurPw]         = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confPw, setConfPw]       = useState("");
  const [pwMsg, setPwMsg]         = useState("");
  const [pwSaving, setPwSaving]   = useState(false);
  const [showPw, setShowPw]       = useState(false);

  const submitDel = async () => {
    if (!reason.trim()) { setMsg("⚠ Please provide a reason."); return; }
    const ok = await createDeletionRequest(student.student_id, student.full_name, student.email, reason);
    setMsg(ok?"✓ Deletion request submitted. An administrator will process it.":"⚠ Failed. Please contact support.");
  };

  const saveEmail = async () => {
    const e = newEmail.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setEmailMsg("⚠ Enter a valid email address."); return; }
    if (e === student.email) { setEmailMsg("⚠ That's already your current email."); return; }
    setEmailSaving(true); setEmailMsg("");
    const { ok, error } = await updateStudentAccount(student.student_id, { email: e });
    if (ok) {
      // update session
      const sess = getStudentSession();
      if (sess) setStudentSession({ ...sess, email: e });
      setEmailMsg("✓ Email updated successfully.");
      setNewEmail("");
    } else {
      setEmailMsg("⚠ " + (error || "Failed to update email."));
    }
    setEmailSaving(false);
  };

  const savePw = async () => {
    if (!curPw || !newPw || !confPw) { setPwMsg("⚠ Please fill in all fields."); return; }
    if (newPw.length < 8) { setPwMsg("⚠ New password must be at least 8 characters."); return; }
    if (newPw !== confPw) { setPwMsg("⚠ Passwords don't match."); return; }
    setPwSaving(true); setPwMsg("");
    // Verify current password by attempting login
    const { error: loginErr } = await loginStudent(student.email, curPw);
    if (loginErr) { setPwMsg("⚠ Current password is incorrect."); setPwSaving(false); return; }
    const { ok, error } = await changeStudentPassword(student.student_id, newPw);
    if (ok) {
      setPwMsg("✓ Password changed successfully.");
      setCurPw(""); setNewPw(""); setConfPw("");
    } else {
      setPwMsg("⚠ " + (error || "Failed to change password."));
    }
    setPwSaving(false);
  };

  const AD = { blue:"#2D5DDC", text:"#151313", border:"#E2E6EA", bg:"#EEEFF1", muted:"#94A3B8", sub:"#64748B" };

  return (
    <div style={{maxWidth:560}}>
      {/* Account Info */}
      <div style={{...mk.card({padding:28}),marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:AD.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:"#fff",flexShrink:0}}>
            {(student.full_name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:AD.text,letterSpacing:"-0.03em"}}>{student.full_name}</div>
            <div style={{fontSize:13,color:AD.sub}}>{student.email}</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[["Username","@"+student.username],["Student ID",student.student_id]].map(([l,v])=>(
            <div key={l} style={{background:AD.bg,borderRadius:10,padding:"10px 14px"}}>
              <div style={{...mk.label,marginBottom:2,fontSize:10}}>{l}</div>
              <div style={{fontSize:13,color:AD.text,fontWeight:600}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Change Email */}
      <div style={{...mk.card({padding:24}),marginBottom:16}}>
        <h3 style={{fontSize:14,fontWeight:800,color:AD.text,marginBottom:4,letterSpacing:"-0.02em"}}>Change Email</h3>
        <p style={{fontSize:12,color:AD.muted,marginBottom:16,lineHeight:1.6}}>Update your login email address.</p>
        <div style={{marginBottom:12}}>
          <label style={mk.label}>Current email</label>
          <div style={{...mk.input({background:AD.bg,color:AD.sub,cursor:"default"}),marginBottom:10}}>{student.email}</div>
          <label style={mk.label}>New email address</label>
          <input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)}
            placeholder="your@newemail.com" style={mk.input({marginBottom:0})}/>
        </div>
        {emailMsg&&<div style={{fontSize:13,color:emailMsg.startsWith("✓")?"#059669":"#DC2626",marginBottom:10,fontWeight:600}}>{emailMsg}</div>}
        <button onClick={saveEmail} disabled={emailSaving||!newEmail.trim()} style={{...mk.btn("primary",emailSaving||!newEmail.trim()),padding:"9px 20px",fontSize:13}}>
          {emailSaving?"Saving…":"Update Email"}
        </button>
      </div>

      {/* Change Password */}
      <div style={{...mk.card({padding:24}),marginBottom:16}}>
        <h3 style={{fontSize:14,fontWeight:800,color:AD.text,marginBottom:4,letterSpacing:"-0.02em"}}>Change Password</h3>
        <p style={{fontSize:12,color:AD.muted,marginBottom:16,lineHeight:1.6}}>Choose a strong password of at least 8 characters.</p>
        <div style={{marginBottom:12,display:"flex",flexDirection:"column",gap:10}}>
          {[["Current password",curPw,setCurPw],["New password",newPw,setNewPw],["Confirm new password",confPw,setConfPw]].map(([lbl,val,setter])=>(
            <div key={lbl}>
              <label style={mk.label}>{lbl}</label>
              <div style={{position:"relative"}}>
                <input type={showPw?"text":"password"} value={val} onChange={e=>setter(e.target.value)}
                  placeholder="••••••••" style={mk.input({paddingRight:40})}/>
                <button type="button" onClick={()=>setShowPw(p=>!p)}
                  style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:AD.muted,padding:2}}>
                  {showPw?"🙈":"👁"}
                </button>
              </div>
            </div>
          ))}
        </div>
        {pwMsg&&<div style={{fontSize:13,color:pwMsg.startsWith("✓")?"#059669":"#DC2626",marginBottom:10,fontWeight:600}}>{pwMsg}</div>}
        <button onClick={savePw} disabled={pwSaving} style={{...mk.btn("primary",pwSaving),padding:"9px 20px",fontSize:13}}>
          {pwSaving?"Saving…":"Change Password"}
        </button>
      </div>

      {/* Delete Account */}
      <div style={{...mk.card({padding:24,border:"1px solid #FEE2E2"})}}>
        <h3 style={{fontSize:14,fontWeight:800,color:"#DC2626",marginBottom:4}}>Delete My Account</h3>
        <p style={{fontSize:12,color:AD.sub,lineHeight:1.7,marginBottom:16}}>
          Requesting deletion will permanently remove all your data after admin approval.
        </p>
        {!showDel?
          <button onClick={()=>setShowDel(true)} style={{...mk.btn("danger"),fontSize:13,padding:"9px 20px"}}>Request Account Deletion</button>:
          <div>
            <label style={mk.label}>Reason for deletion</label>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3}
              style={{...mk.input(),resize:"vertical",marginBottom:12}}
              placeholder="Please tell us why…"/>
            <Msg text={msg}/>
            {!msg.startsWith("✓")&&<button onClick={submitDel} style={{...mk.btn("danger"),width:"100%",padding:10}}>
              Submit Deletion Request
            </button>}
          </div>
        }
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: STUDENTS MANAGER
// ══════════════════════════════════════════════════════════════════════════════
export function StudentsManager({ testSuites=[], adminName="admin", isTeacher=false, initialSearch="" }) {
  const [students, setStudents]       = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState(initialSearch);
  const [profile, setProfile]         = useState(null);
  const [profileAttempts, setProfileAttempts] = useState([]);
  const [modal, setModal]             = useState(null);
  const [selected, setSelected]       = useState(null);
  const [msg, setMsg]                 = useState("");
  const [cName,setCName]=useState(""); const [cEmail,setCEmail]=useState("");
  const [cPhone,setCPhone]=useState(""); const [cPw,setCPw]=useState(genTempPassword());
  const [cLoading,setCLoading]=useState(false); const [cErr,setCErr]=useState("");
  const [created,setCreated]=useState(null);
  const [aSuiteId,setASuiteId]=useState(""); const [aDeadline,setADeadline]=useState("");
  const [aTargets,setATargets]=useState([]); const [aLoading,setALoading]=useState(false);
  const [aAssignMode,setAAssignMode]=useState("suite"); // "suite"|"module"
  const [aModuleType,setAModuleType]=useState("");       // "listening"|"reading"|"writing1"|"writing2"
  const [aModuleTestId,setAModuleTestId]=useState("");
  const [profileTab,setProfileTab]=useState("history");  // "history"|"upcoming"|"feedback"
  const [feedbackAssign, setFeedbackAssign] = useState(null);
  const [feedbackText, setFeedbackText]     = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [writingUnchecked, setWritingUnchecked] = useState([]);
  const [recheckingAll, setRecheckingAll]   = useState(false);

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const [s,a]=await Promise.all([getAllStudents(),getAllAssignments()]);
      setStudents(s||[]); setAssignments(a||[]);
    } catch(e) {
      console.warn("[StudentsManager] load error:", e?.message);
      setStudents([]); setAssignments([]);
    } finally {
      setLoading(false);
    }
  },[]);
  useEffect(()=>{load();},[load]);

  // Fetch today's completed tests with no writing band but writing texts
  useEffect(()=>{
    const today = new Date().toISOString().slice(0,10);
    if (!supabase) return;
    supabase.from("participants")
        .select("id,email,data")
        .not("type","in","(test_item,test_del)")
        .gte("created_at", today + "T00:00:00.000Z")
        .lte("created_at", today + "T23:59:59.999Z")
        .order("created_at", { ascending: false })
        .limit(500)
        .then(({ data }) => {
          if (!data) return;
          const seen = {};
          const rows = [];
          for (const r of data) {
            const k = r.data?.id || r.id;
            if (!seen[k]) { seen[k] = true; rows.push(r); }
          }
          const unchecked = rows.filter(r => {
            const d = r.data || {};
            const hasWriting = d.writingTexts && (d.writingTexts[0] || d.writingTexts[1]);
            return hasWriting && d.writingBand == null && (d.status === "complete" || d.status === "in_progress");
          }).map(r => ({
            rowId: r.id, email: r.email,
            name: (r.data?.candidate||r.data)?.name || r.email,
            writingTexts: r.data?.writingTexts||{},
            sessionId: r.data?.id||r.id,
            _rechecking: false,
          }));
          setWritingUnchecked(unchecked);
        });
  }, []);

  const flash=m=>{setMsg(m);setTimeout(()=>setMsg(""),4000);};
  const openProfile = async (s) => {
    setProfile(s);
    setProfileAttempts([]);
    if (s?.email) {
      let atts = await getStudentAttempts(s.email);
      // Fallback: if no participants rows found, synthesize from submitted assignments
      if (atts.length === 0) {
        const sAssign = assignments.filter(a => a.student_id === s.student_id && a.status === "submitted");
        atts = sAssign.map(a => ({
          id: a.id,
          status: "complete",
          date: a.completed_at ? new Date(a.completed_at).toLocaleDateString("en-GB") : "—",
          timestamp: a.completed_at ? new Date(a.completed_at).getTime() : 0,
          candidate: { name: s.full_name, email: s.email },
          listeningBand: a.scores?.listeningBand ?? null,
          readingBand:   a.scores?.readingBand   ?? null,
          writingBand:   a.scores?.writingBand   ?? null,
          speakingBand:  a.scores?.speakingBand  ?? null,
          overall:       a.scores?.overall       ?? null,
          listeningScore: a.result_data?.listeningScore || null,
          readingScore:   a.result_data?.readingScore   || null,
          listeningAnswers: a.result_data?.listeningAnswers || {},
          allListeningQuestions: a.result_data?.allListeningQuestions || [],
          readingAnswers:   a.result_data?.readingAnswers || {},
          allReadingQuestions: a.result_data?.allReadingQuestions || [],
          writingTexts:    a.result_data?.writingTexts    || {},
          writingFeedback: a.result_data?.writingFeedback || null,
          suiteName: a.test_suite_name || null,
          _rowId: null,
          _assignmentId: a.id,
          _fromAssignment: true,
          _createdAt: a.completed_at || a.assigned_at,
        }));
      }
      setProfileAttempts(atts);
    }
  };

  const handleSaveParticipant = async (rowId, updates) => {
    if (!rowId) return; // synthetic assignment-based entry — no participants row to update
    const { ok, error } = await updateParticipantData(rowId, updates);
    if (!ok) { flash("⚠ " + (error||"Failed to save")); return; }
    flash("✓ Saved");
    setProfileAttempts(prev => prev.map(a => a._rowId === rowId ? { ...a, ...updates } : a));
  };

  const handleRecheckWriting = async (attempt, assignmentId) => {
    const texts = attempt.writingTexts || {};
    const task1 = texts[0] || texts.task1 || "";
    const task2 = texts[1] || texts.task2 || "";
    if (!task1 && !task2) { flash("⚠ No writing text found to recheck."); return; }

    setProfileAttempts(prev => prev.map(a =>
      (a._rowId === attempt._rowId && a.id === attempt.id) ? { ...a, _rechecking: true } : a));

    const checkOne = async (text, taskIdx) => {
      if (!text || text.trim().split(/\s+/).length < 10) return null;
      try {
        const res = await fetch("/api/ai-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, taskMeta: { task: `Task ${taskIdx+1}`, prompt: "" } }),
        });
        const data = await res.json();
        return res.ok && !data._error ? data : null;
      } catch { return null; }
    };

    const [fb0, fb1] = await Promise.all([checkOne(task1, 0), checkOne(task2, 1)]);
    const feedback = {};
    if (fb0) feedback[0] = fb0;
    if (fb1) feedback[1] = fb1;

    const bands = [fb0?.band, fb1?.band].filter(b => b != null);
    const wBand = bands.length === 2 ? Math.round((bands[0]*.34 + bands[1]*.66)*2)/2
      : bands.length === 1 ? bands[0] : null;

    if (assignmentId) {
      await updateAssignment(assignmentId, {
        scores: { ...(attempt.scores||{}), writingBand: wBand },
        result_data: { ...(attempt.result_data||{}), writingFeedback: feedback },
      });
    }
    if (attempt._rowId) {
      await updateParticipantData(attempt._rowId, { writingFeedback: feedback, writingBand: wBand });
    }

    setProfileAttempts(prev => prev.map(a =>
      (a._rowId === attempt._rowId && a.id === attempt.id)
        ? { ...a, writingFeedback: feedback, writingBand: wBand, _rechecking: false }
        : a));
    flash(wBand != null ? `✓ Writing rechecked — Band ${wBand}` : "⚠ Recheck done but no band scored.");
  };

  const handleSaveFeedback = async () => {
    if (!feedbackAssign) return;
    setFeedbackSaving(true);
    const existing = feedbackAssign.result_data || {};
    const ok = await updateAssignment(feedbackAssign.id, {
      result_data: { ...existing, adminFeedback: { text: feedbackText, addedBy: adminName, addedAt: new Date().toISOString() } }
    });
    setFeedbackSaving(false);
    if (!ok) { flash("⚠ Failed to save feedback."); return; }
    setAssignments(prev => prev.map(a => a.id === feedbackAssign.id
      ? { ...a, result_data: { ...(a.result_data||{}), adminFeedback: { text: feedbackText, addedBy: adminName, addedAt: new Date().toISOString() } } }
      : a
    ));
    flash("✓ Feedback saved.");
    setFeedbackAssign(null);
  };

  const handleRecheckOne = async (item) => {
    setWritingUnchecked(prev => prev.map(x => x.sessionId === item.sessionId ? {...x, _rechecking: true} : x));
    try {
      const atx = item.writingTexts || {};
      const newFb = {};
      const bands = [];
      for (const ti of [0, 1]) {
        const txt = atx[ti]; if (!txt) continue;
        const res = await fetch("/api/ai-check", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: txt, taskMeta: { task: `Task ${ti + 1}`, prompt: ti === 0 ? "IELTS Writing Task 1" : "IELTS Writing Task 2" } }),
        });
        if (res.ok) { const fb = await res.json(); newFb[ti] = fb; if (fb.band != null) bands.push(fb.band); }
      }
      const wBand = bands.length ? Math.round(bands.reduce((x,b)=>x+b,0)/bands.length*2)/2 : null;
      if (wBand != null) {
        if (supabase) {
          supabase.from("participants").select("data").eq("id", item.rowId).maybeSingle().then(({ data: row }) => {
            if (!row) return;
            const merged = { ...row.data, writingBand: wBand, writingFeedback: newFb };
            supabase.from("participants").update({ data: merged }).eq("id", item.rowId);
          });
        }
      }
      setWritingUnchecked(prev => wBand != null
        ? prev.filter(x => x.sessionId !== item.sessionId)
        : prev.map(x => x.sessionId === item.sessionId ? {...x, _rechecking: false, _error: true} : x));
    } catch {
      setWritingUnchecked(prev => prev.map(x => x.sessionId === item.sessionId ? {...x, _rechecking: false, _error: true} : x));
    }
  };

  const handleRecheckAll = async () => {
    setRecheckingAll(true);
    const pending = writingUnchecked.filter(x => !x._rechecking);
    for (const item of pending) await handleRecheckOne(item);
    setRecheckingAll(false);
  };

  const filtered=students.filter(s=>!search||[s.full_name,s.email,s.username,s.student_id].some(v=>(v||"").toLowerCase().includes(search.toLowerCase())));
  const publishedSuites=(testSuites||[]).filter(s=>s.status==="published");
  const activeStudents=students.filter(s=>s.status==="active");

  const handleCreate=async e=>{
    e.preventDefault();
    if(!cName.trim()||!cEmail.trim()){setCErr("Name and email are required.");return;}
    setCLoading(true);setCErr("");
    const{student,error}=await createStudentAccount({fullName:cName,email:cEmail,phone:cPhone,password:cPw,createdBy:adminName});
    setCLoading(false);
    if(error){setCErr(error);return;}
    setCreated({...student,_plainPassword:cPw});
    setStudents(s=>[student,...s]);
    setCName("");setCEmail("");setCPhone("");setCPw(genTempPassword());
  };

  const modLabel={"listening":"Listening","reading":"Reading","writing1":"Writing Task 1","writing2":"Writing Task 2"};
  const modTestKey={"listening":"listeningId","reading":"readingId","writing1":"writing1Id","writing2":"writing2Id"};
  const modTypeMap={"listening":"Listening","reading":"Reading","writing1":"Writing","writing2":"Writing"};
  const handleAssign=async e=>{
    e.preventDefault();
    if(!selected)return;
    setALoading(true);
    let error;
    if(aAssignMode==="suite"){
      if(!aSuiteId){setALoading(false);return;}
      const suite=publishedSuites.find(s=>s.id===aSuiteId);
      ({error}=await createAssignment({studentId:selected.student_id,suiteId:aSuiteId,
        suiteName:suite?.name||"",deadline:aDeadline?new Date(aDeadline).toISOString():undefined,assignedBy:adminName}));
    } else {
      if(!aModuleType){setALoading(false);flash("⚠ Select a module type.");return;}
      const label=`${modLabel[aModuleType]||aModuleType} only`;
      const moduleConfig={singleModule:aModuleType,label,...(aModuleTestId?{[modTestKey[aModuleType]]:aModuleTestId}:{})};
      ({error}=await createAssignment({studentId:selected.student_id,suiteId:null,
        suiteName:label,deadline:aDeadline?new Date(aDeadline).toISOString():undefined,
        assignedBy:adminName,moduleConfig}));
    }
    setALoading(false);
    if(error){flash("⚠ "+error);return;}
    flash("✓ Test assigned!");setModal(null);setASuiteId("");setADeadline("");setAAssignMode("suite");setAModuleType("");setAModuleTestId("");load();
  };

  const handleWeekTest=async e=>{
    e.preventDefault();
    if(!aSuiteId||!aTargets.length)return;
    setALoading(true);
    const suite=publishedSuites.find(s=>s.id===aSuiteId);
    const{error}=await setWeekTest({suiteId:aSuiteId,suiteName:suite?.name||"",studentIds:aTargets,
      deadline:aDeadline?new Date(aDeadline).toISOString():undefined,assignedBy:adminName});
    setALoading(false);
    if(error){flash("⚠ "+error);return;}
    flash(`✓ Week Test assigned to ${aTargets.length} student(s)!`);
    setModal(null);setASuiteId("");setADeadline("");setATargets([]);load();
  };

  const handleReset=async()=>{
    const pw=genTempPassword();setALoading(true);
    const{ok,error}=await resetStudentPassword(selected.student_id,pw);
    setALoading(false);
    if(!ok){flash("⚠ "+error);return;}
    setCreated({...selected,_plainPassword:pw});setModal("credentials");load();
  };

  const toggleStatus=async s=>{
    await (s.status==="active"?deactivateStudent:reactivateStudent)(s.student_id);
    flash(`✓ Account ${s.status==="active"?"deactivated":"reactivated"}.`);load();
  };

  const removeAssign=async id=>{await deleteAssignment(id);flash("✓ Assignment removed.");load();};

  if(profile){
    const sAssign=assignments.filter(a=>a.student_id===profile.student_id);
    const done=sAssign.filter(a=>a.status==="submitted");
    return (
      <div>
        <button onClick={()=>setProfile(null)} style={{...mk.btn("ghost"),marginBottom:20,fontSize:13}}>← Back to Students</button>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
          <div style={{...mk.card({padding:24})}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:800,color:AD.text,margin:0}}>{profile.full_name}</h3>
              <Badge status={profile.status}/>
            </div>
            {[["Email",profile.email],["Username",profile.username],["Student ID",profile.student_id],
              ["Phone",profile.phone||"—"],["Joined",profile.created_at?new Date(profile.created_at).toLocaleDateString("en-GB"):"—"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",
                borderBottom:`1px solid ${AD.bg}`,fontSize:13}}>
                <span style={{color:AD.muted,fontWeight:600}}>{l}</span>
                <span style={{color:AD.text}}>{v}</span>
              </div>
            ))}
            {!isTeacher&&<div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}>
              <button onClick={()=>{setSelected(profile);setModal("assign");setASuiteId("");setADeadline("");setAAssignMode("suite");setAModuleType("");setAModuleTestId("");}}
                style={{...mk.btn("primary"),fontSize:12,padding:"8px 14px"}}>+ Assign Test</button>
              <button onClick={()=>{setSelected(profile);setModal("reset");}}
                style={{...mk.btn("ghost"),fontSize:12,padding:"8px 14px"}}>Reset Password</button>
              <button onClick={()=>toggleStatus(profile)}
                style={{...mk.btn("ghost"),fontSize:12,padding:"8px 14px",
                  color:profile.status==="active"?"#DC2626":"#059669"}}>
                {profile.status==="active"?"Deactivate":"Activate"}
              </button>
            </div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[["Total Assignments",sAssign.length,"#2D5DDC"],
              ["Completed",done.length,"#059669"],
              ["In Progress",sAssign.filter(a=>a.status==="in_progress").length,"#D97706"]].map(([l,v,c])=>(
              <div key={l} style={{...mk.card({padding:"14px 20px",flex:1})}}>
                <div style={{fontSize:11,color:AD.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{l}</div>
                <div style={{fontSize:28,fontWeight:900,color:c}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Profile Tabs */}
        <div style={{display:"flex",gap:4,marginBottom:20,background:AD.bg,borderRadius:12,padding:4}}>
          {[["history","Test History"],["upcoming","Upcoming & Assigned"],["feedback","Feedback"]].map(([t,lbl])=>(
            <button key={t} onClick={()=>setProfileTab(t)} style={{
              background:profileTab===t?AD.surface:"transparent",border:"none",padding:"8px 16px",cursor:"pointer",fontSize:13,
              fontWeight:profileTab===t?700:500,color:profileTab===t?"#2D5DDC":AD.muted,
              borderRadius:9,boxShadow:profileTab===t?"0 1px 4px rgba(0,0,0,.08)":"none",transition:"all .15s"
            }}>{lbl}</button>
          ))}
        </div>

        {profileTab==="history"&&<StudentHistoryView attempts={profileAttempts} canEdit={true} onSave={handleSaveParticipant} onRecheck={handleRecheckWriting}/>}

        {profileTab==="feedback"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{margin:0,fontSize:15,fontWeight:800,color:AD.text}}>Student Feedback</h3>
            </div>
            {done.length===0
              ? <div style={{...mk.card({padding:32,textAlign:"center"}),color:AD.muted}}>No submitted tests yet.</div>
              : done.map(a=>(
                <div key={a.id} style={{...mk.card({padding:"16px 20px",marginBottom:10})}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:a.result_data?.adminFeedback?12:0}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:AD.text,marginBottom:4}}>{a.test_suite_name||"IELTS Test"}</div>
                      <div style={{fontSize:11,color:AD.muted}}>Submitted {a.completed_at?new Date(a.completed_at).toLocaleDateString("en-GB"):"—"}</div>
                    </div>
                    <button onClick={()=>{setFeedbackAssign(a);setFeedbackText(a.result_data?.adminFeedback?.text||"");setModal("feedback");}}
                      style={{...mk.btn("primary"),padding:"7px 16px",fontSize:12,whiteSpace:"nowrap"}}>
                      {a.result_data?.adminFeedback?"Edit Feedback":"Write Feedback"}
                    </button>
                  </div>
                  {a.result_data?.adminFeedback&&(
                    <div style={{background:`#EBF0FF`,border:`1px solid #C7D5F8`,borderRadius:8,padding:12}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#2D5DDC",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.07em"}}>Feedback</div>
                      <div style={{fontSize:13,color:AD.text,whiteSpace:"pre-wrap",lineHeight:1.6}}>{a.result_data.adminFeedback.text}</div>
                      <div style={{fontSize:11,color:AD.muted,marginTop:6}}>Added by {a.result_data.adminFeedback.addedBy} · {new Date(a.result_data.adminFeedback.addedAt).toLocaleDateString("en-GB")}</div>
                    </div>
                  )}
                </div>
              ))
            }
            {modal==="feedback"&&feedbackAssign&&(
              <Modal title="Write Feedback" onClose={()=>{setModal(null);setFeedbackAssign(null);}} width={520}>
                <div style={{marginBottom:8,fontSize:13,color:AD.sub,fontWeight:600}}>{feedbackAssign.test_suite_name||"IELTS Test"}</div>
                <textarea rows={7} value={feedbackText} onChange={e=>setFeedbackText(e.target.value)}
                  placeholder="Write your feedback for this student here… (e.g., speaking notes, writing comments, general remarks)"
                  style={{width:"100%",boxSizing:"border-box",padding:12,borderRadius:8,border:`1px solid ${AD.border}`,
                    fontSize:13,fontFamily:"inherit",resize:"vertical",lineHeight:1.6,marginBottom:16,color:AD.text}}/>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>{setModal(null);setFeedbackAssign(null);}} style={{...mk.btn("ghost"),flex:1,padding:10}}>Cancel</button>
                  <button onClick={handleSaveFeedback} disabled={feedbackSaving||!feedbackText.trim()}
                    style={{...mk.btn("primary",feedbackSaving||!feedbackText.trim()),flex:1,padding:10}}>
                    {feedbackSaving?"Saving…":"Save Feedback"}
                  </button>
                </div>
              </Modal>
            )}
          </div>
        )}

        {profileTab==="upcoming"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{margin:0,fontSize:15,fontWeight:800,color:AD.text}}>Assigned / Upcoming Tests</h3>
              <button onClick={()=>{setSelected(profile);setModal("assign");setASuiteId("");setADeadline("");setAAssignMode("suite");setAModuleType("");setAModuleTestId("");}}
                style={{...mk.btn("primary"),fontSize:12,padding:"8px 16px"}}>+ Assign Test</button>
            </div>
            {sAssign.filter(a=>a.status!=="submitted").length===0
              ? <div style={{...mk.card({padding:32,textAlign:"center"}),color:AD.muted}}>No upcoming tests.</div>
              : sAssign.filter(a=>a.status!=="submitted").map(a=>(
                <div key={a.id} style={{...mk.card({padding:"14px 18px",marginBottom:8}),
                  display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:AD.text,marginBottom:4}}>
                      {a.is_week_test&&<span style={{fontSize:10,background:"#EBF0FF",color:"#2D5DDC",padding:"2px 8px",borderRadius:8,fontWeight:700,marginRight:6,display:"inline-flex",alignItems:"center",gap:3}}><Trophy size={9}/>Week Test</span>}
                      {a.test_suite_name||"IELTS Test"}
                    </div>
                    <div style={{fontSize:11,color:AD.muted}}>
                      Assigned {new Date(a.assigned_at).toLocaleDateString("en-GB")}
                      {a.deadline?` · Due ${new Date(a.deadline).toLocaleDateString("en-GB")}`:""}</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <Badge status={a.status}/>
                    <button onClick={()=>removeAssign(a.id)} style={{...mk.btn("ghost"),padding:"4px 10px",fontSize:12,color:"#DC2626"}}>Remove</button>
                  </div>
                </div>
              ))
            }
          </div>
        )}
        {modal==="assign"&&selected&&(()=>{
          const dbTests = loadDB().tests||[];
          const modTypeMap2={"listening":"Listening","reading":"Reading","writing1":"Writing","writing2":"Writing"};
          const availTests = aModuleType ? dbTests.filter(t=>(t.type||"").toLowerCase()===modTypeMap2[aModuleType]?.toLowerCase()) : [];
          const canSubmit = aAssignMode==="suite"?!!aSuiteId:(!!aModuleType);
          return (
          <Modal title={`Assign Test — ${selected.full_name}`} onClose={()=>setModal(null)}>
            <form onSubmit={handleAssign}>
              {/* Mode toggle */}
              <div style={{display:"flex",gap:4,marginBottom:20,padding:4,background:AD.bg,borderRadius:10}}>
                {[["suite","Full Suite"],["module","Single Module"]].map(([m,lbl])=>(
                  <button key={m} type="button" onClick={()=>{setAAssignMode(m);setASuiteId("");setAModuleType("");setAModuleTestId("");}}
                    style={{flex:1,padding:"8px 0",border:"none",borderRadius:7,cursor:"pointer",fontSize:13,fontWeight:700,
                      background:aAssignMode===m?"#2D5DDC":"transparent",color:aAssignMode===m?"#fff":AD.muted,transition:"all .15s"}}>{lbl}</button>
                ))}
              </div>

              {aAssignMode==="suite"?(
                <F><label style={mk.label}>Test Suite *</label>
                  <select style={mk.input()} value={aSuiteId} onChange={e=>setASuiteId(e.target.value)}>
                    <option value="">— Select a test suite —</option>
                    {publishedSuites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></F>
              ):(
                <>
                  <F><label style={mk.label}>Module *</label>
                    <select style={mk.input()} value={aModuleType} onChange={e=>{setAModuleType(e.target.value);setAModuleTestId("");}}>
                      <option value="">— Select module —</option>
                      {[["listening","Listening"],["reading","Reading"],["writing1","Writing Task 1"],["writing2","Writing Task 2"]].map(([v,l])=>(
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select></F>
                  {aModuleType&&(
                    <F><label style={mk.label}>Specific Test (optional)</label>
                      <select style={mk.input()} value={aModuleTestId} onChange={e=>setAModuleTestId(e.target.value)}>
                        <option value="">— Any available test —</option>
                        {availTests.map(t=><option key={t.id} value={t.id}>{t.title||t.id}</option>)}
                      </select>
                      <div style={{fontSize:11,color:AD.muted,marginTop:4}}>Leave blank to use first matching test from suite</div>
                    </F>
                  )}
                </>
              )}
              <F><label style={mk.label}>Deadline (optional)</label>
                <input type="datetime-local" style={mk.input()} value={aDeadline} onChange={e=>setADeadline(e.target.value)}/></F>
              <button type="submit" disabled={aLoading||!canSubmit} style={{...mk.btn("primary",aLoading||!canSubmit),width:"100%",padding:12}}>
                {aLoading?"Assigning…":"Assign Test"}
              </button>
            </form>
          </Modal>
          );
        })()}
        {modal==="reset"&&selected&&(
          <Modal title={`Reset Password — ${selected.full_name}`} onClose={()=>setModal(null)} width={420}>
            {created?<CredDisplay student={created} onDone={()=>{setCreated(null);setModal(null);}}/>:
              <div>
                <p style={{fontSize:13,color:AD.sub,lineHeight:1.7,marginBottom:20}}>Generates a new temporary password. Student must change it on next login.</p>
                <button onClick={handleReset} disabled={aLoading} style={{...mk.btn("danger",aLoading),width:"100%",padding:12}}>
                  {aLoading?"Resetting…":"Generate New Password"}
                </button>
              </div>
            }
          </Modal>
        )}
        {modal==="credentials"&&created&&(
          <Modal title="Student Credentials" onClose={()=>{setCreated(null);setModal(null);}} width={440}>
            <CredDisplay student={created} onDone={()=>{setCreated(null);setModal(null);}}/>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <h2 style={{fontSize:22,fontWeight:800,color:AD.text,margin:0}}>Students</h2>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          {msg&&<span style={{fontSize:13,color:msg.startsWith("✓")?"#059669":"#DC2626"}}>{msg}</span>}
          {isTeacher&&<span style={{fontSize:11,fontWeight:700,padding:"3px 10px",background:"#EDE9FE",color:"#7C3AED",borderRadius:20,letterSpacing:"0.07em"}}>TEACHER VIEW</span>}
          {!isTeacher&&<button onClick={()=>{setModal("weektest");setATargets(activeStudents.map(s=>s.student_id));}} style={{...mk.btn("ghost"),display:"inline-flex",alignItems:"center",gap:6}}><Trophy size={13}/>Set Week Test</button>}
          {!isTeacher&&<button onClick={()=>{setModal("create");setCreated(null);}} style={mk.btn("primary")}>+ Add Student</button>}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        {[["Total",students.length,"#2D5DDC"],["Active",activeStudents.length,"#059669"],
          ["Assignments",assignments.length,"#7C3AED"]].map(([l,v,c])=>(
          <div key={l} style={{...mk.card({padding:"14px 20px"})}}>
            <div style={{fontSize:11,color:AD.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>{l}</div>
            <div style={{fontSize:26,fontWeight:900,color:c}}>{v}</div>
          </div>
        ))}
      </div>
      {/* Writing Unchecked Today banner */}
      {writingUnchecked.length > 0 && (
        <div style={{background:"#FFFBEB",border:"1.5px solid #F59E0B",borderRadius:12,padding:"14px 18px",marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>✍️</span>
              <div>
                <div style={{fontWeight:800,fontSize:14,color:"#92400E"}}>
                  {writingUnchecked.length} test{writingUnchecked.length!==1?"s":""} today — writing not checked
                </div>
                <div style={{fontSize:12,color:"#B45309",marginTop:2}}>
                  {[...new Set(writingUnchecked.map(x=>x.name))].slice(0,5).join(", ")}
                  {new Set(writingUnchecked.map(x=>x.email)).size > 5 && "…"}
                </div>
              </div>
            </div>
            <button
              onClick={handleRecheckAll}
              disabled={recheckingAll}
              style={{background:recheckingAll?"#94A3B8":"#F59E0B",color:"#fff",border:"none",
                borderRadius:8,padding:"8px 18px",fontWeight:800,fontSize:13,cursor:recheckingAll?"not-allowed":"pointer",
                whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6}}>
              {recheckingAll?"Checking all…":"✦ Recheck All Writing"}
            </button>
          </div>
          <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:5,maxHeight:200,overflowY:"auto"}}>
            {writingUnchecked.map(item => (
              <div key={item.sessionId} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                background:"#FEF3C7",borderRadius:8,padding:"6px 12px",gap:8}}>
                <div>
                  <span style={{fontWeight:700,fontSize:13,color:"#92400E"}}>{item.name}</span>
                  <span style={{fontSize:11,color:"#B45309",marginLeft:6}}>{item.email}</span>
                  {item._error&&<span style={{fontSize:10,color:"#DC2626",marginLeft:6}}>⚠ Check failed</span>}
                </div>
                <button
                  onClick={()=>handleRecheckOne(item)}
                  disabled={item._rechecking||recheckingAll}
                  style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:6,border:"none",
                    background:item._rechecking?"#94A3B8":"#D97706",color:"#fff",cursor:item._rechecking?"not-allowed":"pointer",
                    whiteSpace:"nowrap"}}>
                  {item._rechecking?"Checking…":"Check"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <input style={{...mk.input({maxWidth:360,marginBottom:16})}} value={search}
        onChange={e=>setSearch(e.target.value)} placeholder="Search by name, email, username, ID…"/>
      {loading?<div style={{textAlign:"center",padding:48,color:AD.muted}}>Loading students…</div>:
        filtered.length===0?<div style={{...mk.card({padding:48,textAlign:"center"}),color:AD.muted}}>
          {search?"No students match your search.":"No students yet. Add your first student!"}</div>:
        <div style={{...mk.card(),overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:`2px solid ${AD.bg}`}}>
                {["Student","Status","Assignments","Actions"].map(h=>(
                  <th key={h} style={{padding:"12px 16px",fontSize:11,fontWeight:700,color:AD.muted,
                    textTransform:"uppercase",letterSpacing:"0.06em",textAlign:"left"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s)=>{
                const cnt=assignments.filter(a=>a.student_id===s.student_id).length;
                return (
                  <tr key={s.id} style={{borderBottom:`1px solid ${AD.bg}`}}
                    onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"14px 16px"}}>
                      <button onClick={()=>openProfile(s)}
                        style={{background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:0}}>
                        <div style={{fontWeight:700,fontSize:14,color:"#151313",marginBottom:2}}>{s.full_name}</div>
                        <div style={{fontSize:12,color:AD.muted,fontFamily:"monospace"}}>{s.email}</div>
                      </button>
                    </td>
                    <td style={{padding:"14px 16px"}}><Badge status={s.status}/></td>
                    <td style={{padding:"14px 16px",fontSize:13,color:AD.sub,fontWeight:500}}>{cnt} test{cnt!==1?"s":""}</td>
                    <td style={{padding:"14px 16px"}}>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        <button onClick={()=>openProfile(s)} style={{...mk.btn("ghost"),padding:"5px 14px",fontSize:12,borderRadius:20}}>Profile</button>
                        {!isTeacher&&<button onClick={()=>{setSelected(s);setModal("assign");setASuiteId("");setADeadline("");}} style={{...mk.btn("ghost"),padding:"5px 14px",fontSize:12,borderRadius:20}}>Assign</button>}
                        {!isTeacher&&<button onClick={()=>{setSelected(s);setModal("reset");}} style={{...mk.btn("ghost"),padding:"5px 14px",fontSize:12,borderRadius:20}}>Reset PW</button>}
                        {!isTeacher&&<button onClick={()=>toggleStatus(s)} style={{...mk.btn("ghost"),padding:"5px 14px",fontSize:12,borderRadius:20,
                          color:s.status==="active"?"#DC2626":"#059669",outline:"none",border:`1.5px solid ${s.status==="active"?"#FCA5A5":"#6EE7B7"}`}}>
                          {s.status==="active"?"Deactivate":"Activate"}
                        </button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      }
      {modal==="create"&&(
        <Modal title="Create Student Account" onClose={()=>setModal(null)} width={480}>
          {created?<CredDisplay student={created} onDone={()=>{setCreated(null);setModal(null);}}/>:
            <form onSubmit={handleCreate}>
              <F><label style={mk.label}>Full Name *</label><input style={mk.input()} value={cName} onChange={e=>setCName(e.target.value)} placeholder="Jane Smith" autoFocus/></F>
              <F><label style={mk.label}>Email *</label><input type="email" style={mk.input()} value={cEmail} onChange={e=>setCEmail(e.target.value)} placeholder="jane@example.com"/></F>
              <F><label style={mk.label}>Phone</label><input type="tel" style={mk.input()} value={cPhone} onChange={e=>setCPhone(e.target.value)} placeholder="+1 555 000 0000"/></F>
              <F><label style={mk.label}>Temporary Password</label>
                <div style={{display:"flex",gap:8}}>
                  <input style={mk.input()} value={cPw} onChange={e=>setCPw(e.target.value)}/>
                  <button type="button" onClick={()=>setCPw(genTempPassword())} style={{...mk.btn("ghost"),whiteSpace:"nowrap",padding:"10px 14px"}}>↻</button>
                </div>
                <div style={{fontSize:11,color:AD.muted,marginTop:4}}>Student must change on first login.</div></F>
              <Msg text={cErr}/>
              <button type="submit" disabled={cLoading} style={{...mk.btn("primary",cLoading),width:"100%",padding:12}}>
                {cLoading?"Creating…":"Create Account"}
              </button>
            </form>
          }
        </Modal>
      )}
      {modal==="weektest"&&(
        <Modal title="Set Test of the Week" onClose={()=>setModal(null)} width={560}>
          <form onSubmit={handleWeekTest}>
            <F><label style={mk.label}>Test Suite *</label>
              <select style={mk.input()} value={aSuiteId} onChange={e=>setASuiteId(e.target.value)} required>
                <option value="">— Select a test suite —</option>
                {publishedSuites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select></F>
            <F><label style={mk.label}>Deadline (optional)</label>
              <input type="datetime-local" style={mk.input()} value={aDeadline} onChange={e=>setADeadline(e.target.value)}/></F>
            <F><label style={mk.label}>Assign to ({aTargets.length} selected)</label>
              <div style={{maxHeight:180,overflowY:"auto",border:`1px solid ${AD.border}`,borderRadius:10,padding:"8px 12px"}}>
                <label style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  <input type="checkbox" checked={aTargets.length===activeStudents.length}
                    onChange={e=>setATargets(e.target.checked?activeStudents.map(s=>s.student_id):[])}/>
                  Select all ({activeStudents.length})
                </label>
                {activeStudents.map(s=>(
                  <label key={s.student_id} style={{display:"flex",gap:8,alignItems:"center",padding:"3px 0",cursor:"pointer",fontSize:13}}>
                    <input type="checkbox" checked={aTargets.includes(s.student_id)}
                      onChange={e=>setATargets(p=>e.target.checked?[...p,s.student_id]:p.filter(id=>id!==s.student_id))}/>
                    {s.full_name} <span style={{color:AD.muted}}>({s.email})</span>
                  </label>
                ))}
              </div></F>
            <button type="submit" disabled={aLoading||!aSuiteId||!aTargets.length}
              style={{...mk.btn("primary",aLoading||!aSuiteId||!aTargets.length),width:"100%",padding:12}}>
              {aLoading?"Assigning…":`Assign to ${aTargets.length} student(s)`}
            </button>
          </form>
        </Modal>
      )}
      {modal==="reset"&&selected&&(
        <Modal title={`Reset Password — ${selected.full_name}`} onClose={()=>setModal(null)} width={420}>
          {created?<CredDisplay student={created} onDone={()=>{setCreated(null);setModal(null);}}/>:
            <div>
              <p style={{fontSize:13,color:AD.sub,lineHeight:1.7,marginBottom:20}}>Generates a new temporary password. Student must change it on next login.</p>
              <button onClick={handleReset} disabled={aLoading} style={{...mk.btn("danger",aLoading),width:"100%",padding:12}}>
                {aLoading?"Resetting…":"Generate New Password"}
              </button>
            </div>
          }
        </Modal>
      )}
      {modal==="credentials"&&created&&(
        <Modal title="Student Credentials" onClose={()=>{setCreated(null);setModal(null);}} width={440}>
          <CredDisplay student={created} onDone={()=>{setCreated(null);setModal(null);}}/>
        </Modal>
      )}
    </div>
  );
}

function CredDisplay({ student, onDone }) {
  const [copied,setCopied]=useState(false);
  const text=`LingvoConnect Student Portal\nName: ${student.full_name}\nEmail: ${student.email}\nUsername: ${student.username||""}\nPassword: ${student._plainPassword}\nStudent ID: ${student.student_id}`;
  const copy=()=>{navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});};
  return (
    <div>
      <div style={{padding:16,background:"#F0FDF4",borderRadius:12,border:"1px solid #BBF7D0",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:"#065F46",marginBottom:10}}>✓ Share these credentials:</div>
        {[["Name",student.full_name],["Email",student.email],["Username",student.username||"—"],
          ["Temp Password",student._plainPassword],["Student ID",student.student_id]].map(([l,v])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #BBF7D0",fontSize:13}}>
            <span style={{color:"#065F46",fontWeight:600}}>{l}:</span>
            <span style={{fontFamily:l.includes("Password")||l.includes("ID")?"monospace":"inherit",fontWeight:l.includes("Password")?800:500,color:"#064E3B"}}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#D97706",background:"#FEF3C7",padding:"8px 12px",borderRadius:8,marginBottom:14}}>
        <AlertCircle size={13}/>Student must change this password on first login.
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={copy} style={{...mk.btn("ghost"),flex:1,padding:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{copied?<><Check size={13}/>Copied!</>:<><Copy size={13}/>Copy</>}</button>
        <button onClick={onDone} style={{...mk.btn("primary"),flex:1,padding:10}}>Done</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: PENDING STUDENTS
// ══════════════════════════════════════════════════════════════════════════════
export function PendingStudentsManager() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState("");
  const [processing, setProcessing] = useState(null);

  const load = useCallback(async()=>{
    setLoading(true); setPending(await getPendingStudents()); setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const flash=m=>{setMsg(m);setTimeout(()=>setMsg(""),4000);};

  const handle=async(s,approve)=>{
    setProcessing(s.student_id);
    await (approve?approveStudent:rejectStudent)(s.student_id);
    flash(`✓ Account for ${s.full_name} ${approve?"approved and activated":"rejected"}.`);
    setProcessing(null); load();
  };

  const pendingRows=pending.filter(s=>s.status==="pending");
  const rejectedRows=pending.filter(s=>s.status==="rejected");

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:800,color:AD.text,margin:0}}>
          Pending Students
          {pendingRows.length>0&&<span style={{marginLeft:10,background:"#EF4444",color:"#fff",
            fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{pendingRows.length}</span>}
        </h2>
        {msg&&<span style={{fontSize:13,color:msg.startsWith("✓")?"#059669":"#DC2626"}}>{msg}</span>}
      </div>
      {loading?<div style={{textAlign:"center",padding:48,color:AD.muted}}>Loading…</div>:
        pendingRows.length===0&&rejectedRows.length===0?
        <div style={{...mk.card({padding:48,textAlign:"center"}),color:AD.muted}}>
          <div style={{width:56,height:56,borderRadius:16,background:"#D1FAE5",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><CheckCircle size={28} color="#10B981" strokeWidth={2}/></div>
          <div style={{fontWeight:700}}>No pending registrations</div>
          <div style={{fontSize:13,marginTop:8}}>All student accounts are up to date.</div>
        </div>:
        <>
          {pendingRows.length>0&&(
            <>
              <h3 style={{fontSize:13,fontWeight:700,color:AD.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>
                Pending Approval ({pendingRows.length})
              </h3>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
                {pendingRows.map(s=>(
                  <div key={s.id} style={{...mk.card({padding:"16px 20px",border:"1px solid #FEF3C7"}),
                    display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:AD.text}}>{s.full_name}</div>
                      <div style={{fontSize:12,color:AD.muted}}>{s.email}</div>
                      <div style={{fontSize:11,color:AD.muted,marginTop:4}}>
                        Registered {new Date(s.created_at).toLocaleDateString("en-GB")} · Username: {s.username}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>handle(s,false)} disabled={processing===s.student_id}
                        style={{...mk.btn("ghost"),padding:"8px 16px",fontSize:13}}>Reject</button>
                      <button onClick={()=>handle(s,true)} disabled={processing===s.student_id}
                        style={{...mk.btn("success",processing===s.student_id),padding:"8px 16px",fontSize:13}}>
                        {processing===s.student_id?"Processing…":"✓ Approve"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {rejectedRows.length>0&&(
            <>
              <h3 style={{fontSize:13,fontWeight:700,color:AD.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>
                Rejected ({rejectedRows.length})
              </h3>
              {rejectedRows.map(s=>(
                <div key={s.id} style={{...mk.card({padding:"12px 16px",marginBottom:8}),
                  display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <span style={{fontWeight:600,fontSize:13,color:AD.sub}}>{s.full_name}</span>
                    <span style={{fontSize:12,color:AD.muted,marginLeft:8}}>{s.email}</span>
                  </div>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <Badge status="rejected"/>
                    <button onClick={()=>handle(s,true)} style={{...mk.btn("ghost"),padding:"5px 12px",fontSize:12,color:"#059669"}}>Approve</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: STAFF MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════
const STAFF_TABS = [
  ["overview","Dashboard"],["students","Students"],["pending","Pending Students"],
  ["suites","Tests"],["assign","Assignments"],["settings","Settings"],
];

function StaffCredDisplay({ cred, onDone }) {
  const [copied, setCopied] = useState(false);
  const text = `LingvoConnect Admin Portal\nName: ${cred.displayName}\nUsername: ${cred.username}\nPassword: ${cred.plainPassword}\nRole: ${cred.role}`;
  const copy = () => { navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}); };
  return (
    <div>
      <div style={{padding:16,background:"#F0FDF4",borderRadius:12,border:"1px solid #BBF7D0",marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,color:"#065F46",marginBottom:10}}>Share these login credentials:</div>
        {[["Name",cred.displayName],["Username",cred.username],["Password",cred.plainPassword],["Role",cred.role]].map(([l,v])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #BBF7D0",fontSize:13}}>
            <span style={{color:"#065F46",fontWeight:600}}>{l}:</span>
            <span style={{fontFamily:l==="Password"||l==="Username"?"monospace":"inherit",fontWeight:l==="Password"?800:500,color:"#064E3B"}}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#D97706",background:"#FEF3C7",padding:"8px 12px",borderRadius:8,marginBottom:14}}>
        <AlertCircle size={13}/>Staff member should change this password after first login.
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={copy} style={{...mk.btn("ghost"),flex:1,padding:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{copied?<><Check size={13}/>Copied!</>:<><Copy size={13}/>Copy</>}</button>
        <button onClick={onDone} style={{...mk.btn("primary"),flex:1,padding:10}}>Done</button>
      </div>
    </div>
  );
}

export function StaffManager({ db, onSave }) {
  const adminUsers = db?.adminUsers||[];
  const staff = adminUsers;
  const [modal, setModal]     = useState(null);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg]         = useState("");
  const [createdCred, setCreatedCred] = useState(null);
  const [fName, setFName]     = useState("");
  const [fUser, setFUser]     = useState("");
  const [fPw, setFPw]         = useState("");
  const [fRole, setFRole]     = useState("staff");
  const [fAccess, setFAccess] = useState([]);

  const flash=m=>{setMsg(m);setTimeout(()=>setMsg(""),4000);};

  const openCreate=()=>{
    setFName("");setFUser("");setFPw(genTempPassword());setFRole("staff");
    setFAccess(["students","suites","assign"]);setEditing(null);setModal("form");
  };
  const openEdit=u=>{
    setFName(u.displayName||u.username||"");setFUser(u.username||"");setFPw("");
    setFRole(u.role||"staff");setFAccess(u.access||[]);
    setEditing(u);setModal("form");
  };

  const hashPw=async pw=>{
    const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(pw+"lv_admin_2024"));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
  };

  const handleSave=async e=>{
    e.preventDefault();
    if(!fUser.trim()){flash("⚠ Username is required.");return;}
    if(!editing&&!fPw.trim()){flash("⚠ Password is required.");return;}
    const hash=fPw?await hashPw(fPw):null;
    let updated;
    const accessForRole = (role, acc) => (role==="admin"||role==="superadmin") ? null : role==="teacher" ? null : acc;
    if(editing){
      updated=adminUsers.map(u=>u.id===editing.id?{
        ...u,displayName:fName||fUser,role:fRole,access:accessForRole(fRole,fAccess),
        ...(hash?{passwordHash:hash}:{}),
      }:u);
    } else {
      const newU={id:"u_"+Date.now().toString(36),username:fUser.toLowerCase().trim(),
        displayName:fName||fUser,passwordHash:hash,role:fRole,
        access:accessForRole(fRole,fAccess),active:true};
      updated=[...(adminUsers||[]),newU];
      setCreatedCred({username:newU.username,displayName:newU.displayName,role:newU.role,plainPassword:fPw});
    }
    onSave({adminUsers:updated});
    if(editing){ flash("✓ Staff account updated."); setModal(null); }
    else { setModal("credentials"); }
  };

  const setActive=(u,val)=>{
    const updated=adminUsers.map(a=>a.id===u.id?{...a,active:val}:a);
    onSave({adminUsers:updated});flash(`✓ Account ${val?"activated":"deactivated"}.`);
  };

  const toggleAccess=tab=>setFAccess(p=>p.includes(tab)?p.filter(t=>t!==tab):[...p,tab]);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h2 style={{fontSize:22,fontWeight:800,color:AD.text,margin:0}}>Staff Management</h2>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {msg&&<span style={{fontSize:13,color:msg.startsWith("✓")?"#059669":"#DC2626"}}>{msg}</span>}
          <button onClick={openCreate} style={mk.btn("primary")}>+ Add Staff</button>
        </div>
      </div>
      {staff.length===0?
        <div style={{...mk.card({padding:48,textAlign:"center"}),color:AD.muted}}>No staff accounts yet. Add your first staff member.</div>:
        <div style={{...mk.card(),overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:`2px solid ${AD.bg}`}}>
                {["Name","Username","Role","Access","Status","Actions"].map(h=>(
                  <th key={h} style={{padding:"14px 16px",fontSize:11,fontWeight:700,color:AD.muted,textTransform:"uppercase",letterSpacing:"0.06em",textAlign:"left"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((u)=>(
                <tr key={u.id} style={{borderBottom:`1px solid ${AD.bg}`}}
                  onMouseEnter={e=>e.currentTarget.style.background="#F8FAFC"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"14px 16px"}}>
                    <div style={{fontWeight:700,fontSize:14,color:"#151313"}}>{u.displayName||u.username}</div>
                  </td>
                  <td style={{padding:"14px 16px",fontSize:12,color:AD.muted,fontFamily:"monospace"}}>{u.username}</td>
                  <td style={{padding:"12px 16px"}}>
                    <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,
                      background:u.role==="superadmin"?"#EEF2FF":u.role==="admin"?"#DBEAFE":u.role==="teacher"?"#EDE9FE":"#F0FDF4",
                      color:u.role==="superadmin"?"#4338CA":u.role==="admin"?"#1D4ED8":u.role==="teacher"?"#6D28D9":"#059669"}}>{u.role||"staff"}</span>
                  </td>
                  <td style={{padding:"12px 16px",fontSize:12,color:AD.sub}}>
                    {(u.role==="admin"||u.role==="superadmin")?"All sections":u.role==="teacher"?"Results & feedback":u.access?.length?u.access.slice(0,3).join(", ")+(u.access.length>3?` +${u.access.length-3}`:""):"None"}
                  </td>
                  <td style={{padding:"12px 16px"}}>
                    <Badge status={u.active===false?"inactive":"active"}/>
                  </td>
                  <td style={{padding:"14px 16px"}}>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>openEdit(u)} style={{...mk.btn("ghost"),padding:"5px 14px",fontSize:12,borderRadius:20}}>Edit</button>
                      <button onClick={()=>setActive(u,u.active===false)}
                        style={{...mk.btn("ghost"),padding:"5px 14px",fontSize:12,borderRadius:20,outline:"none",
                          color:u.active===false?"#059669":"#DC2626",
                          border:`1.5px solid ${u.active===false?"#6EE7B7":"#FCA5A5"}`}}>
                        {u.active===false?"Activate":"Deactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
      {modal==="credentials"&&createdCred&&(
        <Modal title="Staff Account Created" onClose={()=>{setCreatedCred(null);setModal(null);}} width={440}>
          <StaffCredDisplay cred={createdCred} onDone={()=>{setCreatedCred(null);setModal(null);}}/>
        </Modal>
      )}
      {modal==="form"&&(
        <Modal title={editing?"Edit Staff Member":"Add Staff Member"} onClose={()=>setModal(null)} width={560}>
          <form onSubmit={handleSave}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              <div><label style={mk.label}>Display Name</label>
                <input style={mk.input()} value={fName} onChange={e=>setFName(e.target.value)} placeholder="Jane Smith"/></div>
              <div><label style={mk.label}>Username *</label>
                <input style={mk.input()} value={fUser} onChange={e=>setFUser(e.target.value)} placeholder="jane.smith"
                  readOnly={!!editing}/></div>
              <div><label style={mk.label}>{editing?"New Password (blank = keep)":"Password *"}</label>
                <input type="password" style={mk.input()} value={fPw} onChange={e=>setFPw(e.target.value)}
                  placeholder={editing?"Leave blank to keep":""}/></div>
              <div><label style={mk.label}>Role</label>
                <select style={mk.input()} value={fRole} onChange={e=>setFRole(e.target.value)}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher (results & feedback only)</option>
                  <option value="superadmin">Super Admin</option>
                </select></div>
            </div>
            {fRole==="staff"&&(
              <div style={{marginBottom:16}}>
                <label style={mk.label}>Dashboard Tabs Access</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,border:`1px solid ${AD.border}`,
                  borderRadius:10,padding:12,marginTop:4}}>
                  {STAFF_TABS.map(([tab,label])=>(
                    <label key={tab} style={{display:"flex",gap:8,alignItems:"center",cursor:"pointer",fontSize:13}}>
                      <input type="checkbox" checked={fAccess.includes(tab)}
                        onChange={()=>toggleAccess(tab)}/> {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {fRole==="teacher"&&<div style={{fontSize:12,color:"#6D28D9",marginBottom:16,padding:"8px 12px",background:"#EDE9FE",borderRadius:8,fontWeight:600}}>Teachers can view student results and add speaking/writing feedback only.</div>}
            {(fRole==="admin"||fRole==="superadmin")&&<div style={{fontSize:12,color:AD.muted,marginBottom:16,padding:"8px 12px",background:AD.bg,borderRadius:8}}>{fRole==="superadmin"?"Super Admins":"Admins"} have full access to all sections.</div>}
            <Msg text={msg}/>
            <button type="submit" style={{...mk.btn("primary"),width:"100%",padding:12}}>
              {editing?"Save Changes":"Create Staff Account"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN: DELETION REQUESTS
// ══════════════════════════════════════════════════════════════════════════════
export function DeletionRequestsManager({ adminName="admin" }) {
  const [requests,setRequests]=useState([]);
  const [loading,setLoading]=useState(true);
  const [msg,setMsg]=useState("");
  const [processing,setProcessing]=useState(null);

  const load=useCallback(async()=>{setLoading(true);setRequests(await getDeletionRequests());setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const flash=m=>{setMsg(m);setTimeout(()=>setMsg(""),4000);};

  const handle=async(req,approve)=>{
    setProcessing(req.id);
    await processDeletionRequest(req.id,approve,adminName,approve?req.student_id:null);
    flash(approve?`✓ Account for ${req.student_name} deleted.`:`✓ Request from ${req.student_name} rejected.`);
    setProcessing(null);load();
  };

  const pending=requests.filter(r=>r.status==="pending");
  const processed=requests.filter(r=>r.status!=="pending");

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <h2 style={{fontSize:22,fontWeight:800,color:AD.text,margin:0}}>
          Data Deletion Requests
          {pending.length>0&&<span style={{marginLeft:10,background:"#EF4444",color:"#fff",
            fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{pending.length}</span>}
        </h2>
        {msg&&<span style={{fontSize:13,color:msg.startsWith("✓")?"#059669":"#DC2626"}}>{msg}</span>}
      </div>
      {loading?<div style={{textAlign:"center",padding:48,color:AD.muted}}>Loading…</div>:
        requests.length===0?<div style={{...mk.card({padding:48,textAlign:"center"}),color:AD.muted}}>No deletion requests.</div>:
        <>
          {pending.length>0&&(
            <>
              <h3 style={{fontSize:13,fontWeight:700,color:AD.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Pending ({pending.length})</h3>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
                {pending.map(r=>(
                  <div key={r.id} style={{...mk.card({padding:"16px 20px",border:"1px solid #FECACA"}),
                    display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:AD.text}}>{r.student_name}</div>
                      <div style={{fontSize:12,color:AD.muted}}>{r.student_email} · {r.student_id}</div>
                      {r.reason&&<div style={{fontSize:12,color:AD.sub,marginTop:4,fontStyle:"italic"}}>"{r.reason}"</div>}
                      <div style={{fontSize:11,color:AD.muted,marginTop:4}}>Requested {new Date(r.requested_at).toLocaleDateString("en-GB")}</div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>handle(r,false)} disabled={processing===r.id} style={{...mk.btn("ghost"),padding:"8px 16px",fontSize:13}}>Reject</button>
                      <button onClick={()=>handle(r,true)} disabled={processing===r.id}
                        style={{...mk.btn("danger",processing===r.id),padding:"8px 16px",fontSize:13}}>
                        {processing===r.id?"Deleting…":"Approve & Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {processed.length>0&&(
            <>
              <h3 style={{fontSize:13,fontWeight:700,color:AD.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Processed ({processed.length})</h3>
              {processed.map(r=>(
                <div key={r.id} style={{...mk.card({padding:"12px 16px",marginBottom:8}),
                  display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <span style={{fontWeight:600,fontSize:13,color:AD.sub}}>{r.student_name}</span>
                    <span style={{fontSize:12,color:AD.muted,marginLeft:8}}>{r.student_email}</span>
                  </div>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <Badge status={r.status}/>
                    <span style={{fontSize:11,color:AD.muted}}>{r.processed_at?new Date(r.processed_at).toLocaleDateString("en-GB"):""}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      }
    </div>
  );
}
