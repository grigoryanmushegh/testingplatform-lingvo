import { createClient } from "@supabase/supabase-js";

// ── SUPABASE + STORAGE ────────────────────────────────────────────────────────
export const _SURL = import.meta.env.VITE_SUPABASE_URL  || "https://gwnlssnufqmdiksjdxhu.supabase.co";
export const _SKEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3bmxzc251ZnFtZGlrc2pkeGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NzYwMzcsImV4cCI6MjA5NjM1MjAzN30.HO_yAMJUrfCMZGhlvIdgMv7eryt1MbY1mHQwP0g-H-g";
export const supabase = _SURL && _SKEY ? createClient(_SURL, _SKEY) : null;

export const DB_KEY   = "lv_ielts_v2";
export const _emptyDB = () => ({
  participants:[], bookings:[], tests:[], testSuites:[], assignments:[],
  speakingSlots:[], adminUsers:[], scoreOverrides:{}, listeningAudioUrl:"", openaiKey:""
});
export let   _db      = _emptyDB();
export let   _flushTmr = null;

// ── Admin auth helpers ─────────────────────────────────────────────────────────
export async function hashPassword(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw + "lv_salt_2025"));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
export function getAdminSession() {
  try { return JSON.parse(sessionStorage.getItem("lv_admin_sess")||"null"); } catch { return null; }
}
export function setAdminSession(s) {
  if(s) sessionStorage.setItem("lv_admin_sess", JSON.stringify(s));
  else   sessionStorage.removeItem("lv_admin_sess");
}

// ── Config store (suites, assignments, slots, AND tests) ──────────────────────
// Tests are in BOTH the blob (reliable) AND individual rows (concurrent-safe).
// Belt-and-suspenders: blob is the authoritative source, rows are cross-device safety net.
export const _flushConfig = async db => {
  if(!supabase) return false;
  // Participants are NOT stored in the blob — they live exclusively in the
  // participants table (individual rows, inserted by _insertParticipant /
  // handleRegComplete / autoSave). Keeping them here made the blob grow into
  // hundreds of KB with 500+ candidates, causing frequent write timeouts.
  const cfg = {
    tests: db.tests||[],
    testSuites: db.testSuites||[], assignments: db.assignments||[],
    speakingSlots: db.speakingSlots||[], bookings: db.bookings||[],
    scoreOverrides: db.scoreOverrides||{}, adminUsers: db.adminUsers||[],
    listeningAudioUrl: db.listeningAudioUrl||"", openaiKey: db.openaiKey||""
  };
  for(let attempt=0; attempt<3; attempt++){
    try {
      if(attempt>0) await new Promise(r=>setTimeout(r,800*attempt));
      // Hard 5s timeout per attempt — never hangs indefinitely
      const {error} = await Promise.race([
        supabase.from("ielts_store").upsert({id:"main",data:cfg,updated_at:new Date().toISOString()}),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error("write timeout")),5000))
      ]);
      if(error){ console.warn(`[DB] flush error (attempt ${attempt+1}):`,error.message); if(attempt===2) return false; continue; }
      return true;
    } catch(e){ console.warn(`[DB] flush failed (attempt ${attempt+1}):`,e.message); if(attempt===2) return false; }
  }
  return false;
};
export const _flush    = db => { clearTimeout(_flushTmr); _flushTmr = setTimeout(()=>_flushConfig(db),300); };
export const _flushNow = db => _flushConfig(db);

// ── Test rows — one Supabase row per test, concurrent-safe ───────────────────
// Stored in participants table (type="test_item" | "test_del") — no extra table needed.
// Multiple devices can save simultaneously without overwriting each other.
export const _upsertTestRow = async test => {
  if(!supabase) return false;
  try {
    const rowId = test.id + "-" + Date.now().toString(36);
    const {error} = await supabase.from("participants").insert({
      id: rowId, email: "__tests__", type: "test_item", data: test
    });
    if(error){ console.warn("[DB] test row insert error:",error.message); return false; }
    return true;
  } catch(e){ console.warn("[DB] test row insert failed:",e); return false; }
};

export const _markTestDeleted = async testId => {
  if(!supabase) return false;
  try {
    const rowId = "DEL-" + testId + "-" + Date.now().toString(36);
    const {error} = await supabase.from("participants").insert({
      id: rowId, email: "__tests__", type: "test_del", data: {id: testId, deletedAt: new Date().toISOString()}
    });
    if(error){ console.warn("[DB] test del row error:",error.message); return false; }
    return true;
  } catch(e){ console.warn("[DB] test del row failed:",e); return false; }
};

