const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, default: "" },
    expectedOutput: { type: String, required: true, trim: true },
    isHidden: { type: Boolean, default: true }
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["single", "multiple", "coding"], default: "single" },
    question: { type: String, required: true, trim: true },
    codeSnippet: { type: String, trim: true, default: "" },
    starterCode: { type: String, trim: true, default: "" }, // backwards compatibility
    language: { type: String, enum: ["javascript", "python", "c", "cpp"], default: "javascript" }, // backwards compatibility
    supportedLanguages: {
      type: [String],
      enum: ["javascript", "python", "c", "cpp"],
      default: ["javascript"],
      validate: {
        validator(value) {
          if (this.type !== "coding") return true;
          return Array.isArray(value) && value.length >= 1;
        },
        message: "At least one language is required for coding questions"
      }
    },
    starterCodeByLanguage: {
      type: Map,
      of: String,
      default: {}
    },
    testCases: {
      type: [testCaseSchema],
      default: [],
      validate: {
        validator(value) {
          if (this.type !== "coding") return true;
          return Array.isArray(value) && value.length >= 1;
        },
        message: "At least one test case is required for coding questions"
      }
    },
    options: {
      type: [optionSchema],
      default: [],
      validate: {
        validator(value) {
          if (this.type === "coding") return true;
          return Array.isArray(value) && value.length >= 2;
        },
        message: "At least 2 options required"
      }
    },
    correctOptionIndexes: {
      type: [Number],
      default: [],
      validate: {
        validator(value) {
          if (this.type === "coding") return true;
          return Array.isArray(value) && value.length >= 1;
        },
        message: "At least 1 correct option required"
      }
    },
    points: { type: Number, default: 1, min: 1 }
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    questions: { type: [questionSchema], default: [] }
  },
  { _id: false }
);

const negativeMarkingSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    wrongAnswersCount: {
      type: Number,
      default: 3,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "wrongAnswersCount must be an integer"
      }
    },
    penaltyPoints: { type: Number, default: 0.03, min: 0 }
  },
  { _id: false }
);

const examSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    durationMinutes: { type: Number, required: true, min: 1 },
    sections: { type: [sectionSchema], default: [] },
    negativeMarking: { type: negativeMarkingSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Exam", examSchema);
