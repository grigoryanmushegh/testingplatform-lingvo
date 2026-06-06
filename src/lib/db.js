import { createClient } from "@supabase/supabase-js";

// ── SUPABASE + STORAGE ────────────────────────────────────────────────────────
export const _SURL = import.meta.env.VITE_SUPABASE_URL  || "https://ymbncyrgrgtkejeuxmfb.supabase.co";
export const _SKEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYm5jeXJncmd0a2VqZXV4bWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDA1NDksImV4cCI6MjA4OTQ3NjU0OX0.vCwQBV-WJ2yHJIHLWZcbt37odQnKu5P3JiATk8oHc3g";
export const supabase = _SURL && _SKEY ? createClient(_SURL, _SKEY) : null;

export const DB_KEY   = "lv_ielts_v2";
export const _emptyDB = () => ({participants:[],bookings:[],tests:[],testSuites:[],assignments:[],speakingSlots:[]});
export let   _db      = _emptyDB();
export let   _flushTmr = null;

// ── Config store (suites, assignments, slots, AND tests) ──────────────────────
// Tests are in BOTH the blob (reliable) AND individual rows (concurrent-safe).
// Belt-and-suspenders: blob is the authoritative source, rows are cross-device safety net.
export const _flushConfig = async db => {
  if(!supabase) return false;
  // IMPORTANT: tests MUST be included here — omitting them wipes tests on every suite/slot save
  const cfg = {tests:db.tests||[],testSuites:db.testSuites||[],assignments:db.assignments||[],speakingSlots:db.speakingSlots||[],bookings:db.bookings||[],scoreOverrides:db.scoreOverrides||{},listeningAudioUrl:db.listeningAudioUrl||"",openaiKey:db.openaiKey||""};
  for(let attempt=0; attempt<3; attempt++){
    try {
      if(attempt>0) await new Promise(r=>setTimeout(r,1000*attempt));
      const {error} = await supabase.from("ielts_store").upsert({id:"main",data:cfg,updated_at:new Date().toISOString()});
      if(error){
        console.warn(`[DB] config write error (attempt ${attempt+1}):`,error.message);
        if(attempt===2) return false;
        continue;
      }
      return true;
    } catch(e){
      console.warn(`[DB] config write failed (attempt ${attempt+1}):`,e);
      if(attempt===2) return false;
    }
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

// dbPush for participants → individual row insert (concurrent-safe)
export const dbPush    = (col,item) => { _db[col]=[item,...(_db[col]||[])]; saveDB(_db); };
export const dbPushNow = async (col,item) => {
  _db[col]=[item,...(_db[col]||[])];
  try{localStorage.setItem(DB_KEY,JSON.stringify(_db));}catch{}
  if(col==="participants") { await _insertParticipant(item); }
  else { await _flushNow(_db); }
};
export const dbSave    = (col,items) => { _db[col]=items; saveDB(_db); };
export const dbSaveNow = async (col,items) => { _db[col]=items; return await saveDBNow(_db); };

// ── Smart merge: combine Supabase + localStorage for non-test config ───────────
function _smartMerge(supabaseBase, local) {
  const MERGE_COLS = ["testSuites", "assignments", "speakingSlots", "bookings"];
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
// Fetches config + all participant/test rows in one pass, with a hard timeout.
async function _fetchFromSupabase(timeoutMs=8000) {
  const withTimeout = promise => Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error("Supabase fetch timeout")),timeoutMs))
  ]);
  const [cfgResult, rowsResult] = await Promise.allSettled([
    withTimeout(supabase.from("ielts_store").select("data").eq("id","main").single()),
    withTimeout(supabase.from("participants").select("id,email,type,data").order("id",{ascending:false})),
  ]);
  const cfg     = cfgResult.status==="fulfilled"   ? cfgResult.value.data   : null;
  const cfgErr  = cfgResult.status==="fulfilled"   ? cfgResult.value.error  : {message:"timeout",code:"TIMEOUT"};
  const allRows = rowsResult.status==="fulfilled"  ? rowsResult.value.data  : null;
  const rowsErr = rowsResult.status==="fulfilled"  ? rowsResult.value.error : {message:"timeout"};
  if(rowsErr) console.warn("[DB] participants query error:",rowsErr.message);
  return { cfg, cfgErr, allRows, rowsErr };
}