// Build final tests list from row data (rows ordered newest-first)
function _buildTestsFromRows(rows) {
  const testRows = rows.filter(r => r.type === "test_item");
  const delIds   = new Set(rows.filter(r => r.type === "test_del").map(r => r.data?.id).filter(Boolean));
  const seen     = new Set();
  const tests    = [];
  for(const row of testRows) {
    const id = row.data?.id;
    if(!id || seen.has(id) || delIds.has(id)) continue;
    seen.add(id);
    tests.push(row.data);
  }
  return tests;
}

// ── Participants table — one row per student, no concurrent conflicts ──────────
export const _insertParticipant = async item => {
  if(!supabase) return false;
  const email = ((item.candidate?.email||item.email)||"").toLowerCase().trim();
  const type  = item.listeningBand!=null ? "attempt" : "registration";
  for(let attempt=0; attempt<3; attempt++){
    try {
      if(attempt>0) await new Promise(r=>setTimeout(r,1000*attempt));
      const rowId = item.id + "-" + Date.now().toString(36);
      const {error} = await supabase.from("participants").insert({id:rowId, email, type, data:item});
      if(error){
        console.warn(`[DB] participant insert error (attempt ${attempt+1}):`,error.message);
        if(attempt===2) return false;
        continue;
      }
      return true;
    } catch(e){
      console.warn(`[DB] participant insert failed (attempt ${attempt+1}):`,e);
      if(attempt===2) return false;
    }
  }
  return false;
};

// Load only participant rows (not test rows) — used by admin dashboard
export const _loadParticipants = async () => {
  if(!supabase) return null;
  try {
    const {data,error} = await supabase.from("participants")
      .select("data").in("type",["attempt","registration"])
      .order("created_at",{ascending:false});
    if(error||!data) return null;
    return data.map(r=>r.data);
  } catch{ return null; }
};

export const loadDB      = () => _db;
export const setInternalDb = newDb => { _db = newDb; };
export const saveDB    = db => { _db=db; try{localStorage.setItem(DB_KEY,JSON.stringify(db));}catch{} _flush(db); };
export const saveDBNow = async db => { _db=db; try{localStorage.setItem(DB_KEY,JSON.stringify(db));}catch{} return await _flushNow(db); };

// dbPush for participants → blob (reliable) + individual row (concurrent-safe belt+suspenders)
export const dbPush    = (col,item) => { _db[col]=[item,...(_db[col]||[])]; saveDB(_db); };
export const dbPushNow = async (col,item) => {
  _db[col]=[item,...(_db[col]||[])];
  try{localStorage.setItem(DB_KEY,JSON.stringify(_db));}catch{}
  if(col==="participants") {
    // Participants: fire-and-forget Supabase saves — never block the caller
    _flushNow(_db).catch(e=>console.warn("[DB] dbPushNow blob flush error:",e));
    _insertParticipant(item).catch(e=>console.warn("[DB] dbPushNow row insert error:",e));
  } else {
    // For non-participant data (suites, assignments, etc.) await the blob flush
    await _flushNow(_db);
  }
};
export const dbSave    = (col,items) => { _db[col]=items; saveDB(_db); };
export const dbSaveNow = async (col,items) => { _db[col]=items; return await saveDBNow(_db); };

// ── Smart merge: combine Supabase + localStorage for non-test config ───────────
function _smartMerge(supabaseBase, local) {
  const MERGE_COLS = ["testSuites", "assignments", "speakingSlots", "bookings", "adminUsers"];
  let needsPush = false;
  const merged = { ...supabaseBase };

  for (const col of MERGE_COLS) {
    const remote    = supabaseBase[col] || [];
    const localItems = local[col] || [];
    const remoteIds  = new Set(remote.map(x => x.id).filter(Boolean));
    const localOnly  = localItems.filter(x => x.id && !remoteIds.has(x.id));
    if(localOnly.length > 0){
      console.warn(`[DB] smartMerge: found ${localOnly.length} local-only ${col} — merging up`);
      needsPush = true;
    }
    merged[col] = [...remote, ...localOnly];
  }

  const remoteOverrides = supabaseBase.scoreOverrides || {};
  const localOverrides  = local.scoreOverrides || {};
  const mergedOverrides = { ...localOverrides, ...remoteOverrides };
  if(Object.keys(mergedOverrides).length !== Object.keys(remoteOverrides).length) needsPush = true;
  merged.scoreOverrides = mergedOverrides;

  for(const k of ["listeningAudioUrl", "openaiKey"]){
    merged[k] = supabaseBase[k] || local[k] || "";
  }

  return { merged, needsPush };
}

