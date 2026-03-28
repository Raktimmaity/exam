const express = require("express");

const Assignment = require("../models/Assignment");
const Candidate = require("../models/Candidate");
const Submission = require("../models/Submission");
const { runCode, evaluateCodeAgainstTestCases } = require("../utils/codeRunner");

const router = express.Router();

function getWindow(assignment, exam) {
  const scheduledAtMs = new Date(assignment.scheduledAt).getTime();
  const windowByValidityMs = scheduledAtMs + assignment.validityHours * 60 * 60 * 1000;
  const windowByExamMs = scheduledAtMs + exam.durationMinutes * 60 * 1000;
  return {
    startMs: scheduledAtMs,
    endMs: Math.min(windowByValidityMs, windowByExamMs)
  };
}

function sanitizeExam(exam) {
  return {
    _id: exam._id,
    title: exam.title,
    description: exam.description,
    durationMinutes: exam.durationMinutes,
    sections: exam.sections.map((s) => ({
      name: s.name,
      questions: s.questions.map((q) => ({
        type: q.type,
        question: q.question,
        codeSnippet: q.codeSnippet || "",
        starterCode: q.starterCode || "",
        language: q.language || "javascript",
        supportedLanguages: Array.isArray(q.supportedLanguages) && q.supportedLanguages.length
          ? q.supportedLanguages
          : [q.language || "javascript"],
        starterCodeByLanguage:
          q.starterCodeByLanguage && typeof q.starterCodeByLanguage.entries === "function"
            ? Object.fromEntries(q.starterCodeByLanguage.entries())
            : q.starterCodeByLanguage || {},
        publicTestCases: (q.testCases || [])
          .filter((tc) => !tc.isHidden)
          .map((tc) => ({
            input: tc.input || "",
            expectedOutput: tc.expectedOutput || ""
          })),
        options: q.options || []
      }))
    }))
  };
}

function parseCodingSubmission(rawValue, question) {
  const fallbackLanguage = (Array.isArray(question.supportedLanguages) && question.supportedLanguages[0]) ||
    question.language ||
    "javascript";

  if (typeof rawValue === "string") {
    return { language: fallbackLanguage, code: rawValue };
  }

  if (rawValue && typeof rawValue === "object") {
    const selectedLanguage = String(rawValue.language || fallbackLanguage);
    const supported = Array.isArray(question.supportedLanguages) && question.supportedLanguages.length
      ? question.supportedLanguages
      : [fallbackLanguage];
    const language = supported.includes(selectedLanguage) ? selectedLanguage : fallbackLanguage;
    return {
      language,
      code: String(rawValue.code || "")
    };
  }

  return { language: fallbackLanguage, code: "" };
}

function scoreExam(exam, submittedAnswers, codingAnswers = {}) {
  const flatAnswers = [];
  let rawScore = 0;
  let totalQuestions = 0;
  let correctCount = 0;
  let wrongCount = 0;

  exam.sections.forEach((section, sectionIndex) => {
    section.questions.forEach((question, questionIndex) => {
      if (question.type === "coding") {
        totalQuestions += 1;
        const key = `${sectionIndex}-${questionIndex}`;
        const parsed = parseCodingSubmission(codingAnswers[key], question);
        const testCases = Array.isArray(question.testCases) ? question.testCases : [];
        const evaluated = evaluateCodeAgainstTestCases(parsed.language, parsed.code, testCases);
        const isCorrect = evaluated.allPassed;

        if (isCorrect) {
          correctCount += 1;
          rawScore += question.points;
        } else {
          wrongCount += 1;
        }

        flatAnswers.push({
          sectionIndex,
          questionIndex,
          questionType: "coding",
          selectedOptionIndexes: [],
          submittedCode: parsed.code,
          selectedLanguage: parsed.language,
          testCasesPassed: evaluated.passedCount,
          testCasesTotal: evaluated.totalCount,
          isCorrect,
          pointsEarned: isCorrect ? question.points : 0
        });
        return;
      }

      totalQuestions += 1;

      const userAnswer =
        Array.isArray(submittedAnswers?.[sectionIndex]?.[questionIndex])
          ? submittedAnswers[sectionIndex][questionIndex]
          : [];

      const normalizedUser = [...new Set(userAnswer.map(Number))].sort((a, b) => a - b);
      const normalizedCorrect = [...question.correctOptionIndexes].sort((a, b) => a - b);
      const isCorrect =
        normalizedUser.length === normalizedCorrect.length &&
        normalizedUser.every((value, idx) => value === normalizedCorrect[idx]);

      if (isCorrect) {
        correctCount += 1;
        rawScore += question.points;
      } else {
        wrongCount += 1;
      }

      flatAnswers.push({
        sectionIndex,
        questionIndex,
        questionType: question.type === "multiple" ? "multiple" : "single",
        selectedOptionIndexes: normalizedUser,
        submittedCode: "",
        selectedLanguage: "javascript",
        testCasesPassed: 0,
        testCasesTotal: 0,
        isCorrect,
        pointsEarned: isCorrect ? question.points : 0
      });
    });
  });

  const negativeConfig = exam?.negativeMarking || {};
  const wrongAnswersCount = Number(negativeConfig.wrongAnswersCount) || 3;
  const penaltyPoints = Number(negativeConfig.penaltyPoints);
  const negativeEnabled = Boolean(negativeConfig.enabled);
  const penaltyUnit = Number.isFinite(penaltyPoints) ? Math.max(0, penaltyPoints) : 0;
  const penaltyApplied =
    negativeEnabled && wrongAnswersCount > 0
      ? Math.floor(wrongCount / wrongAnswersCount) * penaltyUnit
      : 0;
  const score = Math.max(0, Number((rawScore - penaltyApplied).toFixed(2)));

  return {
    answers: flatAnswers,
    rawScore: Number(rawScore.toFixed(2)),
    penaltyApplied: Number(penaltyApplied.toFixed(2)),
    score,
    totalQuestions,
    correctCount,
    wrongCount
  };
}

