import { createClient } from "@supabase/supabase-js";

// ── SUPABASE + STORAGE ────────────────────────────────────────────────────────
// Anon key is safe to expose (public read/write only, no admin privileges)
export const _SURL = import.meta.env.VITE_SUPABASE_URL  || "https://ymbncyrgrgtkejeuxmfb.supabase.co";
export const _SKEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYm5jeXJncmd0a2VqZXV4bWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDA1NDksImV4cCI6MjA4OTQ3NjU0OX0.vCwQBV-WJ2yHJIHLWZcbt37odQnKu5P3JiATk8oHc3g";
export const supabase = _SURL && _SKEY ? createClient(_SURL, _SKEY) : null;

export const DB_KEY   = "lv_ielts_v2";
export const _emptyDB = () => ({participants:[],bookings:[],tests:[],testSuites:[],assignments:[],speakingSlots:[]});
export let   _db      = _emptyDB();
export let   _flushTmr = null;

// ── Config store (admin data: tests, suites, assignments, slots) ──────────────
export const _flushConfig = async db => {
  if(!supabase) return false;
  try {
    // Config only — no participants (kept in participants table separately for performance)
    const cfg = {tests:db.tests||[],testSuites:db.testSuites||[],assignments:db.assignments||[],speakingSlots:db.speakingSlots||[],bookings:db.bookings||[],scoreOverrides:db.scoreOverrides||{},listeningAudioUrl:db.listeningAudioUrl||""};
    const {error} = await supabase.from("ielts_store").upsert({id:"main",data:cfg,updated_at:new Date().toISOString()});
    if(error){ console.warn("[DB] config write error:",error.message); return false; }
    return true;
  } catch(e){ console.warn("[DB] config write failed:",e); return false; }
};
export const _flush    = db => { clearTimeout(_flushTmr); _flushTmr = setTimeout(()=>_flushConfig(db),300); };
export const _flushNow = db => _flushConfig(db);

// ── Participants table — one row per student, no concurrent conflicts ──────────
export const _insertParticipant = async item => {
  if(!supabase) return false;
  try {
    const email = ((item.candidate?.email||item.email)||"").toLowerCase().trim();
    const type  = item.listeningBand!=null ? "attempt" : "registration";
    // Always INSERT a fresh row — RLS blocks UPDATE on existing rows with anon key.
    // data.id holds the session ID for deduplication in reloadDB; the Supabase PK is separate.
    const rowId = item.id + "-" + Date.now().toString(36);
    const {error} = await supabase.from("participants").insert({id:rowId, email, type, data:item});
    if(error){ console.warn("[DB] participant insert error:",error.message); return false; }
    return true;
  } catch(e){ console.warn("[DB] participant upsert failed:",e); return false; }
};
export const _loadParticipants = async () => {
  if(!supabase) return null;
  try {
    const {data,error} = await supabase.from("participants").select("data").order("created_at",{ascending:false});
    if(error||!data) return null;
    return data.map(r=>r.data);
  } catch{ return null; }
};

export const loadDB      = () => _db;
// setInternalDb: direct mutation for admin bulk-update operations (does not flush to remote)
export const setInternalDb = newDb => { _db = newDb; };
export const saveDB  = db => { _db=db; try{localStorage.setItem(DB_KEY,JSON.stringify(db));}catch{} _flush(db); };
export const saveDBNow = async db => { _db=db; try{localStorage.setItem(DB_KEY,JSON.stringify(db));}catch{} await _flushNow(db); };

// dbPush for participants → individual row insert (concurrent-safe)
// dbPush for anything else → full config upsert
export const dbPush    = (col,item) => { _db[col]=[item,...(_db[col]||[])]; saveDB(_db); };
export const dbPushNow = async (col,item) => {
  _db[col]=[item,...(_db[col]||[])];
  try{localStorage.setItem(DB_KEY,JSON.stringify(_db));}catch{}
  if(col==="participants") { await _insertParticipant(item); }
  else { await _flushNow(_db); }
};
export const dbSave    = (col,items) => { _db[col]=items; saveDB(_db); };
export const dbSaveNow = async (col,items) => { _db[col]=items; await saveDBNow(_db); };

// Force re-fetch from Supabase
export async function reloadDB() {
  if(supabase){
    try{
      const [{data:cfg},{data:ptsRows,error:ptsErr}] = await Promise.all([
        supabase.from("ielts_store").select("data").eq("id","main").single(),
        supabase.from("participants").select("data").order("created_at",{ascending:false}),
      ]);
      const base = cfg?.data || {};
      const pts  = (!ptsErr && ptsRows) ? ptsRows.map(r=>r.data) : (_db.participants||[]);
      // deduplicate by id
      const seen = new Set();
      const deduped = pts.filter(p=>{ const k=p.id||p.email; if(seen.has(k)) return false; seen.add(k); return true; });
      // Apply scoreOverrides
      const overrides = base.scoreOverrides||{};
      const withOverrides = deduped.map(p=> overrides[p.id] ? {...p,...overrides[p.id]} : p);
      _db = {..._emptyDB(), ...base, participants: withOverrides};
      localStorage.setItem(DB_KEY,JSON.stringify(_db));
      return;
    }catch(e){ console.warn("[DB] reloadDB error:",e); }
  }
  try{ _db=JSON.parse(localStorage.getItem(DB_KEY))||_emptyDB(); }catch{ _db=_emptyDB(); }
}

export async function initDB() {
  if(supabase){
    try{
      const [{data:cfg},{data:ptsRows}] = await Promise.all([
        supabase.from("ielts_store").select("data").eq("id","main").single(),
        supabase.from("participants").select("data").order("created_at",{ascending:false}),
      ]);
      const base = cfg?.data || {};
      const pts  = ptsRows ? ptsRows.map(r=>r.data) : [];
      if(cfg?.data || pts.length){
        const seen = new Set();
        const deduped = pts.filter(p=>{ const k=p.id||p.email; if(seen.has(k)) return false; seen.add(k); return true; });
        const overrides = base.scoreOverrides||{};
        const withOverrides = deduped.map(p=> overrides[p.id] ? {...p,...overrides[p.id]} : p);
        _db = {..._emptyDB(), ...base, participants: withOverrides};
        localStorage.setItem(DB_KEY,JSON.stringify(_db));
        return;
      }
      // First run — seed from localStorage
      try{ _db=JSON.parse(localStorage.getItem(DB_KEY))||_emptyDB(); }catch{ _db=_emptyDB(); }
      await _flushConfig(_db);
    }catch{
      try{ _db=JSON.parse(localStorage.getItem(DB_KEY))||_emptyDB(); }catch{ _db=_emptyDB(); }
    }
  } else {
    try{ _db=JSON.parse(localStorage.getItem(DB_KEY))||_emptyDB(); }catch{ _db=_emptyDB(); }
  }
}

export const genId   = p => `${p}-${Date.now().toString(36).toUpperCase()}`;