// ── Shared load helper ─────────────────────────────────────────────────────────
// Fetches config blob + recent participant rows. Test rows (test_item/test_del)
// are intentionally excluded from the participants query — they are large and
// tests are authoritative in the blob. Participant rows are capped at 1000
// (ordered newest-first) so the query stays fast even with hundreds of entries.
async function _fetchFromSupabase(timeoutMs=12000) {
  const withTimeout = promise => Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error("Supabase fetch timeout")),timeoutMs))
  ]);
  const [cfgResult, rowsResult] = await Promise.allSettled([
    withTimeout(supabase.from("ielts_store").select("data").eq("id","main").single()),
    withTimeout(
      supabase.from("participants")
        .select("id,email,type,data")
        .not("type","in","(test_item,test_del)")
        .limit(1000)
    ),
  ]);
  const cfg     = cfgResult.status==="fulfilled"   ? cfgResult.value.data   : null;
  const cfgErr  = cfgResult.status==="fulfilled"   ? cfgResult.value.error  : {message:"timeout",code:"TIMEOUT"};
  const allRows = rowsResult.status==="fulfilled"  ? rowsResult.value.data  : null;
  const rowsErr = rowsResult.status==="fulfilled"  ? rowsResult.value.error : {message:"timeout"};
  if(rowsErr) console.warn("[DB] participants query error:",rowsErr.message);
  return { cfg, cfgErr, allRows, rowsErr };
}

function _processRows(allRows) {
  const rows   = allRows || [];
  const ptRows = rows.filter(r => r.data?.id);
  const pts    = ptRows.map(r => r.data).filter(Boolean);
  console.log(`[DB] processRows: ${ptRows.length} participant rows from table`);
  // rowTests always empty — tests come from blob exclusively now
  return { pts, rowTests: [] };
}

// Merge row-based tests with legacy blob tests (backward compat: existing tests in blob before migration)
// Also returns blobOnly list so callers can auto-migrate those tests to individual rows.
function _mergeTests(rowTests, blobTests) {
  const rowIds   = new Set(rowTests.map(t => t.id));
  const blobOnly = (blobTests||[]).filter(t => t.id && !rowIds.has(t.id));
  return { tests: [...rowTests, ...blobOnly], blobOnly };
}

// Auto-migrate legacy blob tests to individual rows (fire-and-forget)
async function _migrateBlobTests(blobOnly) {
  if(!blobOnly.length) return;
  console.log(`[DB] Migrating ${blobOnly.length} legacy blob tests to individual rows...`);
  const results = await Promise.allSettled(blobOnly.map(t => _upsertTestRow(t)));
  const ok = results.filter(r=>r.status==="fulfilled"&&r.value===true).length;
  console.log(`[DB] Migration done: ${ok}/${blobOnly.length} tests moved to rows`);
}

// ── Force re-fetch from Supabase ───────────────────────────────────────────────
export async function reloadDB() {
  if(supabase){
    try{
      const { cfg, cfgErr, allRows, rowsErr } = await _fetchFromSupabase();
      const base = cfg?.data || {};

      let local = {};
      try { local = JSON.parse(localStorage.getItem(DB_KEY)||"{}"); } catch {}

      // Merge config (suites, assignments, etc.) — smart merge with localStorage
      const hasSupabaseConfig = (base.testSuites?.length||0) > 0 || (base.assignments?.length||0) > 0
                              || (base.speakingSlots?.length||0) > 0;
      let finalBase, needsPush;
      if(!hasSupabaseConfig && ((local.testSuites?.length||0)>0||(local.assignments?.length||0)>0)){
        finalBase = { ...local, scoreOverrides: base.scoreOverrides||{} };
        needsPush = true;
        console.warn("[DB] reloadDB: Supabase config empty — restored from localStorage");
      } else {
        ({ merged: finalBase, needsPush } = _smartMerge(base, local));
      }

      // Tests: blob is authoritative. Also preserve in-memory tests not yet confirmed in Supabase.
      const blobTests = base.tests || [];
      const memTests  = _db.tests || local.tests || [];
      const blobIds   = new Set(blobTests.map(t => t.id));
      const localOnlyTests = memTests.filter(t => t.id && !blobIds.has(t.id));
      finalBase.tests = [...blobTests, ...localOnlyTests];

      // adminUsers: preserve in-memory entries not yet confirmed in Supabase/localStorage.
      const mergedAdminIds = new Set((finalBase.adminUsers||[]).map(u=>u.id).filter(Boolean));
      const memAdminOnly = (_db.adminUsers||[]).filter(u=>u.id && !mergedAdminIds.has(u.id));
      if(memAdminOnly.length > 0) finalBase.adminUsers = [...(finalBase.adminUsers||[]), ...memAdminOnly];

      // Participants: table rows (pts) are the cross-device source of truth.
      // Also merge legacy blob participants and cached memory so nothing is lost.
      const { pts }   = _processRows(allRows);
      const blobPts   = base.participants || []; // legacy fallback (old blobs had participants)
      const cachedPts = _db.participants?.length > 0 ? _db.participants : (local.participants||[]);
      const allPts    = [...pts, ...blobPts, ...cachedPts];

      // Deduplicate & apply score overrides
      const seen = new Set();
      const deduped = allPts.filter(p=>{ const k=p.id; if(!k||seen.has(k)) return false; seen.add(k); return true; });
      const overrides = finalBase.scoreOverrides||{};
      const withOverrides = deduped.map(p=> overrides[p.id] ? {...p,...overrides[p.id]} : p);

      _db = {..._emptyDB(), ...finalBase, participants: withOverrides};
      try{ localStorage.setItem(DB_KEY,JSON.stringify(_db)); }catch{}
      console.log(`[DB] reloadDB ✓ tests=${_db.tests?.length||0} (blob=${blobTests.length}), participants=${_db.participants?.length||0} (table=${pts.length})`);

      if(needsPush){
        console.warn("[DB] reloadDB: pushing merged config to Supabase...");
        _flushConfig(_db);
      }
      _notifyChange(); // tell all subscribed components to re-render
      return;
    }catch(e){ console.warn("[DB] reloadDB error:",e); }
  }
  try{ const saved=JSON.parse(localStorage.getItem(DB_KEY)||"null"); if(saved) _db=saved; }catch{}
}

