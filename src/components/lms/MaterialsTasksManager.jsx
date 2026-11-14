import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, ClipboardList, Plus, Trash2, Edit2, Save, Loader,
  Link, FileText, ExternalLink, Calendar, Star, ChevronDown, ChevronUp, Check
} from "lucide-react";
import {
  getGroups, getMaterials, createMaterial, deleteMaterial,
  getTasks, createTask, updateTask, deleteTask,
  getTaskSubmissions, gradeSubmission,
} from "../../lib/lmsDb.js";
import { getAllStudents } from "../../lib/studentDb.js";

function card(e={})  { return { background:"#FCFCFC", borderRadius:12, border:`1px solid ${"#E2E6EA"}`, ...e }; }
function btn(v="primary", e={}) {
  const b = { display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer",border:"none" };
  if(v==="primary") return {...b,background:"#2D5DDC",color:"#fff",...e};
  if(v==="ghost")   return {...b,background:"transparent",color:"#151313",border:`1px solid ${"#E2E6EA"}`,...e};
  if(v==="danger")  return {...b,background:"#FEE2E2",color:"#EF4444",border:`1px solid ${"#EF4444"}30`,...e};
  return {...b,...e};
}
const lbl = { display:"block",fontSize:12,fontWeight:700,color:"#151313",marginBottom:4,marginTop:12 };
const inp = { display:"block",width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:8,border:`1px solid ${"#E2E6EA"}`,fontSize:13,color:"#151313",background:"#EEEFF1",outline:"none",fontFamily:"inherit" };

const MATERIAL_TYPES = {
  text: { icon: FileText, label: "Text / Note",  color: "#2D5DDC"  },
  link: { icon: Link,     label: "Link / URL",   color: "#2D5DDC" },
};

// ── Main export ───────────────────────────────────────────────────────────────
export default function MaterialsTasksManager() {
  const [groups, setGroups]           = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [tab, setTab]                 = useState("materials"); // materials | tasks
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    getGroups().then(g => {
      const active = g.filter(x => x.status === "active");
      setGroups(active);
      if (active.length) setSelectedGroup(active[0]);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:80}}>
      <Loader size={28} color={"#2D5DDC"} style={{animation:"spin 1s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{padding:"24px 0",fontFamily:"'Montserrat',sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{marginBottom:20}}>
        <h2 style={{margin:0,fontSize:22,fontWeight:800,color:"#151313"}}>Materials & Tasks</h2>
        <p style={{margin:"4px 0 0",color:"#94A3B8",fontSize:13}}>Share learning materials and assign homework to groups</p>
      </div>

      {/* Tab toggle */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <button style={btn(tab==="materials"?"primary":"ghost")} onClick={()=>setTab("materials")}>
          <BookOpen size={15}/> Materials
        </button>
        <button style={btn(tab==="tasks"?"primary":"ghost")} onClick={()=>setTab("tasks")}>
          <ClipboardList size={15}/> Tasks / Homework
        </button>
      </div>

      {/* Group selector */}
      {groups.length > 1 && (
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {groups.map(g=>(
            <button key={g.id} style={{
              padding:"5px 14px",borderRadius:20,fontWeight:600,fontSize:12,cursor:"pointer",
              border:`2px solid ${selectedGroup?.id===g.id?(g.color||"#2D5DDC"):"#E2E6EA"}`,
              background:selectedGroup?.id===g.id?`${g.color||"#2D5DDC"}15`:"transparent",
              color:selectedGroup?.id===g.id?(g.color||"#2D5DDC"):"#64748B",
            }} onClick={()=>setSelectedGroup(g)}>{g.name}</button>
          ))}
        </div>
      )}

      {groups.length === 0 && (
        <div style={{...card({padding:48,textAlign:"center"})}}>
          <BookOpen size={40} color={"#94A3B8"} style={{marginBottom:12}}/>
          <div style={{color:"#94A3B8",fontSize:14}}>No active groups. Create groups first in LMS Groups tab.</div>
        </div>
      )}

      {selectedGroup && tab === "materials" && (
        <MaterialsPanel group={selectedGroup}/>
      )}
      {selectedGroup && tab === "tasks" && (
        <TasksPanel group={selectedGroup}/>
      )}
    </div>
  );
}

// ── Materials panel ───────────────────────────────────────────────────────────
function MaterialsPanel({ group }) {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ title:"", type:"text", content:"" });
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const m = await getMaterials(group.id);
    setItems(m); setLoading(false);
  }, [group.id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await createMaterial({ ...form, group_id: group.id });
      setForm({ title:"", type:"text", content:"" });
      setShowForm(false); load();
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this material?")) return;
    await deleteMaterial(id); load();
  };

  if (loading) return <Loader size={20} color={"#2D5DDC"} style={{display:"block",margin:"32px auto",animation:"spin 1s linear infinite"}}/>;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <button style={btn("primary")} onClick={()=>setShowForm(v=>!v)}>
          <Plus size={15}/> Add Material
        </button>
      </div>

      {showForm && (
        <div style={{...card({padding:"18px 20px",marginBottom:16})}}>
          <div style={{fontWeight:700,fontSize:14,color:"#151313",marginBottom:12}}>New Material</div>

          <label style={lbl}>Title</label>
          <input style={inp} placeholder="e.g. Unit 5 Grammar Notes" value={form.title}
            onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>

          <label style={lbl}>Type</label>
          <select style={{...inp,marginBottom:0}} value={form.type}
            onChange={e=>setForm(f=>({...f,type:e.target.value,content:""}))}>
            <option value="text">Text / Note</option>
            <option value="link">Link / URL</option>
          </select>

          <label style={lbl}>{form.type==="link"?"URL":"Content"}</label>
          {form.type==="link"
            ? <input style={inp} placeholder="https://…" value={form.content}
                onChange={e=>setForm(f=>({...f,content:e.target.value}))}/>
            : <textarea style={{...inp,height:100,resize:"vertical"}} placeholder="Write notes, instructions…"
                value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))}/>
          }

          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
            <button style={btn("ghost")} onClick={()=>setShowForm(false)}>Cancel</button>
            <button style={btn("primary")} onClick={save} disabled={saving||!form.title.trim()}>
              {saving?<Loader size={14} style={{animation:"spin 1s linear infinite"}}/>:<Save size={14}/>}
              {saving?"Saving…":"Save"}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !showForm && (
        <div style={{...card({padding:40,textAlign:"center"})}}>
          <BookOpen size={36} color={"#94A3B8"} style={{marginBottom:10}}/>
          <div style={{color:"#94A3B8",fontSize:13}}>No materials yet for {group.name}</div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {items.map(m => {
          const Conf = MATERIAL_TYPES[m.type] || MATERIAL_TYPES.text;
          const Icon = Conf.icon;
          return (
            <div key={m.id} style={{...card({padding:"14px 18px"}),display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start",minWidth:0}}>
                <div style={{width:36,height:36,borderRadius:8,background:`${Conf.color}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Icon size={16} color={Conf.color}/>
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#151313"}}>{m.title}</div>
                  <div style={{fontSize:11,color:"#94A3B8",marginBottom:4}}>{Conf.label} · {fmtDate(m.created_at)}</div>
                  {m.type==="link"
                    ? <a href={m.content} target="_blank" rel="noreferrer"
                        style={{fontSize:12,color:"#2D5DDC",display:"inline-flex",alignItems:"center",gap:4}}>
                        <ExternalLink size={11}/> {m.content}
                      </a>
                    : m.content && <div style={{fontSize:12,color:"#64748B",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{m.content}</div>
                  }
                </div>
              </div>
              <button style={btn("danger",{padding:"6px 8px",flexShrink:0})} onClick={()=>remove(m.id)}>
                <Trash2 size={13}/>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tasks panel ───────────────────────────────────────────────────────────────
function TasksPanel({ group }) {
  const [tasks, setTasks]     = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null); // task id showing submissions
  const [submissions, setSubmissions] = useState({}); // taskId -> []
  const [form, setForm]       = useState({ title:"", description:"", due_date:"", max_score:100 });
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, allS] = await Promise.all([getTasks(group.id), getAllStudents()]);
    setTasks(t);
    setStudents(allS||[]);
    setLoading(false);
  }, [group.id]);

  useEffect(() => { load(); }, [load]);

  const loadSubs = async (taskId) => {
    if (submissions[taskId]) { setExpanded(expanded===taskId?null:taskId); return; }
    const subs = await getTaskSubmissions(taskId);
    setSubmissions(s=>({...s,[taskId]:subs}));
    setExpanded(taskId);
  };

  const saveTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await createTask({ ...form, group_id: group.id, max_score: +form.max_score||100 });
      setForm({ title:"", description:"", due_date:"", max_score:100 });
      setShowForm(false); load();
    } finally { setSaving(false); }
  };

  const removeTask = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    await deleteTask(id); load();
  };

  const grade = async (taskId, studentId, score, feedback) => {
    await gradeSubmission(taskId, studentId, score, feedback);
    const subs = await getTaskSubmissions(taskId);
    setSubmissions(s=>({...s,[taskId]:subs}));
  };

  const sMap = Object.fromEntries(students.map(s=>[s.student_id,s]));

  if (loading) return <Loader size={20} color={"#2D5DDC"} style={{display:"block",margin:"32px auto",animation:"spin 1s linear infinite"}}/>;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <button style={btn("primary")} onClick={()=>setShowForm(v=>!v)}>
          <Plus size={15}/> Add Task
        </button>
      </div>

      {showForm && (
        <div style={{...card({padding:"18px 20px",marginBottom:16})}}>
          <div style={{fontWeight:700,fontSize:14,color:"#151313",marginBottom:12}}>New Task / Homework</div>

          <label style={lbl}>Title *</label>
          <input style={inp} placeholder="e.g. IELTS Writing Task 2 — Essay" value={form.title}
            onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>

          <label style={lbl}>Description</label>
          <textarea style={{...inp,height:80,resize:"vertical"}} placeholder="Instructions, requirements…"
            value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={lbl}>Due Date</label>
              <input style={inp} type="date" value={form.due_date}
                onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/>
            </div>
            <div>
              <label style={lbl}>Max Score</label>
              <input style={inp} type="number" min={1} max={1000} value={form.max_score}
                onChange={e=>setForm(f=>({...f,max_score:e.target.value}))}/>
            </div>
          </div>

          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
            <button style={btn("ghost")} onClick={()=>setShowForm(false)}>Cancel</button>
            <button style={btn("primary")} onClick={saveTask} disabled={saving||!form.title.trim()}>
              {saving?<Loader size={14} style={{animation:"spin 1s linear infinite"}}/>:<Save size={14}/>}
              {saving?"Saving…":"Save Task"}
            </button>
          </div>
        </div>
      )}

      {tasks.length === 0 && !showForm && (
        <div style={{...card({padding:40,textAlign:"center"})}}>
          <ClipboardList size={36} color={"#94A3B8"} style={{marginBottom:10}}/>
          <div style={{color:"#94A3B8",fontSize:13}}>No tasks yet for {group.name}</div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {tasks.map(t => {
          const isExpanded = expanded === t.id;
          const subs = submissions[t.id] || [];
          const overdue = t.due_date && new Date(t.due_date) < new Date();
          return (
            <div key={t.id} style={card({padding:0,overflow:"hidden"})}>
              <div style={{padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:13,color:"#151313"}}>{t.title}</span>
                    {overdue && <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20,background:"#FEE2E2",color:"#EF4444"}}>Overdue</span>}
                  </div>
                  {t.description && <div style={{fontSize:12,color:"#64748B",marginBottom:4,lineHeight:1.5}}>{t.description}</div>}
                  <div style={{display:"flex",gap:12,fontSize:11,color:"#94A3B8",flexWrap:"wrap"}}>
                    {t.due_date && <span style={{display:"flex",alignItems:"center",gap:3}}><Calendar size={11}/>{t.due_date}</span>}
                    <span style={{display:"flex",alignItems:"center",gap:3}}><Star size={11}/>Max: {t.max_score}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button style={btn("ghost",{fontSize:12,padding:"5px 10px"})} onClick={()=>loadSubs(t.id)}>
                    {isExpanded?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
                    Submissions
                  </button>
                  <button style={btn("danger",{padding:"6px 8px"})} onClick={()=>removeTask(t.id)}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div style={{borderTop:`1px solid ${"#E2E6EA"}`,background:"#EEEFF1",padding:"14px 18px"}}>
                  {subs.length === 0 && <div style={{color:"#94A3B8",fontSize:12}}>No submissions yet.</div>}
                  {subs.map(sub => {
                    const st = sMap[sub.student_id];
                    return (
                      <SubmissionRow key={sub.id} sub={sub} student={st} maxScore={t.max_score}
                        onGrade={(score,feedback)=>grade(t.id,sub.student_id,score,feedback)}/>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Submission row with inline grading ────────────────────────────────────────
function SubmissionRow({ sub, student, maxScore, onGrade }) {
  const [editing, setEditing] = useState(false);
  const [score, setScore]     = useState(sub.score ?? "");
  const [feedback, setFeedback] = useState(sub.feedback || "");
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    setSaving(true);
    try { await onGrade(score===""?null:+score, feedback); setEditing(false); }
    finally { setSaving(false); }
  };

  return (
    <div style={{borderBottom:`1px solid ${"#E2E6EA"}`,paddingBottom:12,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{fontWeight:600,fontSize:13,color:"#151313"}}>{student?.full_name||sub.student_id}</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {sub.score!=null && (
            <span style={{fontWeight:800,fontSize:13,color:"#2D5DDC"}}>{sub.score}/{maxScore}</span>
          )}
          <button style={btn("ghost",{fontSize:11,padding:"4px 8px"})} onClick={()=>setEditing(v=>!v)}>
            <Edit2 size={11}/> {editing?"Cancel":"Grade"}
          </button>
        </div>
      </div>
      {sub.content && <div style={{fontSize:12,color:"#64748B",lineHeight:1.5,marginBottom:6,whiteSpace:"pre-wrap"}}>{sub.content}</div>}
      {editing && (
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div>
            <label style={{...lbl,marginTop:4}}>Score</label>
            <input style={{...inp,width:80}} type="number" min={0} max={maxScore} placeholder={`0–${maxScore}`}
              value={score} onChange={e=>setScore(e.target.value)}/>
          </div>
          <div style={{flex:1,minWidth:160}}>
            <label style={{...lbl,marginTop:4}}>Feedback</label>
            <input style={inp} placeholder="Write feedback…" value={feedback}
              onChange={e=>setFeedback(e.target.value)}/>
          </div>
          <button style={btn("primary",{padding:"9px 14px"})} onClick={save} disabled={saving}>
            {saving?<Loader size={13} style={{animation:"spin 1s linear infinite"}}/>:<Check size={13}/>}
            {saving?"…":"Save"}
          </button>
        </div>
      )}
      {sub.feedback && !editing && <div style={{fontSize:11,color:"#94A3B8",fontStyle:"italic"}}>{sub.feedback}</div>}
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}