async function getAssignmentWithExam(token) {
  return Assignment.findOne({ inviteToken: token }).populate("candidate").populate("exam");
}

router.post("/login", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    const candidate = await Candidate.findOne({
      email: email.trim().toLowerCase()
    }).lean();

    if (!candidate) {
      return res.status(401).json({ message: "Invalid candidate email" });
    }

    const now = Date.now();
    const assignments = await Assignment.find({ candidate: candidate._id })
      .populate("exam", "title durationMinutes")
      .sort({ scheduledAt: -1 })
      .lean();

    return res.json({
      candidate: {
        id: candidate._id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone
      },
      assignments: assignments.map((a) => ({
        ...(function getTiming() {
          if (!a.exam?.durationMinutes) {
            return { canStart: false, secondsToStart: 0 };
          }
          const { startMs, endMs } = getWindow(a, a.exam);
          return {
            canStart: Boolean(a.isActivated && now >= startMs && now <= endMs),
            secondsToStart: Math.max(0, Math.floor((startMs - now) / 1000))
          };
        })(),
        id: a._id,
        examTitle: a.exam?.title || "Exam",
        scheduledAt: a.scheduledAt,
        status: a.status,
        isActivated: Boolean(a.isActivated),
        inviteToken: a.inviteToken
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/invite/:token", async (req, res) => {
  try {
    const assignment = await getAssignmentWithExam(req.params.token);
    if (!assignment) return res.status(404).json({ message: "Invalid invite link" });

    const now = Date.now();
    const { startMs, endMs } = getWindow(assignment, assignment.exam);

    if (now > endMs && assignment.status !== "completed") {
      assignment.status = "expired";
      await assignment.save();
    }

    const canStart =
      Boolean(assignment.isActivated) &&
      now >= startMs &&
      now <= endMs &&
      !["completed", "expired"].includes(assignment.status);

    return res.json({
      candidate: {
        name: assignment.candidate.name,
        email: assignment.candidate.email
      },
      exam: {
        title: assignment.exam.title,
        durationMinutes: assignment.exam.durationMinutes
      },
      scheduledAt: assignment.scheduledAt,
      validityHours: assignment.validityHours,
      status: assignment.status,
      isActivated: Boolean(assignment.isActivated),
      serverTime: new Date(now),
      canStart,
      secondsToStart: Math.max(0, Math.floor((startMs - now) / 1000)),
      secondsToEnd: Math.max(0, Math.floor((endMs - now) / 1000))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/invite/:token/verify", async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ message: "name, email and phone are required" });
    }

    const assignment = await getAssignmentWithExam(req.params.token);
    if (!assignment) return res.status(404).json({ message: "Invalid invite link" });

    const c = assignment.candidate;
    const valid =
      c.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      c.email.trim().toLowerCase() === email.trim().toLowerCase() &&
      c.phone.trim() === phone.trim();

    if (!valid) {
      return res.status(401).json({ message: "Candidate details do not match records" });
    }

    return res.json({ verified: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/invite/:token/start", async (req, res) => {
  try {
    const assignment = await getAssignmentWithExam(req.params.token);
    if (!assignment) return res.status(404).json({ message: "Invalid invite link" });

    const now = Date.now();
    const { startMs, endMs } = getWindow(assignment, assignment.exam);

    if (!assignment.isActivated) {
      return res.status(400).json({ message: "Exam is not activated by admin yet" });
    }

    if (now < startMs) {
      return res.status(400).json({
        message: "Exam has not started yet",
        secondsToStart: Math.floor((startMs - now) / 1000)
      });
    }

    if (now > endMs) {
      assignment.status = "expired";
      await assignment.save();
      return res.status(400).json({ message: "Exam window expired" });
    }

    if (assignment.status === "completed") {
      return res.status(400).json({ message: "Exam already submitted" });
    }

    if (!assignment.startedAt) {
      assignment.startedAt = new Date(now);
      assignment.status = "in_progress";
      await assignment.save();
    }

    return res.json({
      exam: sanitizeExam(assignment.exam),
      startedAt: assignment.startedAt,
      endsAt: new Date(endMs)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/invite/:token/run-code", async (req, res) => {
  try {
    const { sectionIndex, questionIndex, code, language, input = "" } = req.body;
    const assignment = await getAssignmentWithExam(req.params.token);
    if (!assignment) return res.status(404).json({ message: "Invalid invite link" });

    const now = Date.now();
    const { startMs, endMs } = getWindow(assignment, assignment.exam);
    if (!assignment.isActivated || now < startMs || now > endMs) {
      return res.status(400).json({ message: "Exam is not currently active" });
    }

    const sIdx = Number(sectionIndex);
    const qIdx = Number(questionIndex);
    if (!Number.isInteger(sIdx) || !Number.isInteger(qIdx)) {
      return res.status(400).json({ message: "Invalid question reference" });
    }

    const question = assignment.exam?.sections?.[sIdx]?.questions?.[qIdx];
    if (!question || question.type !== "coding") {
      return res.status(404).json({ message: "Coding question not found" });
    }

    const supportedLanguages = Array.isArray(question.supportedLanguages) && question.supportedLanguages.length
      ? question.supportedLanguages
      : [question.language || "javascript"];
    const selectedLanguage = String(language || supportedLanguages[0]);
    if (!supportedLanguages.includes(selectedLanguage)) {
      return res.status(400).json({ message: "Unsupported language for this question" });
    }

    const result = runCode(selectedLanguage, code, String(input || ""));
    if (!result.ok) {
      return res.status(400).json({
        message: result.stderr || "Code execution failed",
        output: result.stdout || ""
      });
    }

    return res.json({ output: result.stdout || "(no output)" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/invite/:token/submit", async (req, res) => {
  try {
    const { answers, codingAnswers } = req.body;
    const assignment = await getAssignmentWithExam(req.params.token);
    if (!assignment) return res.status(404).json({ message: "Invalid invite link" });

    const existing = await Submission.findOne({ assignment: assignment._id });
    if (existing) return res.status(400).json({ message: "Exam already submitted" });

    const now = Date.now();
    const { endMs } = getWindow(assignment, assignment.exam);
    if (now > endMs) {
      assignment.status = "expired";
      await assignment.save();
      return res.status(400).json({ message: "Exam window expired" });
    }

    const result = scoreExam(assignment.exam, answers || [], codingAnswers || {});

    const submission = await Submission.create({
      assignment: assignment._id,
      candidate: assignment.candidate._id,
      exam: assignment.exam._id,
      ...result,
      submittedAt: new Date(now)
    });

    assignment.status = "completed";
    assignment.submittedAt = submission.submittedAt;
    await assignment.save();

    return res.json({
      message: "Exam submitted successfully",
      submissionId: submission._id,
      result: {
        rawScore: submission.rawScore,
        penaltyApplied: submission.penaltyApplied,
        score: submission.score,
        totalQuestions: submission.totalQuestions,
        correctCount: submission.correctCount,
        wrongCount: submission.wrongCount
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/invite/:token/feedback", async (req, res) => {
  try {
    const { rating, comment = "" } = req.body;
    const assignment = await Assignment.findOne({ inviteToken: req.params.token });
    if (!assignment) return res.status(404).json({ message: "Invalid invite link" });

    const submission = await Submission.findOne({ assignment: assignment._id });
    if (!submission) return res.status(400).json({ message: "Submission not found" });

    submission.feedback = { rating: Number(rating) || null, comment };
    await submission.save();

    return res.json({
      message: "Thank you for exam. Your result will be published soon."
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