// Load localStorage synchronously — instant, no network. Returns true if cached data existed.
export function quickInit() {
  try {
    const saved = JSON.parse(localStorage.getItem(DB_KEY)||"null");
    if(saved && Object.keys(saved).length > 0) {
      _db = {..._emptyDB(), ...saved};
      console.log(`[DB] quickInit: localStorage loaded (tests=${_db.tests?.length||0}, participants=${_db.participants?.length||0})`);
      return true; // cache hit — app can render immediately
    }
  } catch(e) { console.warn("[DB] quickInit error:",e); }
  return false; // no cache — caller should wait for initDB() before rendering
}

export async function initDB() {
  // Pre-load localStorage so we always have something to show
  let local = {};
  try { local = JSON.parse(localStorage.getItem(DB_KEY)||"null") || {}; } catch {}
  if(local && Object.keys(local).length > 0) {
    _db = {..._emptyDB(), ...local};
    console.log(`[DB] initDB: pre-loaded localStorage (tests=${_db.tests?.length||0}, participants=${_db.participants?.length||0})`);
  }

  if(supabase){
    for(let attempt=0; attempt<2; attempt++){
      try{
        if(attempt>0) await new Promise(r=>setTimeout(r,1200));
        const { cfg, cfgErr, allRows, rowsErr } = await _fetchFromSupabase(10000);
        console.log(`[DB] initDB attempt ${attempt+1}: cfg=${cfg?.data?"ok":"empty"} cfgErr=${cfgErr?.message||"none"} rows=${allRows?.length??'null'} rowsErr=${rowsErr?.message||"none"}`);

        // PGRST116 = no rows found (config not yet created) — that's OK, continue
        if(cfgErr && cfgErr.code !== "PGRST116"){
          console.warn("[DB] initDB: config fetch error, attempt",attempt+1,":",cfgErr.message);
          if(attempt===0) continue;
          break;
        }

        const base = cfg?.data || {};

        const hasSupabaseConfig = (base.testSuites?.length||0)>0 || (base.assignments?.length||0)>0
                                || (base.speakingSlots?.length||0)>0;
        let finalBase, needsPush;
        if(hasSupabaseConfig){
          ({ merged: finalBase, needsPush } = _smartMerge(base, local));
        } else if((local.testSuites?.length||0)>0||(local.assignments?.length||0)>0){
          finalBase = { ...local, scoreOverrides: base.scoreOverrides||{} };
          needsPush = true;
          console.warn("[DB] initDB: Supabase config empty, restoring from localStorage");
        } else {
          finalBase = {...base};
          needsPush = false;
        }

        // Tests: blob is authoritative. Also preserve any tests saved locally during fetch.
        const blobTests = base.tests || [];
        let freshLS = {};
        try { freshLS = JSON.parse(localStorage.getItem(DB_KEY)||"null") || {}; } catch {}
        const freshLocalTests = freshLS.tests || local.tests || [];
        const blobIds = new Set(blobTests.map(t => t.id));
        const localOnlyTests = freshLocalTests.filter(t => t.id && !blobIds.has(t.id));
        if(localOnlyTests.length > 0)
          console.log(`[DB] initDB: preserving ${localOnlyTests.length} local-only tests saved during network fetch`);
        finalBase.tests = [...blobTests, ...localOnlyTests];

        // Participants: table rows are the cross-device source, blob/cache fill gaps.
        const { pts }   = _processRows(allRows);
        const blobPts   = base.participants || []; // legacy fallback
        const cachedPts = local.participants || [];
        const freshPts  = freshLS.participants || [];
        const allPts    = [...pts, ...blobPts, ...cachedPts, ...freshPts];

        const seen = new Set();
        const deduped = allPts.filter(p=>{ const k=p.id; if(!k||seen.has(k)) return false; seen.add(k); return true; });
        const overrides = finalBase.scoreOverrides||{};
        const withOverrides = deduped.map(p=> overrides[p.id] ? {...p,...overrides[p.id]} : p);

        _db = {..._emptyDB(), ...finalBase, participants: withOverrides};
        try{ localStorage.setItem(DB_KEY,JSON.stringify(_db)); }catch{}
        console.log(`[DB] initDB ✓ tests=${_db.tests?.length||0} (blob=${blobTests.length}), participants=${_db.participants?.length||0} (table=${pts.length}), suites=${_db.testSuites?.length||0}`);

        if(needsPush){
          console.warn("[DB] initDB: pushing merged config to Supabase...");
          _flushConfig(_db);
        }
        _notifyChange(); // update all subscribed components with fresh data
        return;
      }catch(e){
        console.warn(`[DB] initDB attempt ${attempt+1} error:`,e);
        if(attempt===0) continue;
      }
    }
    console.warn("[DB] initDB: Supabase unreachable, using localStorage data");
    // _db already pre-loaded from localStorage above
  }
  // If no supabase, _db is already set from localStorage pre-load above
}

