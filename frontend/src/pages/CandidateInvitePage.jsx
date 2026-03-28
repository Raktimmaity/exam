import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";

function formatSeconds(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

const Icon = ({ d, className = "h-5 w-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const fieldCls =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-[#0c2461] focus:outline-none focus:ring-2 focus:ring-[#0c2461]/20";

/* ─────────────────────────────────────────
   Question status helpers
───────────────────────────────────────── */
function getQStatus(key, answers, visited, marked) {
  const isMarked   = marked.has(key);
  const isAnswered = (answers[key] || []).length > 0;
  const isVisited  = visited.has(key);
  if (isAnswered && isMarked) return "answered-marked";
  if (isMarked)               return "marked";
  if (isAnswered)             return "answered";
  if (isVisited)              return "not-answered";
  return "not-visited";
}

const STATUS_STYLE = {
  "not-visited":     "bg-white text-slate-600 border-slate-300",
  "not-answered":    "bg-red-500 text-white border-red-600",
  "answered":        "bg-green-600 text-white border-green-700",
  "marked":          "bg-purple-600 text-white border-purple-700",
  "answered-marked": "bg-purple-600 text-white border-purple-700 ring-2 ring-green-400 ring-offset-1",
};

const LEGEND = [
  { status: "not-visited",     label: "Not Visited"        },
  { status: "not-answered",    label: "Not Answered"       },
  { status: "answered",        label: "Answered"           },
  { status: "marked",          label: "Marked for Review"  },
  { status: "answered-marked", label: "Answered & Marked"  },
];

/* ─────────────────────────────────────────
   Loading
───────────────────────────────────────── */
function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="flex flex-col items-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0c2461] shadow-xl">
          <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className="h-8 w-8 text-white" />
        </div>
        <div className="text-center">
          <p className="text-lg font-extrabold text-slate-800 tracking-tight">ExamPortal</p>
          <p className="mt-1 text-sm text-slate-500">Loading your examination…</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2.5 w-2.5 rounded-full bg-[#0c2461] animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Error
───────────────────────────────────────── */
function ErrorScreen({ message }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="bg-red-600 px-8 py-7 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
            <Icon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl font-bold">Invalid Invite Link</h2>
          <p className="mt-1 text-sm text-red-200">Access denied</p>
        </div>
        <div className="px-8 py-6 text-center">
          <p className="text-sm text-slate-700">{message}</p>
          <p className="mt-3 text-xs text-slate-400">
            Please check your email for the correct link or contact your exam administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ACTIVE EXAM — TCS iON Style
═══════════════════════════════════════════════════════════ */
function ExamView({
  examData,
  countdown,
  answers,
  setAnswers,
  onSubmit,
  submitting,
  error,
  candidateName,
  fullscreenRequired,
  onReEnterFullscreen,
}) {
  const sections = examData.exam.sections;

  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [visited, setVisited] = useState(() => new Set(["0-0"]));
  const [marked, setMarked] = useState(() => new Set());
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const timerLow     = countdown > 0 && countdown < 300;
  const timerVeryLow = countdown > 0 && countdown < 60;

  const currentSection  = sections[activeSectionIdx];
  const currentQuestion = currentSection?.questions[activeQuestionIdx];
  const currentKey      = `${activeSectionIdx}-${activeQuestionIdx}`;
  const currentSelected = answers[currentKey] || [];

  const globalQuestionNumber = useMemo(() => {
    let n = 0;
    for (let s = 0; s < activeSectionIdx; s++) n += sections[s].questions.length;
    return n + activeQuestionIdx + 1;
  }, [activeSectionIdx, activeQuestionIdx, sections]);

  const totalQuestions = useMemo(() =>
    sections.reduce((a, s) => a + s.questions.length, 0), [sections]);

  const answeredCount = useMemo(() =>
    sections.reduce((acc, _s, sIdx) =>
      acc + sections[sIdx].questions.filter((_, qIdx) =>
        (answers[`${sIdx}-${qIdx}`] || []).length > 0).length, 0),
    [answers, sections]);

  const goTo = (sIdx, qIdx) => {
    setActiveSectionIdx(sIdx);
    setActiveQuestionIdx(qIdx);
    setVisited((v) => new Set([...v, `${sIdx}-${qIdx}`]));
  };

  const toggleAnswer = (optionIndex) => {
    const type = currentQuestion.type;
    const current = answers[currentKey] || [];
    if (type === "single") {
      setAnswers((s) => ({ ...s, [currentKey]: [optionIndex] }));
    } else {
      const updated = current.includes(optionIndex)
        ? current.filter((n) => n !== optionIndex)
        : [...current, optionIndex];
      setAnswers((s) => ({ ...s, [currentKey]: updated }));
    }
  };

  const clearResponse = () => setAnswers((s) => ({ ...s, [currentKey]: [] }));

  const toggleMark = () => {
    setMarked((m) => {
      const next = new Set(m);
      next.has(currentKey) ? next.delete(currentKey) : next.add(currentKey);
      return next;
    });
  };

  const saveAndNext = () => {
    const totalInSection = currentSection.questions.length;
    if (activeQuestionIdx + 1 < totalInSection) {
      goTo(activeSectionIdx, activeQuestionIdx + 1);
    } else if (activeSectionIdx + 1 < sections.length) {
      goTo(activeSectionIdx + 1, 0);
    }
  };

  const goPrev = () => {
    if (activeQuestionIdx > 0) {
      goTo(activeSectionIdx, activeQuestionIdx - 1);
    } else if (activeSectionIdx > 0) {
      const prevSec = activeSectionIdx - 1;
      goTo(prevSec, sections[prevSec].questions.length - 1);
    }
  };

  const isFirstQ = activeSectionIdx === 0 && activeQuestionIdx === 0;
  const isLastQ  = activeSectionIdx === sections.length - 1 &&
                   activeQuestionIdx === sections[sections.length - 1].questions.length - 1;

  const progressPct = Math.round((answeredCount / totalQuestions) * 100);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100">

      {/* ══ TOP HEADER ══ */}
      <header className="shrink-0 bg-[#0c2461] text-white shadow-lg">
        <div className="flex items-center gap-3 px-4 py-2.5">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 border border-white/20">
              <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-extrabold tracking-tight leading-none">ExamPortal</p>
              <p className="text-[10px] text-blue-300 leading-none mt-0.5">Online Assessment</p>
            </div>
          </div>

          <div className="mx-2 hidden sm:block h-8 w-px bg-white/20" />

          {/* Exam title */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">{examData.exam.title}</p>
            <p className="text-[11px] text-blue-300 leading-none mt-0.5">
              Candidate: <span className="text-white font-semibold">{candidateName}</span>
            </p>
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-sm font-bold tabular-nums shrink-0 border transition-all ${
            timerVeryLow
              ? "bg-red-600 border-red-500 animate-pulse shadow-lg shadow-red-500/40"
              : timerLow
                ? "bg-orange-600 border-orange-500"
                : "bg-white/10 border-white/20"
          }`}>
            <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" className="h-4 w-4 shrink-0" />
            <span>{formatSeconds(countdown)}</span>
          </div>

          {/* Mobile palette toggle */}
          <button
            className="lg:hidden flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold border border-white/20"
            onClick={() => setPaletteOpen(true)}
          >
            <Icon d="M4 6h16M4 12h16M4 18h16" className="h-4 w-4" />
          </button>
        </div>

        {/* Section tabs */}
        {sections.length > 0 && (
          <div className="flex gap-0 border-t border-white/10 overflow-x-auto">
            {sections.map((sec, sIdx) => {
              const secAnswered = sec.questions.filter(
                (_, qIdx) => (answers[`${sIdx}-${qIdx}`] || []).length > 0
              ).length;
              return (
                <button
                  key={sIdx}
                  onClick={() => goTo(sIdx, 0)}
                  className={`flex shrink-0 items-center gap-2 px-5 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                    activeSectionIdx === sIdx
                      ? "border-amber-400 bg-white/10 text-white"
                      : "border-transparent text-blue-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {sec.name || `Section ${sIdx + 1}`}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeSectionIdx === sIdx
                      ? "bg-amber-400 text-amber-900"
                      : "bg-white/15 text-blue-200"
                  }`}>
                    {secAnswered}/{sec.questions.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ══ BODY ══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── MAIN QUESTION AREA ── */}
        <main className="flex flex-1 flex-col overflow-hidden">

          {/* Progress bar */}
          <div className="h-1 bg-slate-200 shrink-0">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Question meta bar */}
          <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-2.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-[#0c2461] px-3 py-1.5 text-xs font-bold text-white">
                Q {globalQuestionNumber} / {totalQuestions}
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                {currentQuestion?.type === "single" ? "Single Correct" : "Multiple Correct"}
              </span>
              {/* <span className="hidden sm:inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                {currentQuestion?.points} Mark{currentQuestion?.points !== 1 ? "s" : ""}
              </span> */}
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span className="font-bold text-green-600">{answeredCount}</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">{totalQuestions}</span>
              <span className="hidden sm:inline text-slate-400 ml-1">answered</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shrink-0">
              <Icon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Question + Options — scrollable */}
          <div className="relative flex-1 overflow-y-auto p-4 md:p-5">
            {/* Watermark */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={`wm-${idx}`}
                  className="absolute select-none text-slate-300/25 font-extrabold tracking-wider whitespace-nowrap"
                  style={{
                    top: `${8 + idx * 12}%`,
                    left: idx % 2 === 0 ? "4%" : "28%",
                    transform: "rotate(-18deg)",
                    fontSize: "clamp(18px, 2.4vw, 28px)",
                  }}
                >
                  {candidateName}
                </div>
              ))}
            </div>

            <div className="relative z-10">
            {/* Question text */}
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0c2461] text-xs font-bold text-white mt-0.5">
                  {globalQuestionNumber}
                </span>
                <p className="flex-1 text-sm font-medium leading-relaxed text-slate-800">
                  {currentQuestion?.question}
                </p>
              </div>
              {currentQuestion?.codeSnippet && (
                <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-700 bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
                  <code>{currentQuestion.codeSnippet}</code>
                </pre>
              )}
            </div>

            {/* Options */}
            <div className="space-y-2.5">
              {currentQuestion?.options.map((opt, optIdx) => {
                const isSelected = currentSelected.includes(optIdx);
                const label = String.fromCharCode(65 + optIdx);
                return (
                  <label
                    key={optIdx}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3.5 transition-all ${
                      isSelected
                        ? "border-[#0c2461] bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                      isSelected
                        ? "border-[#0c2461] bg-[#0c2461] text-white"
                        : "border-slate-300 text-slate-500 bg-white"
                    }`}>
                      {label}
                    </span>
                    <input
                      type={currentQuestion.type === "single" ? "radio" : "checkbox"}
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => toggleAnswer(optIdx)}
                    />
                    <span className={`flex-1 text-sm leading-relaxed ${
                      isSelected ? "font-semibold text-[#0c2461]" : "text-slate-700"
                    }`}>
                      {opt.text}
                    </span>
                    {isSelected && (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0c2461]">
                        <Icon d="M5 13l4 4L19 7" className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
            </div>
          </div>

          {/* ── Bottom action bar ── */}
          <div className="shrink-0 border-t-2 border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Mark for review */}
              <button
                onClick={toggleMark}
                className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-semibold transition ${
                  marked.has(currentKey)
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:text-purple-600"
                }`}
              >
                <svg className="h-4 w-4" fill={marked.has(currentKey) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {marked.has(currentKey) ? "Marked" : "Mark for Review"}
              </button>

              {/* Clear */}
              <button
                onClick={clearResponse}
                disabled={currentSelected.length === 0}
                className="flex items-center gap-1.5 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="h-4 w-4" />
                Clear
              </button>

              <div className="flex-1" />

              {/* Prev */}
              <button
                onClick={goPrev}
                disabled={isFirstQ}
                className="flex items-center gap-1.5 rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon d="M15 19l-7-7 7-7" className="h-4 w-4" />
                Previous
              </button>

              {/* Save & Next */}
              {!isLastQ ? (
                <button
                  onClick={saveAndNext}
                  className="flex items-center gap-1.5 rounded-lg bg-[#0c2461] px-5 py-2 text-xs font-bold text-white shadow transition hover:bg-[#103570]"
                >
                  Save & Next
                  <Icon d="M9 5l7 7-7 7" className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-5 py-2 text-xs font-bold text-white shadow transition hover:bg-green-700"
                >
                  <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" className="h-4 w-4" />
                  Submit Exam
                </button>
              )}
            </div>
          </div>
        </main>

        {/* ── RIGHT PANEL: Question Palette ── */}
        <>
          {paletteOpen && (
            <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setPaletteOpen(false)} />
          )}

          <aside className={`
            fixed right-0 top-0 z-40 h-full w-64 bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-transform duration-300
            lg:static lg:z-auto lg:shadow-none lg:translate-x-0 lg:w-60
            ${paletteOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
          `}>
            {/* Candidate header */}
            <div className="shrink-0 bg-[#0c2461] px-4 py-3 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-amber-900">
                    {candidateName?.[0]?.toUpperCase() ?? "C"}
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight">{candidateName}</p>
                    <p className="text-[10px] text-blue-300 leading-none mt-0.5">Candidate</p>
                  </div>
                </div>
                <button className="lg:hidden text-white/60 hover:text-white" onClick={() => setPaletteOpen(false)}>
                  <Icon d="M6 18L18 6M6 6l12 12" className="h-5 w-5" />
                </button>
              </div>
              {/* Mini stats */}
              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                <div className="rounded-lg bg-white/10 py-1.5">
                  <p className="font-bold text-green-300 text-sm leading-none">{answeredCount}</p>
                  <p className="text-[9px] text-blue-200 mt-0.5">Answered</p>
                </div>
                <div className="rounded-lg bg-white/10 py-1.5">
                  <p className="font-bold text-red-300 text-sm leading-none">{totalQuestions - answeredCount}</p>
                  <p className="text-[9px] text-blue-200 mt-0.5">Remaining</p>
                </div>
                <div className="rounded-lg bg-white/10 py-1.5">
                  <p className="font-bold text-purple-300 text-sm leading-none">{marked.size}</p>
                  <p className="text-[9px] text-blue-200 mt-0.5">Marked</p>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-3">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Legend</p>
              <div className="space-y-1.5">
                {LEGEND.map(({ status, label }) => (
                  <div key={status} className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[9px] font-bold ${STATUS_STYLE[status]}`}>
                      {status === "answered-marked" ? "✓" : ""}
                    </span>
                    <span className="text-[10px] text-slate-600">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Question palette — scrollable */}
            <div className="flex-1 overflow-y-auto p-3">
              {sections.map((sec, sIdx) => (
                <div key={sIdx} className="mb-4">
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    {sec.name || `Section ${sIdx + 1}`}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {sec.questions.map((_, qIdx) => {
                      const key = `${sIdx}-${qIdx}`;
                      const status = getQStatus(key, answers, visited, marked);
                      const isActive = sIdx === activeSectionIdx && qIdx === activeQuestionIdx;
                      let n = 1;
                      for (let s = 0; s < sIdx; s++) n += sections[s].questions.length;
                      n += qIdx;
                      return (
                        <button
                          key={qIdx}
                          onClick={() => { goTo(sIdx, qIdx); setPaletteOpen(false); }}
                          className={`flex h-8 w-8 items-center justify-center rounded border text-xs font-bold transition-all ${STATUS_STYLE[status]} ${
                            isActive ? "ring-2 ring-amber-400 ring-offset-1 scale-110 shadow-md" : "hover:scale-105"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Submit + progress */}
            <div className="shrink-0 border-t border-slate-200 bg-white p-3">
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-green-700"
              >
                <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" className="h-4 w-4" />
                Submit Test
              </button>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-1 text-center text-[10px] text-slate-400">{progressPct}% completed</p>
            </div>
          </aside>
        </>
      </div>

      {/* ══ SUBMIT CONFIRMATION MODAL ══ */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-[#0c2461] px-7 py-6 text-center text-white">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400">
                <Icon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" className="h-7 w-7 text-amber-900" />
              </div>
              <h3 className="text-xl font-bold">Submit Examination?</h3>
              <p className="mt-1 text-sm text-blue-200">This action cannot be undone</p>
            </div>
            <div className="px-7 py-5">
              <p className="text-center text-sm text-slate-600">
                You have answered{" "}
                <span className="font-bold text-slate-800">{answeredCount}</span> out of{" "}
                <span className="font-bold text-slate-800">{totalQuestions}</span> questions.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-green-100 bg-green-50 p-3">
                  <p className="text-2xl font-bold text-green-600">{answeredCount}</p>
                  <p className="text-[11px] font-medium text-green-700 mt-0.5">Answered</p>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                  <p className="text-2xl font-bold text-red-600">{totalQuestions - answeredCount}</p>
                  <p className="text-[11px] font-medium text-red-700 mt-0.5">Unanswered</p>
                </div>
                <div className="rounded-xl border border-purple-100 bg-purple-50 p-3">
                  <p className="text-2xl font-bold text-purple-600">{marked.size}</p>
                  <p className="text-[11px] font-medium text-purple-700 mt-0.5">Marked</p>
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 rounded-xl border-2 border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Review
                </button>
                <button
                  onClick={() => { setShowSubmitConfirm(false); onSubmit(); }}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 transition disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Submitting…
                    </>
                  ) : "Yes, Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {fullscreenRequired && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/95 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 text-center text-white shadow-2xl">
            <p className="text-xl font-bold">Fullscreen Required</p>
            <p className="mt-2 text-sm text-slate-300">
              You must stay in fullscreen mode while the exam is running.
            </p>
            <button
              type="button"
              onClick={onReEnterFullscreen}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-green-700"
            >
              Return to Fullscreen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function CandidateInvitePage() {
  const { token } = useParams();

  const [invite, setInvite]             = useState(null);
  const [countdown, setCountdown]       = useState(0);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(true);
  const [verified, setVerified]         = useState(false);
  const [examData, setExamData]         = useState(null);
  const [answers, setAnswers]           = useState({});
  const [submission, setSubmission]     = useState(null);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [fullscreenRequired, setFullscreenRequired] = useState(false);
  const [networkCheck, setNetworkCheck] = useState({
    status: "idle",
    latencyMs: null,
    speedMbps: null,
    message: "",
  });
  const [rulesAcknowledged, setRulesAcknowledged] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [preExamStep, setPreExamStep] = useState(1);

  const [verifyForm, setVerifyForm]     = useState({ name: "", email: "", phone: "" });
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, comment: "" });

  const getFullscreenElement = () =>
    document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;

  const requestExamFullscreen = useCallback(async () => {
    const root = document.documentElement;
    try {
      if (root.requestFullscreen) {
        await root.requestFullscreen();
      } else if (root.webkitRequestFullscreen) {
        root.webkitRequestFullscreen();
      } else if (root.msRequestFullscreen) {
        root.msRequestFullscreen();
      }
    } catch {
      /* ignored: user may deny or browser may block until explicit interaction */
    }
    setFullscreenRequired(!Boolean(getFullscreenElement()));
  }, []);

  const runNetworkCheck = useCallback(async () => {
    setNetworkCheck({
      status: "running",
      latencyMs: null,
      speedMbps: null,
      message: "Checking your internet speed...",
    });

    try {
      const latencyStart = performance.now();
      await fetch(`https://www.gstatic.com/generate_204?t=${Date.now()}`, {
        cache: "no-store",
        mode: "no-cors",
      });
      const latencyMs = Math.round(performance.now() - latencyStart);

      const speedStart = performance.now();
      const speedRes = await fetch(
        `https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js?t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!speedRes.ok) throw new Error("Unable to download speed test file");
      const data = await speedRes.arrayBuffer();
      const elapsedSec = Math.max(0.001, (performance.now() - speedStart) / 1000);
      const speedMbps = Number((((data.byteLength * 8) / elapsedSec) / 1_000_000).toFixed(2));

      setNetworkCheck({
        status: "done",
        latencyMs,
        speedMbps,
        message: "Network check completed",
      });
      setPreExamStep(3);
      setShowRulesModal(true);
    } catch (e) {
      setNetworkCheck({
        status: "failed",
        latencyMs: null,
        speedMbps: null,
        message: e?.message || "Network check failed. Please retry.",
      });
    }
  }, []);

  const loadInvite = async () => {
    try {
      const { data } = await api.get(`/candidate/invite/${token}`);
      setInvite(data);
      setCountdown(data.canStart ? data.secondsToEnd : data.secondsToStart);
      setVerifyForm((f) => ({ ...f, name: data.candidate.name, email: data.candidate.email }));
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid invite link");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInvite(); }, [token]);

  useEffect(() => {
    if (examData || submission || feedbackDone) return;
    const id = setInterval(loadInvite, 15000);
    return () => clearInterval(id);
  }, [token, examData, submission, feedbackDone]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  useEffect(() => {
    if (!verified) {
      setPreExamStep(1);
      return;
    }
    if (networkCheck.status !== "done") {
      setPreExamStep(2);
      return;
    }
    setPreExamStep(3);
  }, [verified, networkCheck.status]);

  useEffect(() => {
    if (!examData) return;

    setFullscreenRequired(!Boolean(getFullscreenElement()));

    const onFullscreenChange = () => {
      setFullscreenRequired(!Boolean(getFullscreenElement()));
    };

    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Exam is in progress.";
    };

    const onPopState = () => {
      window.history.pushState(null, "", window.location.href);
    };

    const onKeyDown = (e) => {
      if (e.key === "F11") {
        e.preventDefault();
      }
    };

    window.history.pushState(null, "", window.location.href);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("msfullscreenchange", onFullscreenChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      document.removeEventListener("msfullscreenchange", onFullscreenChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
      setFullscreenRequired(false);
    };
  }, [examData]);

  const verifyCandidate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post(`/candidate/invite/${token}/verify`, verifyForm);
      setVerified(true);
      setPreExamStep(2);
      setRulesAcknowledged(false);
      setShowRulesModal(false);
      setNetworkCheck({
        status: "idle",
        latencyMs: null,
        speedMbps: null,
        message: "",
      });
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    }
  };

  const startExam = async () => {
    setError("");
    try {
      const { data } = await api.post(`/candidate/invite/${token}/start`);
      setExamData(data);
      const end = new Date(data.endsAt).getTime();
      setCountdown(Math.max(0, Math.floor((end - Date.now()) / 1000)));
      await requestExamFullscreen();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to start exam");
      await loadInvite();
    }
  };

  const submitExam = async () => {
    if (!examData) return;
    setSubmitting(true);
    const payload = examData.exam.sections.map((section, sIdx) =>
      section.questions.map((_q, qIdx) => answers[`${sIdx}-${qIdx}`] || [])
    );
    try {
      const { data } = await api.post(`/candidate/invite/${token}/submit`, { answers: payload });
      setSubmission(data.result);
      setExamData(null);
      if (document.exitFullscreen && getFullscreenElement()) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen && getFullscreenElement()) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen && getFullscreenElement()) {
        document.msExitFullscreen();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const submitFeedback = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/candidate/invite/${token}/feedback`, feedbackForm);
      setFeedbackDone(true);
    } catch (err) {
      setError(err.response?.data?.message || "Feedback failed");
    }
  };

  /* ── Guards ── */
  if (loading) return <LoadingScreen />;
  if (error && !invite) return <ErrorScreen message={error} />;

  /* ── Active exam ── */
  if (examData) {
    return (
      <ExamView
        examData={examData}
        countdown={countdown}
        answers={answers}
        setAnswers={setAnswers}
        onSubmit={submitExam}
        submitting={submitting}
        error={error}
        candidateName={invite?.candidate?.name || verifyForm.name}
        fullscreenRequired={fullscreenRequired}
        onReEnterFullscreen={requestExamFullscreen}
      />
    );
  }

  /* ── Feedback ── */
  if (submission && !feedbackDone) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0c2461] shadow-lg mb-3">
            <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className="h-6 w-6 text-white" />
          </div>
          <p className="text-xl font-bold text-slate-800">Exam Submitted</p>
          <p className="text-sm text-slate-500 mt-1">Your responses have been recorded successfully</p>
        </div>

        <div className="w-full max-w-md">
          <div className="overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="bg-[#0c2461] px-6 py-4 text-white">
              <p className="font-bold text-base">Share Your Feedback</p>
              <p className="text-sm text-blue-200 mt-0.5">Help us improve the exam experience</p>
            </div>
            <div className="p-6">
              <form onSubmit={submitFeedback} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Overall Rating</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackForm((s) => ({ ...s, rating: star }))}
                        className="transition-transform hover:scale-110 focus:outline-none"
                      >
                        <svg
                          className={`h-9 w-9 transition-colors ${star <= feedbackForm.rating ? "text-amber-400" : "text-slate-200"}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    ))}
                    <span className="ml-2 text-sm font-bold text-amber-600">{feedbackForm.rating}/5</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Comment <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-[#0c2461] focus:outline-none focus:ring-2 focus:ring-[#0c2461]/20 min-h-24 resize-none"
                    placeholder="Any thoughts on the exam experience?"
                    value={feedbackForm.comment}
                    onChange={(e) => setFeedbackForm((s) => ({ ...s, comment: e.target.value }))}
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c2461] px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-[#103570]">
                  <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" className="h-4 w-4" />
                  Submit Feedback
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Thank you ── */
  if (feedbackDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl text-center">
          <div className="bg-green-600 px-8 py-8 text-white">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20">
              <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold">All Done!</h2>
            <p className="mt-2 text-green-100 text-sm">Examination completed successfully</p>
          </div>
          <div className="px-8 py-7">
            <p className="text-sm text-slate-600 leading-relaxed">
              Thank you for completing the exam and sharing your feedback.<br />
              Your result will be reviewed and shared with you soon.
            </p>
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Next Steps</p>
              <p className="mt-1 text-sm text-slate-600">
                You will receive your results via email. You may safely close this window.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Pre-exam / Waiting ── */
  const statusInfo = invite
    ? invite.canStart
      ? {
          label: "Exam is Active",
          desc: `Window closes in ${formatSeconds(countdown)}`,
          color: "bg-green-50 text-green-700 border border-green-200",
          iconColor: "text-green-600",
          icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        }
      : invite.secondsToStart > 0
        ? {
            label: "Exam Scheduled",
            desc: `Starts in ${formatSeconds(countdown)}`,
            color: "bg-amber-50 text-amber-700 border border-amber-200",
            iconColor: "text-amber-600",
            icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
          }
        : invite.isActivated
          ? {
              label: "Window Closed",
              desc: "The scheduled exam window has passed.",
              color: "bg-slate-100 text-slate-600 border border-slate-200",
              iconColor: "text-slate-500",
              icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
            }
          : {
              label: "Pending Activation",
              desc: "Waiting for administrator to activate this exam.",
              color: "bg-blue-50 text-blue-700 border border-blue-200",
              iconColor: "text-blue-600",
              icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
            }
    : null;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top nav bar */}
      <div className="bg-[#0c2461] text-white px-6 py-3 flex items-center gap-3 shadow-lg">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 border border-white/20">
          <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-extrabold text-sm tracking-tight leading-none">ExamPortal</p>
          <p className="text-[10px] text-blue-300 leading-none mt-0.5">Online Assessment Platform</p>
        </div>
        {invite && (
          <div className="ml-auto hidden sm:block text-right">
            <p className="text-xs font-semibold text-white truncate max-w-xs">{invite.exam.title}</p>
            <p className="text-[10px] text-blue-300">{new Date(invite.scheduledAt).toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-5">

          {/* LEFT: Exam info + instructions */}
          <div className="lg:col-span-2 space-y-4">
            {invite && (
              <div className="overflow-hidden rounded-2xl bg-white shadow-md">
                <div className="bg-[#0c2461] px-5 py-4 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mb-1">Examination Details</p>
                  <p className="font-bold text-lg leading-tight">{invite.exam.title}</p>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                      <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" className="h-4 w-4 text-[#0c2461]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Scheduled</p>
                      <p className="text-sm font-semibold text-slate-800">{new Date(invite.scheduledAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                      <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Duration</p>
                      <p className="text-sm font-semibold text-slate-800">{invite.exam.durationMinutes} minutes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50">
                      <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Candidate</p>
                      <p className="text-sm font-semibold text-slate-800">{invite.candidate.name}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-md">
              <div className="bg-slate-800 px-5 py-3 text-white">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Instructions</p>
                <p className="font-bold text-sm">Read Before You Begin</p>
              </div>
              <div className="p-5">
                <ul className="space-y-2.5">
                  {[
                    "Verify your identity before starting the exam",
                    "Ensure a stable internet connection throughout",
                    "Do not refresh or navigate away during the exam",
                    "Each question may have single or multiple correct answers",
                    "Use 'Mark for Review' to flag questions you want to revisit",
                    "Submit before the timer runs out",
                  ].map((instruction, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0c2461] text-[10px] font-bold text-white mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-600">{instruction}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* RIGHT: Verification + Start */}
          <div className="lg:col-span-3 space-y-4">
            {/* Status banner */}
            {statusInfo && (
              <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 ${statusInfo.color}`}>
                <Icon d={statusInfo.icon} className={`h-5 w-5 shrink-0 ${statusInfo.iconColor}`} />
                <div>
                  <p className="font-bold text-sm">{statusInfo.label}</p>
                  <p className="text-xs opacity-80">{statusInfo.desc}</p>
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-white p-3 shadow-md">
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        preExamStep === step
                          ? "bg-[#0c2461] text-white"
                          : preExamStep > step
                            ? "bg-green-600 text-white"
                            : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {preExamStep > step ? <Icon d="M5 13l4 4L19 7" className="h-3.5 w-3.5" /> : step}
                    </span>
                    {step < 3 && <span className="h-px w-8 bg-slate-200" />}
                  </div>
                ))}
              </div>
            </div>

            {preExamStep === 1 && (
              <div className="overflow-hidden rounded-2xl bg-white shadow-md">
                <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0c2461] text-sm font-bold text-white">1</div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-slate-800">Identity Verification</p>
                    <p className="text-xs text-slate-500">Confirm your details to proceed</p>
                  </div>
                </div>
                <div className="px-6 py-5">
                  <form onSubmit={verifyCandidate} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</label>
                        <input className={fieldCls} placeholder="Your full name" value={verifyForm.name} onChange={(e) => setVerifyForm((s) => ({ ...s, name: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                        <input className={fieldCls} type="email" placeholder="you@example.com" value={verifyForm.email} onChange={(e) => setVerifyForm((s) => ({ ...s, email: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Phone Number</label>
                        <input className={fieldCls} placeholder="+91 98765 43210" value={verifyForm.phone} onChange={(e) => setVerifyForm((s) => ({ ...s, phone: e.target.value }))} />
                      </div>
                    </div>
                    {error && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                        <Icon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" className="h-4 w-4 shrink-0" />
                        {error}
                      </div>
                    )}
                    <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-slate-900">
                      <Icon d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" className="h-4 w-4" />
                      Verify Identity
                    </button>
                  </form>
                </div>
              </div>
            )}

            {preExamStep === 2 && (
              <div className="overflow-hidden rounded-2xl bg-white shadow-md">
                <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0c2461] text-sm font-bold text-white">2</div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">Network Speed Check</p>
                    <p className="text-xs text-slate-500">Required before reading exam rules</p>
                  </div>
                </div>
                <div className="px-6 py-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-700">Status: <span className="uppercase tracking-wide">{networkCheck.status === "idle" ? "Not started" : networkCheck.status === "running" ? "Running" : networkCheck.status === "done" ? "Completed" : "Failed"}</span></p>
                    {networkCheck.latencyMs !== null && <p className="mt-1 text-sm text-slate-700">Latency: {networkCheck.latencyMs} ms</p>}
                    {networkCheck.speedMbps !== null && <p className="mt-1 text-sm text-slate-700">Download speed: {networkCheck.speedMbps} Mbps</p>}
                    {networkCheck.message && <p className={`mt-2 text-xs ${networkCheck.status === "failed" ? "text-red-600" : "text-slate-500"}`}>{networkCheck.message}</p>}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button type="button" onClick={() => setPreExamStep(1)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Back</button>
                    <button type="button" onClick={runNetworkCheck} disabled={!verified || networkCheck.status === "running"} className="flex-1 rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40">
                      {networkCheck.status === "running" ? "Checking Network..." : "Run Network Check"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {preExamStep === 3 && (
              <div className="overflow-hidden rounded-2xl bg-white shadow-md">
                <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0c2461] text-sm font-bold text-white">3</div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">Rules & Start Exam</p>
                    <p className="text-xs text-slate-500">Acknowledge rules, then begin</p>
                  </div>
                </div>
                <div className="px-6 py-5">
                  <button type="button" onClick={() => setShowRulesModal(true)} className="mb-4 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                    {rulesAcknowledged ? "View Rules Again" : "Open Rules"}
                  </button>
                  <button
                    onClick={startExam}
                    disabled={!rulesAcknowledged || !invite?.canStart}
                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#0c2461] px-5 py-4 text-sm font-bold text-white shadow-lg transition hover:bg-[#103570] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                      <Icon d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-base">{invite?.canStart ? "Start Examination Now" : "Waiting for Exam to Open…"}</span>
                    {invite?.canStart && <Icon d="M13 7l5 5m0 0l-5 5m5-5H6" className="h-4 w-4 ml-auto" />}
                  </button>
                  {!rulesAcknowledged && <p className="mt-3 text-center text-xs text-slate-500">Open and acknowledge rules to continue.</p>}
                  {!invite?.canStart && <p className="mt-3 text-center text-xs text-slate-500">The exam window is not currently open. Please wait.</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showRulesModal && verified && networkCheck.status === "done" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-[#0c2461] px-6 py-4 text-white">
              <p className="text-sm font-bold">Exam Rules & Guidelines</p>
              <p className="text-xs text-blue-200 mt-0.5">Read carefully before starting</p>
            </div>
            <div className="px-6 py-5">
              <ul className="space-y-2 text-sm text-slate-700">
                <li>1. Do not refresh, close, or switch tabs during the exam.</li>
                <li>2. Keep stable internet; intermittent connection can affect submission.</li>
                <li>3. Fullscreen mode is mandatory once the exam starts.</li>
                <li>4. Read each question carefully before submitting your answer.</li>
                <li>5. Submit before timer ends; late submissions are not accepted.</li>
              </ul>
              <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={rulesAcknowledged}
                  onChange={(e) => setRulesAcknowledged(e.target.checked)}
                />
                I have read and understood all rules, and I agree to proceed.
              </label>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRulesModal(false)}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={!rulesAcknowledged}
                  onClick={() => setShowRulesModal(false)}
                  className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