function _processRows(allRows, fallbackPts) {
  // allRows === null means the query FAILED (timeout, RLS, network) → use fallback
  // allRows === [] means query succeeded but table is empty → also use fallback (no data to show)
  const rows    = allRows || [];
  const tstRows = rows.filter(r => r.type === "test_item" || r.type === "test_del");
  // Treat any non-test row as a participant (backward compat for rows with unexpected/null type)
  const ptRows  = rows.filter(r => r.type !== "test_item" && r.type !== "test_del" && r.data?.id);
  // Use Supabase pt rows if we got any; otherwise fall back to cached/localStorage data
  const pts     = ptRows.length > 0 ? ptRows.map(r => r.data).filter(Boolean) : (fallbackPts||[]);
  const rowTests = _buildTestsFromRows(tstRows);
  console.log(`[DB] processRows: ${ptRows.length} pt rows, ${tstRows.length} test rows (fallback pts=${fallbackPts?.length||0})`);
  return { pts, rowTests };
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

      // Best fallback for participants: memory first, then localStorage
      const cachedPts = _db.participants?.length > 0 ? _db.participants : (local.participants||[]);
      const { pts, rowTests } = _processRows(allRows, cachedPts);

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

      // Tests: blob is authoritative (always included in _flushConfig now),
      // row-based tests are secondary source for concurrent safety.
      // Merge: rowTests take priority (newest save), blobTests fill in any gaps.
      const blobTests  = base.tests || local.tests || [];
      const { tests: mergedTests, blobOnly } = _mergeTests(rowTests, blobTests);
      finalBase.tests  = mergedTests;

      // Deduplicate participants & apply score overrides
      const seen = new Set();
      const deduped = pts.filter(p=>{ const k=p.id||p.email; if(seen.has(k)) return false; seen.add(k); return true; });
      const overrides = finalBase.scoreOverrides||{};
      const withOverrides = deduped.map(p=> overrides[p.id] ? {...p,...overrides[p.id]} : p);

      _db = {..._emptyDB(), ...finalBase, participants: withOverrides};
      try{ localStorage.setItem(DB_KEY,JSON.stringify(_db)); }catch{}
      console.log(`[DB] reloadDB ✓ tests=${_db.tests?.length||0} (rows=${rowTests.length} blob=${blobTests.length} legacy=${blobOnly.length}), participants=${_db.participants?.length||0}`);

      if(needsPush){
        console.warn("[DB] reloadDB: pushing merged config to Supabase...");
        _flushConfig(_db); // fire-and-forget, don't block reload
      }
      // Migrate legacy blob tests to rows in background — never block the caller
      if(blobOnly.length > 0) _migrateBlobTests(blobOnly);
      return;
    }catch(e){ console.warn("[DB] reloadDB error:",e); }
  }
  try{ const saved=JSON.parse(localStorage.getItem(DB_KEY)||"null"); if(saved) _db=saved; }catch{}
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

        // Participants fallback: use localStorage if Supabase returned nothing
        const cachedPts = local.participants||[];
        const { pts, rowTests } = _processRows(allRows, cachedPts);

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

        // Tests: blob is authoritative (now always saved in _flushConfig),
        // row-based tests fill in any that aren't in the blob yet.
        const blobTests = base.tests || local.tests || [];
        const { tests: mergedTests, blobOnly } = _mergeTests(rowTests, blobTests);
        finalBase.tests = mergedTests;

        const seen = new Set();
        const deduped = pts.filter(p=>{ const k=p.id||p.email; if(seen.has(k)) return false; seen.add(k); return true; });
        const overrides = finalBase.scoreOverrides||{};
        const withOverrides = deduped.map(p=> overrides[p.id] ? {...p,...overrides[p.id]} : p);

        _db = {..._emptyDB(), ...finalBase, participants: withOverrides};
        try{ localStorage.setItem(DB_KEY,JSON.stringify(_db)); }catch{}
        console.log(`[DB] initDB ✓ tests=${_db.tests?.length||0} (rows=${rowTests.length} blob=${blobTests.length} legacy=${blobOnly.length}), participants=${_db.participants?.length||0}, suites=${_db.testSuites?.length||0}`);

        if(needsPush){
          console.warn("[DB] initDB: pushing merged config to Supabase...");
          _flushConfig(_db); // fire-and-forget — don't block app startup
        }
        // Migrate legacy blob tests to rows in background — never block app startup
        if(blobOnly.length > 0) _migrateBlobTests(blobOnly);
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