export const genId = p => `${p}-${Date.now().toString(36).toUpperCase()}`;

// ── Change notification + Supabase Realtime ───────────────────────────────────
// Components subscribe via onDbChange(cb) to get instant updates when _db
// changes due to a remote write (Realtime push) or a completed poll (reloadDB).
// This replaces per-component ad-hoc setFoo(loadDB().foo) patterns.

const _changeListeners = new Set();
let   _realtimeChannel = null;

// Called internally after every remote sync (reloadDB, initDB, Realtime push).
// Also exported so local writes (registration, etc.) can push instantly to all listeners.
function _notifyChange() {
  _changeListeners.forEach(cb => {
    try { cb(_db); } catch(e) { console.warn("[DB] listener error:", e); }
  });
}
export const notifyDbChange = () => _notifyChange();

// Subscribe to remote DB changes.  Returns an unsubscribe function.
// Lazily initialises the Supabase Realtime channel on first call.
export function onDbChange(cb) {
  _changeListeners.add(cb);

  // Lazy-init: create the Realtime channel once, reuse for all listeners.
  if (!_realtimeChannel && supabase) {
    _realtimeChannel = supabase
      .channel("ielts-store-sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ielts_store", filter: "id=eq.main" },
        payload => {
          const incoming = payload.new?.data;
          if (!incoming) return;
          console.log("[DB] ⚡ Realtime push — merging remote changes");

          // Merge incoming blob with current _db, preserving local-only items.
          const remoteTests = incoming.tests || [];
          const remoteIds   = new Set(remoteTests.map(t => t.id));
          const localOnly   = (_db.tests || []).filter(t => t.id && !remoteIds.has(t.id));

          const rPts   = incoming.participants || [];
          const rPtIds = new Set(rPts.map(p => p.id));
          const lPts   = (_db.participants || []).filter(p => p.id && !rPtIds.has(p.id));

          _db = {
            ..._db,
            ...incoming,
            tests:        [...remoteTests, ...localOnly],
            participants: [...rPts, ...lPts],
          };
          try { localStorage.setItem(DB_KEY, JSON.stringify(_db)); } catch {}
          _notifyChange();
        }
      )
      .subscribe(status => {
        if (status === "SUBSCRIBED")
          console.log("[DB] ✓ Realtime: live sync active on ielts_store");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          console.warn("[DB] Realtime: not available (polling-only mode). Status:", status);
        else
          console.log("[DB] Realtime status:", status);
      });
  }

  return () => _changeListeners.delete(cb);
}
