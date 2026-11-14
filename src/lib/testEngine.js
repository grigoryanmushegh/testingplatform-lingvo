/**
 * Pure utility functions for the IELTS test engine.
 * Extracted from App.jsx in Phase 5 so TestPage.jsx and App.jsx can both import them.
 */
import { loadDB, dbSaveNow, notifyDbChange } from "./db.js";

export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const enterFullscreen = () => {
  if (isIOS) return;
  const el = document.documentElement;
  (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen)?.call(el).catch(() => {});
};

export const exitFullscreen = () => {
  if (isIOS) return;
  (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen)?.call(document).catch(() => {});
};

// Build a test suite object from a raw suite + full db (merges test data by ID)
export function buildSuiteData(suite, db) {
  const tests = db.tests || [];
  const task1 = suite.writing1Id ? tests.find(t => t.id === suite.writing1Id) || null : null;
  const task2 = suite.writing2Id ? tests.find(t => t.id === suite.writing2Id) || null : null;
  const legacyW = suite.writingId  ? tests.find(t => t.id === suite.writingId)  || null : null;
  let writingData = null;
  if (task1 || task2) {
    writingData = {
      id: (task1?.id || "") + "+" + (task2?.id || ""),
      type: "Writing",
      title: [task1?.title, task2?.title].filter(Boolean).join(" · ") || "Writing",
      task1Prompt: task1?.task1Prompt || null,
      task1Image:  task1?.task1Image  || null,
      task2Prompt: task2?.task2Prompt || null,
    };
  } else if (legacyW) {
    writingData = legacyW;
  }
  return {
    ...suite,
    readingData:   suite.readingId   ? tests.find(t => t.id === suite.readingId)   || null : null,
    writingData,
    listeningData: suite.listeningId ? tests.find(t => t.id === suite.listeningId) || null : null,
  };
}

// Build a single-module suite object (only one section active; others null)
export function buildModuleData(assignment, db) {
  const tests = db.tests || [];
  const mod = assignment.singleModule; // "reading"|"writing1"|"writing2"|"listening"
  const base = { id: assignment.id, name: assignment.label || `${mod} only`, singleModule: mod };
  if (mod === "reading") {
    return { ...base, readingData: assignment.readingId ? tests.find(t => t.id === assignment.readingId) || null : null, writingData: null, listeningData: null };
  } else if (mod === "listening") {
    return { ...base, readingData: null, writingData: null, listeningData: assignment.listeningId ? tests.find(t => t.id === assignment.listeningId) || null : null };
  } else if (mod === "writing1" || mod === "writing2") {
    const t1 = mod === "writing1" && assignment.writing1Id ? tests.find(t => t.id === assignment.writing1Id) || null : null;
    const t2 = mod === "writing2" && assignment.writing2Id ? tests.find(t => t.id === assignment.writing2Id) || null : null;
    const writingData = {
      id: "w-module", type: "Writing", title: assignment.label || "Writing",
      task1Prompt: t1?.task1Prompt || null, task1Image: t1?.task1Image || null,
      task2Prompt: t2?.task2Prompt || null,
      singleTask: mod === "writing1" ? "task1" : "task2",
    };
    return { ...base, readingData: null, writingData, listeningData: null };
  }
  return null;
}

// Peek at whether an email has a pending assignment (used by Registration form)
export function peekAssignment(email) {
  const db = loadDB();
  const assignment = (db.assignments || []).find(a => a.email === email.trim().toLowerCase() && !a.used);
  if (assignment) {
    if (assignment.singleModule) return { status: "assigned", suiteName: assignment.label || `${assignment.singleModule} only` };
    const suite = (db.testSuites || []).find(s => s.id === assignment.suiteId);
    return { status: "assigned", suiteName: suite?.name || "Assigned Test" };
  }
  return { status: "waiting" };
}

// Resolve and consume the suite assignment for the guest flow
export function resolveTestSuite(email) {
  const db = loadDB();
  const assignment = (db.assignments || []).find(a => a.email === email.trim().toLowerCase() && !a.used);
  if (assignment) {
    dbSaveNow("assignments", db.assignments.map(a => a.id === assignment.id ? { ...a, used: true } : a));
    notifyDbChange();
    if (assignment.singleModule) return buildModuleData(assignment, db);
    const suite = (db.testSuites || []).find(s => s.id === assignment.suiteId);
    if (suite) return buildSuiteData(suite, db);
  }
  const published = (db.testSuites || []).filter(s => s.status === "published");
  if (published.length > 0) return buildSuiteData(published[Math.floor(Math.random() * published.length)], db);
  return null;
}
