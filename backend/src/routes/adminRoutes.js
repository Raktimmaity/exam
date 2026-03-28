const express = require("express");

const adminAuth = require("../middleware/adminAuth");
const Candidate = require("../models/Candidate");
const Exam = require("../models/Exam");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const makeToken = require("../utils/token");
const { sendInviteMail } = require("../utils/mailer");

const router = express.Router();

router.use(adminAuth);

router.post("/candidates", async (req, res) => {
  try {
    const { name, email, phone, company = "", details = "" } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ message: "name, email and phone are required" });
    }

    const existing = await Candidate.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Candidate with this email already exists" });
    }

    const candidate = await Candidate.create({
      name,
      email: email.toLowerCase(),
      phone,
      company,
      details
    });

    return res.status(201).json(candidate);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/candidates", async (_req, res) => {
  try {
    const candidates = await Candidate.find().sort({ createdAt: -1 });
    return res.json(candidates);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/candidates/:id", async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    const assignments = await Assignment.find({ candidate: candidate._id }).select("_id").lean();
    const assignmentIds = assignments.map((a) => a._id);

    await Promise.all([
      Submission.deleteMany({
        $or: [{ candidate: candidate._id }, { assignment: { $in: assignmentIds } }]
      }),
      Assignment.deleteMany({ candidate: candidate._id })
    ]);

    await Candidate.deleteOne({ _id: candidate._id });

    return res.json({
      message: "Candidate deleted",
      deleted: {
        candidateId: candidate._id,
        assignments: assignmentIds.length
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/exams", async (req, res) => {
  try {
    const { title, description = "", durationMinutes, sections = [], negativeMarking = {} } = req.body;
    if (!title || !durationMinutes) {
      return res.status(400).json({ message: "title and durationMinutes are required" });
    }

    const exam = await Exam.create({
      title,
      description,
      durationMinutes,
      sections,
      negativeMarking
    });

    return res.status(201).json(exam);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message });
  }
});

router.get("/exams", async (_req, res) => {
  try {
    const exams = await Exam.find().sort({ createdAt: -1 });
    return res.json(exams);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/exams/:id", async (req, res) => {
  try {
    const { title, description = "", durationMinutes, sections = [], negativeMarking = {} } = req.body;
    if (!title || !durationMinutes) {
      return res.status(400).json({ message: "title and durationMinutes are required" });
    }

    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    exam.title = title;
    exam.description = description;
    exam.durationMinutes = durationMinutes;
    exam.sections = sections;
    exam.negativeMarking = negativeMarking;

    await exam.save();
    return res.json(exam);
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/exams/:id", async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const assignments = await Assignment.find({ exam: exam._id }).select("_id").lean();
    const assignmentIds = assignments.map((a) => a._id);

    await Promise.all([
      Submission.deleteMany({
        $or: [{ exam: exam._id }, { assignment: { $in: assignmentIds } }]
      }),
      Assignment.deleteMany({ exam: exam._id }),
      Exam.deleteOne({ _id: exam._id })
    ]);

    return res.json({
      message: "Exam deleted",
      deleted: {
        examId: exam._id,
        assignments: assignmentIds.length
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/assignments", async (req, res) => {
  try {
    const { candidateId, examId, scheduledAt, validityHours = 2 } = req.body;

    if (!candidateId || !examId || !scheduledAt) {
      return res.status(400).json({ message: "candidateId, examId and scheduledAt are required" });
    }

    const [candidate, exam] = await Promise.all([
      Candidate.findById(candidateId),
      Exam.findById(examId)
    ]);

    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const assignment = await Assignment.create({
      candidate: candidate._id,
      exam: exam._id,
      scheduledAt: new Date(scheduledAt),
      validityHours,
      isActivated: false,
      inviteToken: makeToken(20)
    });

    const inviteUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/candidate/invite/${assignment.inviteToken}`;

    await sendInviteMail({
      to: candidate.email,
      candidateName: candidate.name,
      examTitle: exam.title,
      scheduledAt: assignment.scheduledAt,
      validityHours: assignment.validityHours,
      inviteUrl
    });

    return res.status(201).json({
      assignment,
      inviteUrl,
      message: "Exam assigned and invitation mail sent"
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch("/assignments/:id/activation", async (req, res) => {
  try {
    const { isActivated } = req.body;
    if (typeof isActivated !== "boolean") {
      return res.status(400).json({ message: "isActivated must be boolean" });
    }

    const assignment = await Assignment.findById(req.params.id)
      .populate("candidate", "name email phone")
      .populate("exam", "title durationMinutes");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    if (assignment.status === "completed" || assignment.status === "expired") {
      return res.status(400).json({ message: `Cannot change activation for ${assignment.status} assignment` });
    }

    assignment.isActivated = isActivated;
    await assignment.save();

    return res.json({
      message: isActivated ? "Exam activated for candidate" : "Exam deactivated for candidate",
      assignment
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/assignments/:id", async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    await Promise.all([
      Submission.deleteMany({ assignment: assignment._id }),
      Assignment.deleteOne({ _id: assignment._id })
    ]);

    return res.json({ message: "Assignment schedule deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/assignments", async (_req, res) => {
  try {
    const assignments = await Assignment.find()
      .populate("candidate", "name email phone")
      .populate("exam", "title durationMinutes")
      .sort({ createdAt: -1 })
      .lean();

    const assignmentIds = assignments.map((a) => a._id);
    const submissions = await Submission.find({ assignment: { $in: assignmentIds } }).lean();
    const byAssignment = new Map(submissions.map((s) => [String(s.assignment), s]));

    const data = assignments.map((a) => {
      const submission = byAssignment.get(String(a._id));
      return {
        ...a,
        result: submission
          ? {
              rawScore: submission.rawScore,
              penaltyApplied: submission.penaltyApplied,
              score: submission.score,
              totalQuestions: submission.totalQuestions,
              correctCount: submission.correctCount,
              wrongCount: submission.wrongCount,
              submittedAt: submission.submittedAt
            }
          : null
      };
    });

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/assignments/:id/submission", async (req, res) => {
  try {
    const submission = await Submission.findOne({ assignment: req.params.id })
      .populate("candidate", "name email phone company details")
      .populate("exam", "title sections")
      .lean();

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    return res.json(submission);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/assignments/:id/submission", async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id).populate("exam", "durationMinutes");
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const deleted = await Submission.findOneAndDelete({ assignment: assignment._id });
    if (!deleted) {
      return res.status(404).json({ message: "Submission not found" });
    }

    assignment.submittedAt = null;
    assignment.status = assignment.startedAt ? "in_progress" : "scheduled";
    await assignment.save();

    return res.json({
      message: "Exam result deleted",
      assignment: {
        _id: assignment._id,
        status: assignment.status,
        submittedAt: assignment.submittedAt,
        result: null
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
