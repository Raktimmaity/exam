const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    sectionIndex: { type: Number, required: true },
    questionIndex: { type: Number, required: true },
    questionType: { type: String, enum: ["single", "multiple", "coding"], default: "single" },
    selectedOptionIndexes: { type: [Number], default: [] },
    submittedCode: { type: String, default: "" },
    selectedLanguage: { type: String, enum: ["javascript", "python", "c", "cpp"], default: "javascript" },
    testCasesPassed: { type: Number, default: 0 },
    testCasesTotal: { type: Number, default: 0 },
    isCorrect: { type: Boolean, required: true },
    pointsEarned: { type: Number, default: 0 }
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true, unique: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    answers: { type: [answerSchema], default: [] },
    rawScore: { type: Number, default: 0 },
    penaltyApplied: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    feedback: {
      rating: { type: Number, min: 1, max: 5, default: null },
      comment: { type: String, trim: true, default: "" }
    },
    submittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Submission", submissionSchema);
