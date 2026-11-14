/**
 * IELTS Test Engine — standalone route component.
 *
 * Receives initialization data from sessionStorage (written by handleStudentStartTest
 * in App.jsx for the student portal flow). Falls back to the guest Registration flow
 * (step 0) when no init data is present.
 *
 * Phase 5 of the platform restructure.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { isStudentLoggedIn } from "../../lib/studentAuth.js";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { CLight as C }         from "../../lib/constants.js";
import {
  loadDB, notifyDbChange, supabase, DB_KEY, genId,
} from "../../lib/db.js";
import {
  listeningBand, readingBand, overallBand,
} from "../../lib/utils.js";
import { autoSaveAssignment, updateAssignment } from "../../lib/studentDb.js";
import {
  isIOS, enterFullscreen, exitFullscreen, resolveTestSuite,
} from "../../lib/testEngine.js";
import {
  STEPS, MaintenanceScreen,
  StepNav, BreakScreen, Registration, TestLobby,
  ListeningTest, ReadingTest, WritingTest,
  SpeakingExam, SpeakingBooking,
  ResultsLoading, Results,
} from "../../App.jsx";

const MAINTENANCE_MODE = false; // keep in sync with App.jsx

// ── SESSION STORAGE KEY ───────────────────────────────────────────────────────
const INIT_KEY = "ielts_test_init";
const RESUME_KEY = "ielts_test_resume";
const RESUME_TTL = 3 * 60 * 60 * 1000; // 3 hours

export default function TestPage() {
  const navigate = useNavigate();

  // Read init data from sessionStorage once (lazy initializer — runs only on mount)
  // Falls back to localStorage backup so a page reload mid-exam doesn't kick the student out.
  const [initData] = useState(() => {
    try {
      const raw = sessionStorage.getItem(INIT_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        sessionStorage.removeItem(INIT_KEY);
        // Save a backup to localStorage so a page reload can recover
        try { localStorage.setItem(RESUME_KEY, JSON.stringify({ ...data, _savedAt: Date.now() })); } catch {}
        return data;
      }
    } catch {}
    // Fallback: check localStorage backup (page reload recovery)
    try {
      const backup = JSON.parse(localStorage.getItem(RESUME_KEY) || "null");
      if (backup && backup._savedAt && Date.now() - backup._savedAt < RESUME_TTL) {
        // Resume from the lobby (step 1) so they can restart without being kicked to student portal
        return { ...backup, initialStep: Math.min(backup.initialStep ?? 1, 1) };
      }
    } catch {}
    return null;
  });

  // ── TEST ENGINE STATE ──────────────────────────────────────────────────────
  const [step, setStep]                     = useState(initData?.initialStep ?? 0);
  const [candidate, setCand]                = useState(initData?.candidateInfo ?? null);
  const [activeSuite, setActiveSuite]       = useState(initData?.resolvedSuite ?? null);
  const [activeAssignmentId]                = useState(initData?.assignmentId ?? null);
  const [scores, setScores]                 = useState({});
  const [booking, setBooking]               = useState(null);
  const [exitConfirm, setExitConfirm]       = useState(false);
  const [exitReason, setExitReason]         = useState("manual");
  const [breakNext, setBreakNext]           = useState(null);
  const [speakingExamDone, setSpeakingExamDone] = useState(false);
  const [speakingBand, setSpeakingBand]     = useState(null);
  const [offline, setOffline]               = useState(!navigator.onLine);

  const sessionIdRef       = useRef(initData?.sessionId ?? null);
  const scoresRef          = useRef({});
  const activeSuiteRef     = useRef(initData?.resolvedSuite ?? null);
  const programmaticExitRef = useRef(false);

  // ── NETWORK MONITOR ───────────────────────────────────────────────────────
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // ── BACK-BUTTON GUARD (active exam = steps 2–5) ───────────────────────────
  useEffect(() => {
    if (step >= 2 && step <= 5) window.history.pushState(null, "");
  }, [step]);

  useEffect(() => {
    const handler = () => {
      setStep(cur => {
        if (cur >= 2 && cur <= 5) {
          window.history.pushState(null, "");
          setExitReason("manual");
          setExitConfirm(true);
        }
        return cur;
      });
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // ── ENTER FULLSCREEN on mount when coming from student portal (step >= 2) ──
  useEffect(() => {
    if (initData && (initData.initialStep ?? 0) >= 2) enterFullscreen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── RIGHT-CLICK + DEVTOOLS BLOCK during exam ──────────────────────────────
  useEffect(() => {
    const examOn = () => { let active = false; setStep(s => { active = s >= 2 && s <= 5; return s; }); return active; };
    const noCtx = e => { if (examOn()) e.preventDefault(); };
    const noKey = e => {
      if (!examOn()) return;
      if (e.key === "F12" ||
          (e.ctrlKey && e.shiftKey && ["I","J","C","i","j","c"].includes(e.key)) ||
          (e.ctrlKey && ["u","U"].includes(e.key))) {
        e.preventDefault();
      }
    };
    document.addEventListener("contextmenu", noCtx);
    document.addEventListener("keydown", noKey);
    return () => { document.removeEventListener("contextmenu", noCtx); document.removeEventListener("keydown", noKey); };
  }, []);

  // ── EXIT FULLSCREEN when results are shown ────────────────────────────────
  useEffect(() => {
    if (step === 7) {
      programmaticExitRef.current = true;
      exitFullscreen();
      try { localStorage.removeItem(RESUME_KEY); } catch {}
    }
  }, [step]);

  // ── DETECT manual fullscreen exit during active exam ─────────────────────
  useEffect(() => {
    if (isIOS) return;
    const handler = () => {
      if (document.fullscreenElement) return;
      if (programmaticExitRef.current) { programmaticExitRef.current = false; return; }
      setStep(s => {
        if (s >= 2 && s <= 5) { setExitReason("fullscreen"); setExitConfirm(true); }
        return s;
      });
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);

  // ── HANDLERS ──────────────────────────────────────────────────────────────

  // Auto-save partial results after each module
  const autoSave = async (updatedScores) => {
    if (!candidate) return;
    scoresRef.current = updatedScores;
    if (!sessionIdRef.current) sessionIdRef.current = genId("IELTS");
    const L = updatedScores.listening || null;
    const R = updatedScores.reading   || null;
    const W = updatedScores.writing   || null;
    const bands = [
      L ? listeningBand(L.correct, L.total) : null,
      R ? readingBand(R.correct, R.total)   : null,
      W?.band ?? null,
    ].filter(b => b != null);
    const partial = {
      id: sessionIdRef.current,
      candidate, status: "in_progress",
      date: new Date().toLocaleDateString("en-GB"),
      timestamp: Date.now(),
      suiteId: activeSuiteRef.current?.id || null,
      ...(L ? { listeningScore: `${L.correct}/${L.total}`, listeningBand: listeningBand(L.correct, L.total), listeningAnswers: L.answers, allListeningQuestions: L.allQuestions || [] } : {}),
      ...(R ? { readingScore:   `${R.correct}/${R.total}`, readingBand:   readingBand(R.correct, R.total),   readingAnswers:   R.answers, allReadingQuestions:   R.allQuestions || [] } : {}),
      ...(W ? { writingBand: W.band, writingTexts: W.texts, writingFeedback: W.aiFeedback, writingAiDetection: W.aiDetection } : {}),
      overall: bands.length ? overallBand(bands) : null,
    };
    const curDb = loadDB();
    curDb.participants = [partial, ...(curDb.participants || []).filter(p => p.id !== partial.id)];
    try { localStorage.setItem(DB_KEY, JSON.stringify(curDb)); } catch {}
    notifyDbChange();
    if (supabase) {
      try {
        const email = (candidate.email || "").toLowerCase().trim();
        const rowId = partial.id + "-" + Date.now().toString(36);
        const { error } = await supabase.from("participants").insert({ id: rowId, email, type: "attempt", data: partial });
        if (error) console.warn("[autoSave] Supabase insert failed:", error.message);
      } catch (e) { console.warn("[autoSave] Supabase error:", e); }
    }
    if (activeAssignmentId) {
      autoSaveAssignment(activeAssignmentId, {
        listening: updatedScores.listening ? { correct: updatedScores.listening.correct, total: updatedScores.listening.total } : null,
        reading:   updatedScores.reading   ? { correct: updatedScores.reading.correct,   total: updatedScores.reading.total   } : null,
        writing:   updatedScores.writing   ? { band: updatedScores.writing.band } : null,
        savedAt: new Date().toISOString(),
      }).catch(e => console.warn("[autoSave] assignment save:", e));
    }
  };

  // Guest registration complete → move to lobby
  const handleRegComplete = (info) => {
    const regId = genId("REG");
    const regRecord = {
      id: regId, candidate: info, status: "registered",
      registeredAt: new Date().toISOString(),
      timestamp: Date.now(),
      date: new Date().toLocaleDateString("en-GB"),
    };
    const liveDb = loadDB();
    liveDb.participants = [regRecord, ...(liveDb.participants || [])];
    try { localStorage.setItem(DB_KEY, JSON.stringify(liveDb)); } catch {}
    notifyDbChange();
    setCand(info);
    setStep(1);
    const saveToCloud = async () => {
      const email = (info?.email || "").toLowerCase().trim();
      if (supabase) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
            const rowId = regId + "-" + Date.now().toString(36);
            const { error } = await supabase.from("participants").insert({ id: rowId, email, type: "registration", data: regRecord });
            if (!error) { console.log("[Reg] row saved on attempt", attempt + 1); break; }
            console.warn(`[Reg] row insert attempt ${attempt + 1} failed:`, error.message);
          } catch (e) { console.warn(`[Reg] row insert attempt ${attempt + 1} error:`, e); }
        }
        const { _flushConfig } = await import("../../lib/db.js");
        _flushConfig({ ...loadDB(), _lastRegTs: Date.now() });
      }
    };
    saveToCloud();
  };

  // Lobby "Begin Test" → enter fullscreen, resolve suite
  const handleStartTest = () => {
    sessionIdRef.current = genId("IELTS");
    scoresRef.current = {};
    setScores({});
    const suite = resolveTestSuite(candidate.email);
    setActiveSuite(suite);
    activeSuiteRef.current = suite;
    enterFullscreen();
    const mod = suite?.singleModule;
    if (mod === "reading")                          setStep(3);
    else if (mod === "writing1" || mod === "writing2") setStep(4);
    else                                             setStep(2);
  };

  // Exit exam → mark interrupted, clear state, navigate back
  const handleExitExam = () => {
    programmaticExitRef.current = true;
    exitFullscreen();
    setExitConfirm(false);
    try { localStorage.removeItem(RESUME_KEY); } catch {}
    if (activeAssignmentId) {
      updateAssignment(activeAssignmentId, { status: "interrupted" }).catch(() => {});
    }
    navigate(activeAssignmentId ? "/student" : "/");
  };

  // ── MAINTENANCE ────────────────────────────────────────────────────────────
  if (MAINTENANCE_MODE) return <MaintenanceScreen />;

  // If a logged-in student lands here without init data, send them to their portal
  if (!initData && isStudentLoggedIn()) return <Navigate to="/student" replace />;

  // ── RENDER ────────────────────────────────────────────────────────────────
  const examActive = step >= 2 && step <= 5;

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* Offline banner */}
      {offline && (
        <div role="alert" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999, background: "#B45309",
          color: "#fff", textAlign: "center", padding: "10px", fontSize: 13, fontWeight: 700 }}>
          <span aria-hidden="true">⚠️</span> No internet connection — your answers are saved locally and will sync when reconnected.
        </div>
      )}

      {/* Exit confirmation modal */}
      {exitConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.85)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(6px)" }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 36, maxWidth: 440, width: "100%",
            textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,.5)", animation: "fadeUp .2s ease both" }}>
            {exitReason === "fullscreen" ? (
              <>
                <div style={{ fontSize: 52, marginBottom: 12 }}>🚫</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: C.s900, marginBottom: 10, letterSpacing: "-0.02em" }}>
                  Test Interrupted
                </h2>
                <p style={{ fontSize: 14, color: C.s600, lineHeight: 1.7, marginBottom: 24 }}>
                  You exited full-screen mode.<br />
                  <strong style={{ color: C.rose }}>The exam must be taken in full-screen.</strong><br />
                  Return to full-screen to continue, or exit the exam.
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: C.s900, marginBottom: 10, letterSpacing: "-0.02em" }}>
                  Exit Exam?
                </h2>
                <p style={{ fontSize: 14, color: C.s600, lineHeight: 1.7, marginBottom: 28 }}>
                  Are you sure you want to close the exam?<br />
                  <strong style={{ color: C.rose }}>Your progress will be lost</strong> and you will return to the home screen.
                </p>
              </>
            )}
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" onClick={() => { setExitConfirm(false); if (exitReason === "fullscreen") enterFullscreen(); }} style={{
                flex: 1, padding: "13px", borderRadius: 12, border: `2px solid ${C.s200}`,
                background: "#fff", color: C.s800, fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>
                {exitReason === "fullscreen" ? "↩ Return to Full-Screen" : "← Continue Exam"}
              </button>
              <button type="button" onClick={handleExitExam} style={{
                flex: 1, padding: "13px", borderRadius: 12, border: "none",
                background: C.rose, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer",
              }}>
                Yes, Exit Exam
              </button>
            </div>
          </div>
        </div>
      )}

      <main id="main-content">
        <StepNav step={step} steps={STEPS} />

        {step === 0 && <Registration onNext={handleRegComplete} />}
        {step === 1 && candidate && <TestLobby candidate={candidate} onStart={handleStartTest} />}

        {breakNext && (
          <BreakScreen nextSection={breakNext.label} onContinue={() => { setStep(breakNext.step); setBreakNext(null); }} />
        )}

        {!breakNext && step === 2 && (
          <ListeningTest
            testData={activeSuite?.listeningData}
            candidateInfo={candidate}
            onExit={() => { setExitReason("manual"); setExitConfirm(true); }}
            onComplete={r => {
              const ns = { ...scoresRef.current, listening: r };
              setScores(ns); autoSave(ns);
              activeSuite?.singleModule ? setStep(7) : setBreakNext({ label: "Reading Test", step: 3 });
            }}
          />
        )}

        {!breakNext && step === 3 && (
          <ReadingTest
            testData={activeSuite?.readingData}
            candidateInfo={candidate}
            onExit={() => { setExitReason("manual"); setExitConfirm(true); }}
            onAutoSave={r => { const ns = { ...scoresRef.current, reading: r }; setScores(ns); autoSave(ns); }}
            onComplete={r => {
              const ns = { ...scoresRef.current, reading: r };
              setScores(ns); autoSave(ns);
              activeSuite?.singleModule ? setStep(7) : setBreakNext({ label: "Writing Test", step: 4 });
            }}
          />
        )}

        {!breakNext && step === 4 && (
          <WritingTest
            testData={activeSuite?.writingData}
            candidateInfo={candidate}
            onExit={() => { setExitReason("manual"); setExitConfirm(true); }}
            onComplete={w => {
              const ns = { ...scoresRef.current, writing: w };
              setScores(ns); autoSave(ns);
              activeSuite?.singleModule ? setStep(6) : setStep(5);
            }}
          />
        )}

        {!breakNext && step === 5 && !speakingExamDone && (() => {
          const aiSpeakingOn = !!(loadDB().aiSpeakingEnabled);
          if (!aiSpeakingOn) { setTimeout(() => { setSpeakingExamDone(true); setStep(6); }, 0); return null; }
          return (
            <SpeakingExam
              candidateInfo={candidate}
              onComplete={r => { setSpeakingBand(r.speakingBand); setSpeakingExamDone(true); setStep(6); }}
              onSkip={() => { setSpeakingExamDone(true); setStep(6); }}
            />
          );
        })()}

        {step === 6 && (
          <ResultsLoading
            writingTexts={scoresRef.current.writing?.texts}
            writingTaskData={scoresRef.current.writing?.taskData || activeSuite?.writingData}
            onComplete={async aiResult => {
              const ns = { ...scoresRef.current, writing: { ...(scoresRef.current.writing || {}), band: aiResult.band, aiFeedback: aiResult.aiFeedback, aiDetection: aiResult.aiDetection } };
              scoresRef.current = ns;
              setScores(ns);
              await autoSave(ns);
              setStep(7);
            }}
          />
        )}

        {step === 7 && (
          <Results
            scores={{
              listening: scoresRef.current.listening || null,
              reading:   scoresRef.current.reading   || null,
              writing:   scoresRef.current.writing   || null,
            }}
            speakingBand={speakingBand ?? null}
            candidateInfo={candidate || { name: "Candidate", email: "" }}
            booking={booking}
            suiteName={activeSuite?.name}
            suiteId={activeSuite?.id}
            sessionId={sessionIdRef.current}
            activeAssignmentId={activeAssignmentId}
          />
        )}
      </main>

      <SpeedInsights />
    </div>
  );
}
