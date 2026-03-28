import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAdminToken } from "../lib/api";

const emptyQuestion = {
  type: "single",
  question: "",
  codeSnippet: "",
  starterCode: "",
  language: "javascript",
  supportedLanguages: ["javascript"],
  starterCodeByLanguage: {
    javascript: "",
    python: "",
    c: "",
    cpp: "",
  },
  testCases: [{ input: "", expectedOutput: "", isHidden: false }],
  options: ["", "", "", ""],
  correctIndexes: [],
  points: 1
};
const emptySection = { name: "", questions: [emptyQuestion] };
const CODING_LANG_OPTIONS = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
];

function makeEmptyQuestion() {
  return {
    ...emptyQuestion,
    supportedLanguages: [...emptyQuestion.supportedLanguages],
    starterCodeByLanguage: { ...emptyQuestion.starterCodeByLanguage },
    testCases: emptyQuestion.testCases.map((testCase) => ({ ...testCase })),
    options: [...emptyQuestion.options],
    correctIndexes: [...emptyQuestion.correctIndexes],
  };
}

/* ── Icons ─────────────────────────────────────────────────── */
const Icon = ({ d, className = "h-5 w-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const ICONS = {
  overview:    "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  candidates:  "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  exams:       "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  assign:      "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  results:     "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  logout:      "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  menu:        "M4 6h16M4 12h16M4 18h16",
  close:       "M6 18L18 6M6 6l12 12",
  check:       "M5 13l4 4L19 7",
  x:           "M6 18L18 6M6 6l12 12",
  eye:         "M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z",
  plus:        "M12 4v16m8-8H4",
  clock:       "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  mail:        "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
};

const NAV = [
  { id: "overview",   label: "Overview",    icon: ICONS.overview },
  { id: "candidates", label: "Candidates",  icon: ICONS.candidates },
  { id: "exams",      label: "Create Exam", icon: ICONS.exams },
  { id: "assign",     label: "Assign Exam", icon: ICONS.assign },
  { id: "results",    label: "Results",     icon: ICONS.results },
];

/* ── Status badge ───────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    scheduled: "bg-amber-100 text-amber-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
    expired:   "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {String(status || "").replace("_", " ")}
    </span>
  );
}

/* ── Stat card ──────────────────────────────────────────────── */
function StatCard({ label, value, icon, color }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm shadow-slate-200/60 border border-slate-100">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Icon d={icon} className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

/* ── Section header ─────────────────────────────────────────── */
function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

/* ── Field label wrapper ────────────────────────────────────── */
function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const defaultExamForm = {
  title: "",
  description: "",
  durationMinutes: 60,
  sections: [emptySection],
  negativeMarkingEnabled: false,
  negativeWrongAnswersCount: 3,
  negativePenaltyPoints: 0.03,
};

function formatInIndiaTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function toIstOffsetDateTime(datetimeLocal) {
  if (!datetimeLocal) return "";
  if (/Z$|[+-]\d{2}:\d{2}$/.test(datetimeLocal)) return datetimeLocal;
  const withSeconds = datetimeLocal.length === 16 ? `${datetimeLocal}:00` : datetimeLocal;
  return `${withSeconds}+05:30`;
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [candidates, setCandidates]           = useState([]);
  const [exams, setExams]                     = useState([]);
  const [assignments, setAssignments]         = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [message, setMessage]                 = useState({ text: "", type: "info" });

  const [candidateForm, setCandidateForm] = useState({ name: "", email: "", phone: "", company: "", details: "" });
  const [examForm, setExamForm]           = useState(defaultExamForm);
  const [examStep, setExamStep]           = useState(1);
  const [editingExamId, setEditingExamId] = useState(null);
  const [assignForm, setAssignForm]       = useState({ candidateId: "", examId: "", scheduledAt: "", validityHours: 2 });

  const examPreviewQuestionCount = useMemo(
    () => examForm.sections.reduce((acc, s) => acc + s.questions.length, 0),
    [examForm.sections]
  );

  const completedCount = assignments.filter((a) => a.status === "completed").length;
  const rankedResults = useMemo(
    () =>
      assignments
        .filter((a) => Boolean(a.result))
        .slice()
        .sort((a, b) => {
          const scoreDiff = Number(b.result?.score || 0) - Number(a.result?.score || 0);
          if (scoreDiff !== 0) return scoreDiff;
          const bTime = new Date(b.result?.submittedAt || b.submittedAt || 0).getTime();
          const aTime = new Date(a.result?.submittedAt || a.submittedAt || 0).getTime();
          return bTime - aTime;
        }),
    [assignments]
  );

  const loadAll = async () => {
    const [cRes, eRes, aRes] = await Promise.all([
      api.get("/admin/candidates"),
      api.get("/admin/exams"),
      api.get("/admin/assignments"),
    ]);
    setCandidates(cRes.data);
    setExams(eRes.data);
    setAssignments(aRes.data);
  };

  useEffect(() => {
    loadAll().catch(() => {
      localStorage.removeItem("adminToken");
      setAdminToken(null);
      navigate("/admin/login");
    });
  }, []);

  const notify = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "info" }), 5000);
  };

  const logout = () => {
    localStorage.removeItem("adminToken");
    setAdminToken(null);
    navigate("/admin/login");
  };

  /* ── Candidate ── */
  const submitCandidate = async (e) => {
    e.preventDefault();
    const { data } = await api.post("/admin/candidates", candidateForm);
    setCandidates((s) => [data, ...s]);
    setCandidateForm({ name: "", email: "", phone: "", company: "", details: "" });
    notify("Candidate created successfully.");
  };

  const deleteCandidate = async (candidate) => {
    const ok = window.confirm(`Delete candidate "${candidate.name}"? This will also remove their assignments and submissions.`);
    if (!ok) return;

    await api.delete(`/admin/candidates/${candidate._id}`);
    setCandidates((s) => s.filter((item) => item._id !== candidate._id));
    setAssignments((s) => s.filter((item) => item.candidate?._id !== candidate._id));
    setSelectedSubmission((s) => (s?.candidate?._id === candidate._id ? null : s));
    setAssignForm((s) => (s.candidateId === candidate._id ? { ...s, candidateId: "" } : s));
    notify("Candidate deleted successfully.");
  };

  /* ── Exam builder ── */
  const addSection  = () => setExamForm((s) => ({ ...s, sections: [...s.sections, { ...emptySection, questions: [makeEmptyQuestion()] }] }));
  const removeSection = (si) =>
    setExamForm((s) => {
      if (!Array.isArray(s.sections) || s.sections.length <= 1) return s;
      const sections = [...s.sections];
      sections.splice(si, 1);
      return { ...s, sections };
    });
  const addQuestion = (si) => setExamForm((s) => { const sec = [...s.sections]; sec[si] = { ...sec[si], questions: [...sec[si].questions, makeEmptyQuestion()] }; return { ...s, sections: sec }; });
  const removeQuestion = (si, qi) =>
    setExamForm((s) => {
      const sec = [...s.sections];
      const questions = [...(sec[si]?.questions || [])];
      if (questions.length <= 1) return s;
      questions.splice(qi, 1);
      sec[si] = { ...sec[si], questions };
      return { ...s, sections: sec };
    });
  const updateSection  = (si, key, val) => setExamForm((s) => { const sec = [...s.sections]; sec[si] = { ...sec[si], [key]: val }; return { ...s, sections: sec }; });
  const updateQuestion = (si, qi, key, val) => setExamForm((s) => { const sec = [...s.sections]; const qs = [...sec[si].questions]; qs[qi] = { ...qs[qi], [key]: val }; sec[si] = { ...sec[si], questions: qs }; return { ...s, sections: sec }; });

  const changeQuestionType = (si, qi, newType) =>
    setExamForm((s) => {
      const sec = [...s.sections];
      const qs = [...sec[si].questions];
      const q = qs[qi];
      const newCorrect = newType === "coding"
        ? []
        : newType === "single" && q.correctIndexes.length > 1
          ? [q.correctIndexes[0]]
          : q.correctIndexes;
      qs[qi] = {
        ...q,
        type: newType,
        correctIndexes: newCorrect,
        supportedLanguages: Array.isArray(q.supportedLanguages) && q.supportedLanguages.length
          ? q.supportedLanguages
          : ["javascript"],
        starterCodeByLanguage: {
          javascript: q?.starterCodeByLanguage?.javascript || "",
          python: q?.starterCodeByLanguage?.python || "",
          c: q?.starterCodeByLanguage?.c || "",
          cpp: q?.starterCodeByLanguage?.cpp || "",
        },
        testCases: Array.isArray(q.testCases) && q.testCases.length
          ? q.testCases
          : [{ input: "", expectedOutput: "", isHidden: false }],
      };
      sec[si] = { ...sec[si], questions: qs };
      return { ...s, sections: sec };
    });

  const updateOption = (si, qi, optIdx, value) =>
    setExamForm((s) => {
      const sec = [...s.sections];
      const qs = [...sec[si].questions];
      const q = qs[qi];
      const newOptions = [...q.options];
      newOptions[optIdx] = value;
      qs[qi] = { ...q, options: newOptions };
      sec[si] = { ...sec[si], questions: qs };
      return { ...s, sections: sec };
    });

  const addOption = (si, qi) =>
    setExamForm((s) => {
      const sec = [...s.sections];
      const qs = [...sec[si].questions];
      const q = qs[qi];
      if (q.options.length >= 6) return s;
      qs[qi] = { ...q, options: [...q.options, ""] };
      sec[si] = { ...sec[si], questions: qs };
      return { ...s, sections: sec };
    });

  const removeOption = (si, qi, optIdx) =>
    setExamForm((s) => {
      const sec = [...s.sections];
      const qs = [...sec[si].questions];
      const q = qs[qi];
      if (q.options.length <= 2) return s;
      const newOptions = q.options.filter((_, i) => i !== optIdx);
      const newCorrect = q.correctIndexes
        .filter((idx) => idx !== optIdx)
        .map((idx) => (idx > optIdx ? idx - 1 : idx));
      qs[qi] = { ...q, options: newOptions, correctIndexes: newCorrect };
      sec[si] = { ...sec[si], questions: qs };
      return { ...s, sections: sec };
    });

  const toggleCorrect = (si, qi, optIdx) =>
    setExamForm((s) => {
      const sec = [...s.sections];
      const qs = [...sec[si].questions];
      const q = qs[qi];
      let newCorrect;
      if (q.type === "single") {
        newCorrect = [optIdx];
      } else {
        newCorrect = q.correctIndexes.includes(optIdx)
          ? q.correctIndexes.filter((i) => i !== optIdx)
          : [...q.correctIndexes, optIdx].sort((a, b) => a - b);
      }
      qs[qi] = { ...q, correctIndexes: newCorrect };
      sec[si] = { ...sec[si], questions: qs };
      return { ...s, sections: sec };
    });

  const toggleCodingLanguage = (si, qi, language) =>
    setExamForm((s) => {
      const sec = [...s.sections];
      const qs = [...sec[si].questions];
      const q = qs[qi];
      const set = new Set(q.supportedLanguages || []);
      if (set.has(language)) {
        if (set.size <= 1) return s;
        set.delete(language);
      } else {
        set.add(language);
      }
      qs[qi] = { ...q, supportedLanguages: Array.from(set) };
      sec[si] = { ...sec[si], questions: qs };
      return { ...s, sections: sec };
    });

  const updateStarterCodeByLanguage = (si, qi, language, value) =>
    setExamForm((s) => {
      const sec = [...s.sections];
      const qs = [...sec[si].questions];
      const q = qs[qi];
      qs[qi] = {
        ...q,
        starterCodeByLanguage: {
          ...(q.starterCodeByLanguage || {}),
          [language]: value,
        },
      };
      sec[si] = { ...sec[si], questions: qs };
      return { ...s, sections: sec };
    });

  const updateCodingTestCase = (si, qi, tcIdx, key, value) =>
    setExamForm((s) => {
      const sec = [...s.sections];
      const qs = [...sec[si].questions];
      const q = qs[qi];
      const testCases = Array.isArray(q.testCases) ? [...q.testCases] : [];
      if (!testCases[tcIdx]) return s;
      testCases[tcIdx] = { ...testCases[tcIdx], [key]: value };
      qs[qi] = { ...q, testCases };
      sec[si] = { ...sec[si], questions: qs };
      return { ...s, sections: sec };
    });

  const addCodingTestCase = (si, qi) =>
    setExamForm((s) => {
      const sec = [...s.sections];
      const qs = [...sec[si].questions];
      const q = qs[qi];
      qs[qi] = {
        ...q,
        testCases: [...(q.testCases || []), { input: "", expectedOutput: "", isHidden: true }],
      };
      sec[si] = { ...sec[si], questions: qs };
      return { ...s, sections: sec };
    });

  const removeCodingTestCase = (si, qi, tcIdx) =>
    setExamForm((s) => {
      const sec = [...s.sections];
      const qs = [...sec[si].questions];
      const q = qs[qi];
      const testCases = Array.isArray(q.testCases) ? [...q.testCases] : [];
      if (testCases.length <= 1) return s;
      testCases.splice(tcIdx, 1);
      qs[qi] = { ...q, testCases };
      sec[si] = { ...sec[si], questions: qs };
      return { ...s, sections: sec };
    });

  const buildExamPayload = () => {
    const title = String(examForm.title || "").trim();
    const durationMinutes = Number(examForm.durationMinutes);
    const negativeMarkingEnabled = Boolean(examForm.negativeMarkingEnabled);
    const negativeWrongAnswersCount = Number(examForm.negativeWrongAnswersCount);
    const negativePenaltyPoints = Number(examForm.negativePenaltyPoints);
    if (!title) return { error: "Exam title is required." };
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
      return { error: "Duration must be at least 1 minute." };
    }
    if (negativeMarkingEnabled) {
      if (!Number.isInteger(negativeWrongAnswersCount) || negativeWrongAnswersCount < 1) {
        return { error: "Negative marking: wrong answers count must be an integer and at least 1." };
      }
      if (!Number.isFinite(negativePenaltyPoints) || negativePenaltyPoints < 0) {
        return { error: "Negative marking: penalty points must be 0 or more." };
      }
    }
    if (!Array.isArray(examForm.sections) || examForm.sections.length === 0) {
      return { error: "Add at least one section." };
    }

    const sections = examForm.sections.map((section, sIdx) => {
      const name = String(section?.name || "").trim();
      if (!name) throw new Error(`Section ${sIdx + 1}: section name is required.`);
      if (!Array.isArray(section.questions) || section.questions.length === 0) {
        throw new Error(`Section ${sIdx + 1}: add at least one question.`);
      }

      const questions = section.questions.map((q, qIdx) => {
        const question = String(q?.question || "").trim();
        if (!question) throw new Error(`Section ${sIdx + 1}, Q${qIdx + 1}: question text is required.`);

        const points = Number(q?.points);
        if (!Number.isInteger(points) || points < 1) {
          throw new Error(`Section ${sIdx + 1}, Q${qIdx + 1}: points must be at least 1.`);
        }

        if (q?.type === "coding") {
          const supportedLanguages = (Array.isArray(q?.supportedLanguages) ? q.supportedLanguages : [])
            .filter((lang) => CODING_LANG_OPTIONS.some((opt) => opt.value === lang));
          if (supportedLanguages.length === 0) {
            throw new Error(`Section ${sIdx + 1}, Q${qIdx + 1}: select at least one programming language.`);
          }

          const starterCodeByLanguage = {};
          supportedLanguages.forEach((lang) => {
            starterCodeByLanguage[lang] = String(q?.starterCodeByLanguage?.[lang] || "");
          });

          const testCases = (Array.isArray(q?.testCases) ? q.testCases : [])
            .map((tc) => ({
              input: String(tc?.input || ""),
              expectedOutput: String(tc?.expectedOutput || "").trim(),
              isHidden: Boolean(tc?.isHidden),
            }))
            .filter((tc) => tc.expectedOutput.length > 0);

          if (testCases.length === 0) {
            throw new Error(`Section ${sIdx + 1}, Q${qIdx + 1}: add at least one test case with expected output.`);
          }

          return {
            type: "coding",
            question,
            codeSnippet: String(q?.codeSnippet || ""),
            starterCode: String(q?.starterCode || ""),
            language: supportedLanguages[0],
            supportedLanguages,
            starterCodeByLanguage,
            testCases,
            options: [],
            correctOptionIndexes: [],
            points,
          };
        }

        const rawOptions = (q?.options || []).map((t) => ({ text: String(t || "").trim() }));
        const nonEmptyOptions = rawOptions
          .map((o, origIdx) => ({ ...o, origIdx }))
          .filter((o) => o.text);
        if (nonEmptyOptions.length < 2) {
          throw new Error(`Section ${sIdx + 1}, Q${qIdx + 1}: at least 2 options are required.`);
        }
        const options = nonEmptyOptions.map((o) => ({ text: o.text }));

        const origToNew = {};
        nonEmptyOptions.forEach((o, newIdx) => { origToNew[o.origIdx] = newIdx; });
        const correctOptionIndexes = [...new Set(
          (q?.correctIndexes || [])
            .filter((idx) => origToNew[idx] !== undefined)
            .map((idx) => origToNew[idx])
        )].sort((a, b) => a - b);
        if (correctOptionIndexes.length === 0) {
          throw new Error(`Section ${sIdx + 1}, Q${qIdx + 1}: select at least one correct answer.`);
        }

        return {
          type: q?.type === "multiple" ? "multiple" : "single",
          question,
          codeSnippet: String(q?.codeSnippet || ""),
          starterCode: "",
          language: "javascript",
          supportedLanguages: ["javascript"],
          starterCodeByLanguage: {},
          testCases: [],
          options,
          correctOptionIndexes,
          points,
        };
      });

      return { name, questions };
    });

    return {
      payload: {
        title,
        description: String(examForm.description || "").trim(),
        durationMinutes,
        sections,
        negativeMarking: {
          enabled: negativeMarkingEnabled,
          wrongAnswersCount: negativeMarkingEnabled ? negativeWrongAnswersCount : 3,
          penaltyPoints: negativeMarkingEnabled ? negativePenaltyPoints : 0.03,
        },
      },
    };
  };

  const resetExamBuilder = () => {
    setExamForm({
      ...defaultExamForm,
      sections: [{ ...emptySection, questions: [makeEmptyQuestion()] }],
    });
    setExamStep(1);
    setEditingExamId(null);
  };

  const editExam = (exam) => {
    if (!exam?._id) return;

    const mappedSections = Array.isArray(exam.sections) && exam.sections.length > 0
      ? exam.sections.map((section) => ({
          name: String(section?.name || ""),
          questions: Array.isArray(section?.questions) && section.questions.length > 0
            ? section.questions.map((q) => ({
                type: q?.type === "coding" ? "coding" : q?.type === "multiple" ? "multiple" : "single",
                question: String(q?.question || ""),
                codeSnippet: String(q?.codeSnippet || ""),
                starterCode: String(q?.starterCode || ""),
                language: q?.language === "javascript" ? "javascript" : "javascript",
                supportedLanguages: Array.isArray(q?.supportedLanguages) && q.supportedLanguages.length
                  ? q.supportedLanguages
                  : [q?.language || "javascript"],
                starterCodeByLanguage: {
                  javascript: String(q?.starterCodeByLanguage?.javascript || ""),
                  python: String(q?.starterCodeByLanguage?.python || ""),
                  c: String(q?.starterCodeByLanguage?.c || ""),
                  cpp: String(q?.starterCodeByLanguage?.cpp || ""),
                },
                testCases: Array.isArray(q?.testCases) && q.testCases.length
                  ? q.testCases.map((tc) => ({
                      input: String(tc?.input || ""),
                      expectedOutput: String(tc?.expectedOutput || ""),
                      isHidden: Boolean(tc?.isHidden),
                    }))
                  : [{ input: "", expectedOutput: "", isHidden: false }],
                options: Array.isArray(q?.options) ? q.options.map((opt) => opt?.text || "") : ["", "", "", ""],
                correctIndexes: Array.isArray(q?.correctOptionIndexes) ? [...q.correctOptionIndexes] : [],
                points: q?.points ?? 1,
              }))
            : [makeEmptyQuestion()],
        }))
      : [{ ...emptySection, questions: [makeEmptyQuestion()] }];

    setExamForm({
      title: String(exam.title || ""),
      description: String(exam.description || ""),
      durationMinutes: Number(exam.durationMinutes) || 60,
      sections: mappedSections,
      negativeMarkingEnabled: Boolean(exam?.negativeMarking?.enabled),
      negativeWrongAnswersCount: Number(exam?.negativeMarking?.wrongAnswersCount) || 3,
      negativePenaltyPoints: Number(exam?.negativeMarking?.penaltyPoints ?? 0.03),
    });
    setEditingExamId(exam._id);
    setExamStep(1);
    setActiveTab("exams");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitExam = async (e) => {
    e.preventDefault();
    try {
      const { payload, error } = buildExamPayload();
      if (error) {
        notify(error, "error");
        return;
      }

      if (editingExamId) {
        const { data } = await api.put(`/admin/exams/${editingExamId}`, payload);
        setExams((s) => s.map((item) => (item._id === editingExamId ? data : item)));
        notify("Exam updated successfully.");
      } else {
        const { data } = await api.post("/admin/exams", payload);
        setExams((s) => [data, ...s]);
        notify("Exam created successfully.");
      }

      resetExamBuilder();
    } catch (err) {
      notify(err?.response?.data?.message || err.message || "Failed to save exam.", "error");
    }
  };

  const deleteExam = async (exam) => {
    const ok = window.confirm(`Delete exam "${exam.title}"? This will also remove related assignments and results.`);
    if (!ok) return;

    await api.delete(`/admin/exams/${exam._id}`);
    setExams((s) => s.filter((item) => item._id !== exam._id));
    setAssignments((s) => s.filter((item) => item.exam?._id !== exam._id));
    setSelectedSubmission((s) => (String(s?.exam?._id || "") === String(exam._id) ? null : s));
    setAssignForm((s) => (s.examId === exam._id ? { ...s, examId: "" } : s));
    if (editingExamId === exam._id) {
      resetExamBuilder();
    }
    notify("Exam deleted successfully.");
  };

  /* ── Assignment ── */
  const submitAssignment = async (e) => {
    e.preventDefault();
    const scheduledAtIso = toIstOffsetDateTime(assignForm.scheduledAt);
    const { data } = await api.post("/admin/assignments", {
      ...assignForm,
      scheduledAt: scheduledAtIso,
      validityHours: Number(assignForm.validityHours),
    });
    setAssignments((s) => [data.assignment, ...s]);
    notify(`Exam assigned. Invite URL: ${data.inviteUrl}`);
    await loadAll();
  };

  const toggleAssignmentActivation = async (assignment) => {
    const next = !assignment.isActivated;
    const { data } = await api.patch(`/admin/assignments/${assignment._id}/activation`, { isActivated: next });
    setAssignments((s) =>
      s.map((item) => (item._id === assignment._id ? { ...item, ...data.assignment } : item))
    );
    notify(next ? "Exam activated for candidate." : "Exam deactivated for candidate.");
  };

  const deleteAssignment = async (assignment) => {
    const ok = window.confirm(`Delete scheduled exam "${assignment.exam?.title || "Exam"}" for ${assignment.candidate?.name || "candidate"}?`);
    if (!ok) return;

    await api.delete(`/admin/assignments/${assignment._id}`);
    setAssignments((s) => s.filter((item) => item._id !== assignment._id));
    setSelectedSubmission((s) => (s?.assignmentId === assignment._id ? null : s));
    notify("Assignment schedule deleted.");
  };

  /* ── Submission ── */
  const openSubmission = async (assignmentId) => {
    try {
      const { data } = await api.get(`/admin/assignments/${assignmentId}/submission`);
      setSelectedSubmission(data);
      setActiveTab("results");
    } catch {
      notify("No submission yet for this assignment.", "error");
    }
  };

  const deleteResult = async (assignment) => {
    if (!assignment?._id) {
      notify("Assignment not found for this result.", "error");
      return;
    }

    const ok = window.confirm(`Delete exam result for ${assignment.candidate?.name || "candidate"}?`);
    if (!ok) return;

    await api.delete(`/admin/assignments/${assignment._id}/submission`);
    setAssignments((s) =>
      s.map((item) =>
        item._id === assignment._id
          ? { ...item, status: item.startedAt ? "in_progress" : "scheduled", result: null, submittedAt: null }
          : item
      )
    );
    setSelectedSubmission((s) => {
      const selectedAssignmentId = s?.assignmentId || s?.assignment;
      return String(selectedAssignmentId || "") === String(assignment._id) ? null : s;
    });
    notify("Exam result deleted.");
  };

  const getInviteUrl = (assignment) => {
    if (!assignment?.inviteToken) return "";
    return `${window.location.origin}/candidate/invite/${assignment.inviteToken}`;
  };

  const copyInviteUrl = async (assignment) => {
    const inviteUrl = getInviteUrl(assignment);
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      notify("Invite URL copied.");
    } catch {
      notify("Unable to copy invite URL.", "error");
    }
  };

  /* ── Nav helper ── */
  const goTo = (id) => { setActiveTab(id); setSidebarOpen(false); };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans">

      {/* ── Sidebar overlay (mobile) ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ══ SIDEBAR ══════════════════════════════════════════════ */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900 transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-700/60 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
            <Icon d={ICONS.exams} className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold text-white tracking-tight">ExamPortal</span>
          <button className="ml-auto lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <Icon d={ICONS.close} className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Main menu</p>
          {NAV.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => goTo(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-brand-500 text-white shadow-sm shadow-brand-500/40"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon d={item.icon} className="h-5 w-5 shrink-0" />
                {item.label}
                {item.id === "results" && selectedSubmission && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">1</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="shrink-0 border-t border-slate-700/60 p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
          >
            <Icon d={ICONS.logout} className="h-5 w-5 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ══ MAIN ═════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* ── Header ── */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-5 shadow-sm">
          <button className="lg:hidden text-slate-500 hover:text-slate-800" onClick={() => setSidebarOpen(true)}>
            <Icon d={ICONS.menu} className="h-6 w-6" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-800">
              {NAV.find((n) => n.id === activeTab)?.label ?? "Dashboard"}
            </span>
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3">
            {/* Stats pills */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                {candidates.length} candidates
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {completedCount} completed
              </span>
            </div>
            {/* Avatar */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
              A
            </div>
          </div>
        </header>

        {/* ── Toast ── */}
        {message.text && (
          <div className={`mx-4 mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${
            message.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}>
            <Icon d={message.type === "error" ? ICONS.x : ICONS.check} className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{message.text}</span>
            <button onClick={() => setMessage({ text: "", type: "info" })} className="opacity-60 hover:opacity-100">
              <Icon d={ICONS.close} className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Content ── */}
        <main className="flex-1 overflow-y-auto p-5 md:p-7">

          {/* ════ OVERVIEW ════ */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <SectionHeader title="Dashboard Overview" subtitle="Summary of your exam platform activity" />

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total Candidates" value={candidates.length}  icon={ICONS.candidates} color="bg-brand-500" />
                <StatCard label="Total Exams"      value={exams.length}       icon={ICONS.exams}      color="bg-violet-500" />
                <StatCard label="Assignments"      value={assignments.length} icon={ICONS.assign}     color="bg-amber-500" />
                <StatCard label="Completed"        value={completedCount}     icon={ICONS.results}    color="bg-emerald-500" />
              </div>

              {/* Recent assignments */}
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-200/60">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <div>
                    <p className="font-semibold text-slate-800">Recent Assignments</p>
                    <p className="text-xs text-slate-500 mt-0.5">Latest exam assignments across all candidates</p>
                  </div>
                  <button onClick={() => goTo("assign")} className="text-xs font-semibold text-brand-500 hover:text-brand-700">
                    + New assignment
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
                        <th className="px-6 py-3">Candidate</th>
                        <th className="px-6 py-3">Exam</th>
                        <th className="px-6 py-3">Scheduled</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Score</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {assignments.slice(0, 6).map((a) => (
                        <tr key={a._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3 font-medium text-slate-800">{a.candidate?.name || "-"}</td>
                          <td className="px-6 py-3 text-slate-600">{a.exam?.title || "-"}</td>
                          <td className="px-6 py-3 text-slate-500">{formatInIndiaTime(a.scheduledAt)}</td>
                          <td className="px-6 py-3"><StatusBadge status={a.status} /></td>
                          <td className="px-6 py-3 text-slate-600">
                            {a.result
                              ? `${a.result.score} (${a.result.correctCount}/${a.result.totalQuestions})${a.result.penaltyApplied ? ` · -${a.result.penaltyApplied}` : ""}`
                              : "—"}
                          </td>
                          <td className="px-6 py-3">
                            <button onClick={() => openSubmission(a._id)} className="flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-700 transition">
                              <Icon d={ICONS.eye} className="h-3.5 w-3.5" /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                      {assignments.length === 0 && (
                        <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">No assignments yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════ CANDIDATES ════ */}
          {activeTab === "candidates" && (
            <div className="space-y-6">
              <SectionHeader title="Candidates" subtitle="Register new candidates and view existing ones" />
              <div className="grid gap-6 xl:grid-cols-2">

                {/* Create form */}
                <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-200/60 p-6">
                  <p className="mb-5 font-semibold text-slate-800">Add New Candidate</p>
                  <form onSubmit={submitCandidate} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full Name">
                        <input className={inputCls} placeholder="Jane Doe" value={candidateForm.name} onChange={(e) => setCandidateForm((s) => ({ ...s, name: e.target.value }))} />
                      </Field>
                      <Field label="Email">
                        <input className={inputCls} type="email" placeholder="jane@example.com" value={candidateForm.email} onChange={(e) => setCandidateForm((s) => ({ ...s, email: e.target.value }))} />
                      </Field>
                      <Field label="Phone">
                        <input className={inputCls} placeholder="+1 555 0000" value={candidateForm.phone} onChange={(e) => setCandidateForm((s) => ({ ...s, phone: e.target.value }))} />
                      </Field>
                      <Field label="Company">
                        <input className={inputCls} placeholder="Acme Corp" value={candidateForm.company} onChange={(e) => setCandidateForm((s) => ({ ...s, company: e.target.value }))} />
                      </Field>
                    </div>
                    <Field label="Additional Details">
                      <textarea className={`${inputCls} min-h-24 resize-none`} placeholder="Notes, position, etc." value={candidateForm.details} onChange={(e) => setCandidateForm((s) => ({ ...s, details: e.target.value }))} />
                    </Field>
                    <button className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 hover:bg-brand-700 transition">
                      <Icon d={ICONS.plus} className="h-4 w-4" /> Save Candidate
                    </button>
                  </form>
                </div>

                {/* List */}
                <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-200/60 overflow-hidden">
                  <div className="border-b border-slate-100 px-6 py-4">
                    <p className="font-semibold text-slate-800">All Candidates <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{candidates.length}</span></p>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-[460px] overflow-y-auto">
                    {candidates.map((c) => (
                      <div key={c._id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                          {c.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-800 text-sm">{c.name}</p>
                          <p className="truncate text-xs text-slate-500">{c.email}{c.company ? ` · ${c.company}` : ""}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteCandidate(c)}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                    {candidates.length === 0 && (
                      <p className="px-6 py-10 text-center text-sm text-slate-400">No candidates yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ EXAMS ════ */}
          {activeTab === "exams" && (
            <div className="space-y-6">
              <SectionHeader
                title={editingExamId ? "Edit Exam" : "Create Exam"}
                subtitle={`Build section-wise exams · ${examPreviewQuestionCount} question${examPreviewQuestionCount !== 1 ? "s" : ""} so far`}
              />
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 1, label: "Step 1: Details" },
                  { id: 2, label: "Step 2: Sections & Questions" },
                  { id: 3, label: "Step 3: Review & Save" }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setExamStep(s.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${examStep === s.id ? "bg-brand-500 text-white" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <form onSubmit={submitExam} className="space-y-5">
                {/* Meta */}
                {examStep === 1 ? (
                <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-200/60 p-6 space-y-4">
                  <p className="font-semibold text-slate-800 mb-1">Exam Details</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Exam Title">
                      <input className={inputCls} placeholder="e.g. JavaScript Assessment" value={examForm.title} onChange={(e) => setExamForm((s) => ({ ...s, title: e.target.value }))} />
                    </Field>
                    <Field label="Duration (minutes)">
                      <input className={inputCls} type="number" min="1" placeholder="60" value={examForm.durationMinutes} onChange={(e) => setExamForm((s) => ({ ...s, durationMinutes: e.target.value }))} />
                    </Field>
                  </div>
                  <Field label="Description">
                    <textarea className={`${inputCls} min-h-20 resize-none`} placeholder="Short description of the exam" value={examForm.description} onChange={(e) => setExamForm((s) => ({ ...s, description: e.target.value }))} />
                  </Field>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(examForm.negativeMarkingEnabled)}
                        onChange={(e) => setExamForm((s) => ({ ...s, negativeMarkingEnabled: e.target.checked }))}
                      />
                      Enable negative marking
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Wrong answers per penalty">
                        <input
                          className={inputCls}
                          type="number"
                          min="1"
                          value={examForm.negativeWrongAnswersCount}
                          disabled={!examForm.negativeMarkingEnabled}
                          onChange={(e) => setExamForm((s) => ({ ...s, negativeWrongAnswersCount: e.target.value }))}
                        />
                      </Field>
                      <Field label="Penalty points">
                        <input
                          className={inputCls}
                          type="number"
                          min="0"
                          step="0.01"
                          value={examForm.negativePenaltyPoints}
                          disabled={!examForm.negativeMarkingEnabled}
                          onChange={(e) => setExamForm((s) => ({ ...s, negativePenaltyPoints: e.target.value }))}
                        />
                      </Field>
                    </div>
                    <p className="text-xs text-slate-500">
                      Example: if wrong answers per penalty is 3 and penalty points is 0.03, then every 3 wrong answers deducts 0.03.
                    </p>
                  </div>
                </div>
                ) : null}

                {/* Sections */}
                {examStep === 2 ? examForm.sections.map((section, sIdx) => (
                  <div key={`section-${sIdx}`} className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-200/60 p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">
                        {sIdx + 1}
                      </span>
                      <input
                        className={`${inputCls} flex-1`}
                        placeholder={`Section ${sIdx + 1} name (e.g. Core Concepts)`}
                        value={section.name}
                        onChange={(e) => updateSection(sIdx, "name", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeSection(sIdx)}
                        disabled={examForm.sections.length <= 1}
                        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Remove Section
                      </button>
                    </div>

                    <div className="space-y-4">
                      {section.questions.map((q, qIdx) => (
                        <div key={`q-${sIdx}-${qIdx}`} className="rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
                          {/* Question header bar */}
                          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
                              {qIdx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-600">Question {qIdx + 1}</span>
                            <div className="ml-auto flex items-center gap-2">
                              {/* Type toggle */}
                              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
                                {[
                                  { value: "single",   label: "Single" },
                                  { value: "multiple", label: "Multiple" },
                                  { value: "coding",   label: "Coding" },
                                ].map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => changeQuestionType(sIdx, qIdx, opt.value)}
                                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                                      q.type === opt.value
                                        ? "bg-brand-500 text-white shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                              {/* Points */}
                              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1">
                                <span className="text-[11px] text-slate-500 font-medium">Pts:</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={q.points}
                                  onChange={(e) => updateQuestion(sIdx, qIdx, "points", e.target.value)}
                                  className="w-10 text-center text-xs font-bold text-slate-800 focus:outline-none bg-transparent"
                                />
                              </div>
                              {/* Remove */}
                              <button
                                type="button"
                                onClick={() => removeQuestion(sIdx, qIdx)}
                                disabled={section.questions.length <= 1}
                                className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className="p-4 space-y-4">
                            {/* Question text */}
                            <div className="space-y-1.5">
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Question</label>
                              <textarea
                                className={`${inputCls} resize-none`}
                                rows={2}
                                placeholder="Write the question here…"
                                value={q.question}
                                onChange={(e) => updateQuestion(sIdx, qIdx, "question", e.target.value)}
                              />
                            </div>

                            {/* Code snippet */}
                            <div className="space-y-1.5">
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                                Code Snippet <span className="font-normal normal-case text-slate-400">(optional)</span>
                              </label>
                              <textarea
                                className={`${inputCls} min-h-20 resize-y font-mono text-xs`}
                                placeholder={"e.g.\nconst arr = [1, 2, 3];\nconsole.log(arr.map(x => x * 2));"}
                                value={q.codeSnippet}
                                onChange={(e) => updateQuestion(sIdx, qIdx, "codeSnippet", e.target.value)}
                              />
                            </div>

                            {q.type === "coding" && (
                              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="space-y-2">
                                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Supported Languages
                                  </label>
                                  <div className="flex flex-wrap gap-2">
                                    {CODING_LANG_OPTIONS.map((lang) => {
                                      const selected = (q.supportedLanguages || []).includes(lang.value);
                                      return (
                                        <button
                                          key={lang.value}
                                          type="button"
                                          onClick={() => toggleCodingLanguage(sIdx, qIdx, lang.value)}
                                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                            selected
                                              ? "border-brand-500 bg-brand-500 text-white"
                                              : "border-slate-300 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600"
                                          }`}
                                        >
                                          {lang.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Starter Code By Language
                                  </label>
                                  {(q.supportedLanguages || []).map((lang) => (
                                    <div key={lang} className="space-y-1.5">
                                      <p className="text-[11px] font-semibold text-slate-600">
                                        {CODING_LANG_OPTIONS.find((o) => o.value === lang)?.label || lang}
                                      </p>
                                      <textarea
                                        className={`${inputCls} min-h-24 resize-y font-mono text-xs`}
                                        placeholder={`Starter code for ${lang}`}
                                        value={q?.starterCodeByLanguage?.[lang] || ""}
                                        onChange={(e) => updateStarterCodeByLanguage(sIdx, qIdx, lang, e.target.value)}
                                      />
                                    </div>
                                  ))}
                                </div>

                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                                      Test Cases
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => addCodingTestCase(sIdx, qIdx)}
                                      className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                                    >
                                      + Add Test Case
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    {(q.testCases || []).map((testCase, tcIdx) => (
                                      <div key={tcIdx} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <p className="text-xs font-semibold text-slate-600">Case {tcIdx + 1}</p>
                                          <button
                                            type="button"
                                            onClick={() => removeCodingTestCase(sIdx, qIdx, tcIdx)}
                                            className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                        <textarea
                                          className={`${inputCls} min-h-16 resize-y font-mono text-xs`}
                                          placeholder="Input (stdin)"
                                          value={testCase.input || ""}
                                          onChange={(e) => updateCodingTestCase(sIdx, qIdx, tcIdx, "input", e.target.value)}
                                        />
                                        <textarea
                                          className={`${inputCls} min-h-16 resize-y font-mono text-xs`}
                                          placeholder="Expected output"
                                          value={testCase.expectedOutput || ""}
                                          onChange={(e) => updateCodingTestCase(sIdx, qIdx, tcIdx, "expectedOutput", e.target.value)}
                                        />
                                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(testCase.isHidden)}
                                            onChange={(e) => updateCodingTestCase(sIdx, qIdx, tcIdx, "isHidden", e.target.checked)}
                                          />
                                          Hidden test case
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Answer options */}
                            {q.type !== "coding" && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                                  Answer Options
                                </label>
                                <span className="text-[10px] text-slate-400">
                                  {q.type === "single"
                                    ? "Click the circle to mark the correct answer"
                                    : "Click circles to mark all correct answers"}
                                </span>
                              </div>

                              <div className="space-y-2">
                                {q.options.map((opt, optIdx) => {
                                  const letter = String.fromCharCode(65 + optIdx);
                                  const isCorrect = q.correctIndexes.includes(optIdx);
                                  return (
                                    <div
                                      key={optIdx}
                                      className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 transition-all ${
                                        isCorrect
                                          ? "border-emerald-400 bg-emerald-50"
                                          : "border-slate-200 bg-white hover:border-slate-300"
                                      }`}
                                    >
                                      {/* Correct toggle button */}
                                      <button
                                        type="button"
                                        onClick={() => toggleCorrect(sIdx, qIdx, optIdx)}
                                        title={isCorrect ? "Remove correct answer" : "Mark as correct"}
                                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                                          isCorrect
                                            ? "border-emerald-500 bg-emerald-500 text-white"
                                            : "border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50"
                                        }`}
                                      >
                                        {isCorrect && (
                                          <Icon d="M5 13l4 4L19 7" className="h-3.5 w-3.5" />
                                        )}
                                      </button>

                                      {/* Option letter badge */}
                                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                                        isCorrect
                                          ? "bg-emerald-500 text-white"
                                          : "bg-slate-100 text-slate-500"
                                      }`}>
                                        {letter}
                                      </span>

                                      {/* Option text input */}
                                      <input
                                        className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
                                        placeholder={`Option ${letter}`}
                                        value={opt}
                                        onChange={(e) => updateOption(sIdx, qIdx, optIdx, e.target.value)}
                                      />

                                      {/* Correct label */}
                                      {isCorrect && (
                                        <span className="shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                          Correct
                                        </span>
                                      )}

                                      {/* Remove option */}
                                      {q.options.length > 2 && (
                                        <button
                                          type="button"
                                          onClick={() => removeOption(sIdx, qIdx, optIdx)}
                                          className="shrink-0 text-slate-300 hover:text-rose-500 transition"
                                          title="Remove this option"
                                        >
                                          <Icon d="M6 18L18 6M6 6l12 12" className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Add option */}
                              {q.options.length < 6 && (
                                <button
                                  type="button"
                                  onClick={() => addOption(sIdx, qIdx)}
                                  className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-500 hover:text-brand-700 transition"
                                >
                                  <Icon d="M12 4v16m8-8H4" className="h-3.5 w-3.5" />
                                  Add Option
                                </button>
                              )}

                              {/* Helper hint */}
                              {q.correctIndexes.length === 0 && (
                                <p className="mt-1 text-[11px] text-amber-600 font-medium">
                                  ⚠ No correct answer selected yet
                                </p>
                              )}
                            </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button type="button" onClick={() => addQuestion(sIdx)}
                      className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600 transition w-full justify-center">
                      <Icon d={ICONS.plus} className="h-4 w-4" /> Add Question
                    </button>
                  </div>
                )) : null}

                {examStep === 3 ? (
                  <div className="rounded-2xl bg-white border border-slate-100 p-6 shadow-sm shadow-slate-200/60">
                    <p className="font-semibold text-slate-800">Review Exam</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <p><span className="font-semibold text-slate-800">Title:</span> {examForm.title || "—"}</p>
                      <p><span className="font-semibold text-slate-800">Duration:</span> {examForm.durationMinutes} minutes</p>
                      <p><span className="font-semibold text-slate-800">Sections:</span> {examForm.sections.length}</p>
                      <p><span className="font-semibold text-slate-800">Total Questions:</span> {examPreviewQuestionCount}</p>
                      <p>
                        <span className="font-semibold text-slate-800">Negative Marking:</span>{" "}
                        {examForm.negativeMarkingEnabled
                          ? `Enabled (${examForm.negativePenaltyPoints} per ${examForm.negativeWrongAnswersCount} wrong answers)`
                          : "Disabled"}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  {examStep === 2 ? (
                    <button type="button" onClick={addSection}
                      className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-600 transition">
                      <Icon d={ICONS.plus} className="h-4 w-4" /> Add Section
                    </button>
                  ) : null}

                  {examStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setExamStep((s) => Math.max(1, s - 1))}
                      className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      Back
                    </button>
                  ) : null}

                  {examStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => setExamStep((s) => Math.min(3, s + 1))}
                      className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 transition hover:bg-brand-700"
                    >
                      Next
                    </button>
                  ) : (
                    <button className="flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 hover:bg-brand-700 transition">
                      <Icon d={ICONS.check} className="h-4 w-4" /> {editingExamId ? "Update Exam" : "Save Exam"}
                    </button>
                  )}
                  {editingExamId ? (
                    <button
                      type="button"
                      onClick={resetExamBuilder}
                      className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      Cancel Edit
                    </button>
                  ) : null}
                </div>
              </form>

              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-200/60 overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4">
                  <p className="font-semibold text-slate-800">
                    Existing Exams <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{exams.length}</span>
                  </p>
                </div>
                <div className="divide-y divide-slate-50 max-h-[360px] overflow-y-auto">
                  {exams.map((ex) => (
                    <div key={ex._id} className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50/60 transition-colors">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{ex.title}</p>
                        <p className="text-xs text-slate-500">{ex.durationMinutes} min · {ex.sections?.length || 0} sections</p>
                        <p className="text-xs text-slate-500">
                          Negative marking: {ex?.negativeMarking?.enabled ? `${ex.negativeMarking.penaltyPoints} per ${ex.negativeMarking.wrongAnswersCount} wrong answers` : "Disabled"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => editExam(ex)}
                          className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
                        >
                          Edit Exam
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteExam(ex)}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          Delete Exam
                        </button>
                      </div>
                    </div>
                  ))}
                  {exams.length === 0 && (
                    <p className="px-6 py-10 text-center text-sm text-slate-400">No exams created yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════ ASSIGN ════ */}
          {activeTab === "assign" && (
            <div className="space-y-6">
              <SectionHeader title="Assign Exam" subtitle="Schedule an exam and send an invite to a candidate" />

              <div className="grid gap-6 xl:grid-cols-2">
                {/* Form */}
                <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-200/60 p-6">
                  <p className="mb-5 font-semibold text-slate-800">New Assignment</p>
                  <form onSubmit={submitAssignment} className="space-y-4">
                    <Field label="Candidate">
                      <select className={inputCls} value={assignForm.candidateId} onChange={(e) => setAssignForm((s) => ({ ...s, candidateId: e.target.value }))}>
                        <option value="">Select a candidate…</option>
                        {candidates.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.email})</option>)}
                      </select>
                    </Field>
                    <Field label="Exam">
                      <select className={inputCls} value={assignForm.examId} onChange={(e) => setAssignForm((s) => ({ ...s, examId: e.target.value }))}>
                        <option value="">Select an exam…</option>
                        {exams.map((ex) => <option key={ex._id} value={ex._id}>{ex.title}</option>)}
                      </select>
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Scheduled at">
                        <input className={inputCls} type="datetime-local" value={assignForm.scheduledAt} onChange={(e) => setAssignForm((s) => ({ ...s, scheduledAt: e.target.value }))} />
                      </Field>
                      <Field label="Validity (hours)">
                        <input className={inputCls} type="number" min="1" value={assignForm.validityHours} onChange={(e) => setAssignForm((s) => ({ ...s, validityHours: e.target.value }))} />
                      </Field>
                    </div>
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 hover:bg-brand-700 transition">
                      <Icon d={ICONS.mail} className="h-4 w-4" /> Assign + Send Invite Mail
                    </button>
                  </form>
                </div>

                {/* All assignments */}
                <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-200/60 overflow-hidden">
                  <div className="border-b border-slate-100 px-6 py-4">
                    <p className="font-semibold text-slate-800">All Assignments <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{assignments.length}</span></p>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-[460px] overflow-y-auto">
                    {assignments.map((a) => (
                      <div key={a._id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-800 text-sm">{a.candidate?.name || "—"}</p>
                          <p className="truncate text-xs text-slate-500">{a.exam?.title || "—"}</p>
                          {a.inviteToken ? (
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              <a
                                href={getInviteUrl(a)}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-brand-600 hover:text-brand-700"
                              >
                                Exam link
                              </a>
                              <button
                                type="button"
                                onClick={() => copyInviteUrl(a)}
                                className="font-semibold text-slate-500 hover:text-slate-700"
                              >
                                Copy link
                              </button>
                            </div>
                          ) : null}
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                            <Icon d={ICONS.clock} className="h-3.5 w-3.5" />
                            {formatInIndiaTime(a.scheduledAt)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <StatusBadge status={a.status} />
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.isActivated ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {a.isActivated ? "Activated" : "Not activated"}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleAssignmentActivation(a)}
                            disabled={["completed", "expired"].includes(a.status)}
                            className="text-xs font-semibold text-amber-600 transition hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {a.isActivated ? "Deactivate" : "Activate"}
                          </button>
                          <button onClick={() => openSubmission(a._id)} className="text-xs font-semibold text-brand-500 hover:text-brand-700 transition">
                            View result →
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAssignment(a)}
                            className="text-xs font-semibold text-rose-600 transition hover:text-rose-700"
                          >
                            Delete schedule
                          </button>
                        </div>
                      </div>
                    ))}
                    {assignments.length === 0 && (
                      <p className="px-6 py-10 text-center text-sm text-slate-400">No assignments yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════ RESULTS ════ */}
          {activeTab === "results" && (
            <div className="space-y-6">
              <SectionHeader title="Results" subtitle="Detailed submission review" />

              {/* All assignments table */}
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-200/60 overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4">
                  <p className="font-semibold text-slate-800">
                    Candidate Results <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{rankedResults.length}</span>
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
                        <th className="px-6 py-3">Candidate</th>
                        <th className="px-6 py-3">Exam</th>
                        <th className="px-6 py-3">Scheduled</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Score</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rankedResults.map((a) => (
                        <tr key={a._id} className={`hover:bg-slate-50/60 transition-colors ${selectedSubmission?.assignmentId === a._id ? "bg-brand-50" : ""}`}>
                          <td className="px-6 py-3 font-medium text-slate-800">{a.candidate?.name || "—"}</td>
                          <td className="px-6 py-3 text-slate-600">{a.exam?.title || "—"}</td>
                          <td className="px-6 py-3 text-slate-500">{formatInIndiaTime(a.scheduledAt)}</td>
                          <td className="px-6 py-3"><StatusBadge status={a.status} /></td>
                          <td className="px-6 py-3 font-semibold text-slate-700">
                            {a.result
                              ? `${a.result.score} (${a.result.correctCount}/${a.result.totalQuestions})${a.result.penaltyApplied ? ` · -${a.result.penaltyApplied}` : ""}`
                              : "—"}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <button onClick={() => openSubmission(a._id)} className="flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-700 transition">
                                <Icon d={ICONS.eye} className="h-3.5 w-3.5" /> View
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteResult(a)}
                                className="text-xs font-semibold text-rose-600 transition hover:text-rose-700"
                              >
                                Delete Result
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {rankedResults.length === 0 && (
                        <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">No candidate results yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Submission detail */}
              {selectedSubmission && (
                <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-200/60 p-6 space-y-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">Submission Detail</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {selectedSubmission.candidate?.name}
                      </p>
                    </div>
                    <div className="flex gap-4 text-center">
                      <div className="rounded-xl bg-brand-50 px-4 py-2">
                        <p className="text-lg font-bold text-brand-700">{selectedSubmission.score}</p>
                        <p className="text-xs text-brand-500">Score</p>
                      </div>
                      <div className="rounded-xl bg-amber-50 px-4 py-2">
                        <p className="text-lg font-bold text-amber-700">{selectedSubmission.penaltyApplied || 0}</p>
                        <p className="text-xs text-amber-500">Negative</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 px-4 py-2">
                        <p className="text-lg font-bold text-emerald-700">{selectedSubmission.correctCount}</p>
                        <p className="text-xs text-emerald-500">Correct</p>
                      </div>
                      <div className="rounded-xl bg-rose-50 px-4 py-2">
                        <p className="text-lg font-bold text-rose-700">{selectedSubmission.wrongCount}</p>
                        <p className="text-xs text-rose-500">Wrong</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        deleteResult(
                          assignments.find((a) => String(a._id) === String(selectedSubmission.assignmentId || selectedSubmission.assignment))
                        )
                      }
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      Delete Result
                    </button>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto rounded-xl border border-slate-100 p-1">
                    {selectedSubmission.answers.map((ans, idx) => (
                      <div key={idx} className={`rounded-xl px-4 py-3 text-sm ${
                        ans.questionType === "coding"
                          ? "bg-slate-50 text-slate-900"
                          : ans.isCorrect
                            ? "bg-emerald-50 text-emerald-900"
                            : "bg-rose-50 text-rose-900"
                      }`}>
                        {(() => {
                          const section = selectedSubmission.exam?.sections?.[ans.sectionIndex];
                          const question = section?.questions?.[ans.questionIndex];
                          const isCoding = (ans.questionType || question?.type) === "coding";
                          const selectedIndexes = Array.isArray(ans.selectedOptionIndexes) ? ans.selectedOptionIndexes : [];
                          const selectedTexts = selectedIndexes.map((optIdx) => question?.options?.[optIdx]?.text || `Option ${optIdx}`);
                          const correctIndexes = Array.isArray(question?.correctOptionIndexes) ? question.correctOptionIndexes : [];
                          const correctTexts = correctIndexes.map((optIdx) => question?.options?.[optIdx]?.text || `Option ${optIdx}`);

                          return (
                            <>
                              <div className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                          ans.questionType === "coding"
                            ? "bg-slate-500"
                            : ans.isCorrect
                              ? "bg-emerald-500"
                              : "bg-rose-500"
                        }`}>
                          {ans.questionType === "coding" ? ">" : ans.isCorrect ? "✓" : "✗"}
                        </span>
                                <div className="min-w-0 space-y-1">
                                  <p className="font-semibold">
                                    {section?.name || `Section ${ans.sectionIndex + 1}`} · Q{ans.questionIndex + 1}
                                  </p>
                                  <p className="text-slate-800">{question?.question || "Question text unavailable"}</p>
                                  {isCoding ? (
                                    <>
                                      <p>
                                        <span className="font-semibold">Language:</span>{" "}
                                        {ans.selectedLanguage || "javascript"}
                                      </p>
                                      <p>
                                        <span className="font-semibold">Test Cases:</span>{" "}
                                        {Number(ans.testCasesPassed || 0)} / {Number(ans.testCasesTotal || 0)} passed
                                      </p>
                                      <p>
                                        <span className="font-semibold">Submitted Code:</span>{" "}
                                        {ans.submittedCode ? "Provided" : "Not answered"}
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p>
                                        <span className="font-semibold">Selected Answer:</span>{" "}
                                        {selectedTexts.length ? selectedTexts.join(" | ") : "Not answered"}
                                      </p>
                                      <p>
                                        <span className="font-semibold">Correct Answer:</span>{" "}
                                        {correctTexts.length ? correctTexts.join(" | ") : "Not available"}
                                      </p>
                                    </>
                                  )}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>

                  {selectedSubmission.feedback && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <span className="font-semibold">Feedback:</span> {selectedSubmission.feedback.rating}/5 · {selectedSubmission.feedback.comment || "No comment"}
                    </div>
                  )}
                </div>
              )}

              {!selectedSubmission && (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
                  <Icon d={ICONS.results} className="h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-500">Select an assignment above to view its submission</p>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
