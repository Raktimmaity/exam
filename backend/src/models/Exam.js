const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["single", "multiple"], default: "single" },
    question: { type: String, required: true, trim: true },
    codeSnippet: { type: String, trim: true, default: "" },
    options: { type: [optionSchema], validate: [(v) => v.length >= 2, "At least 2 options required"] },
    correctOptionIndexes: {
      type: [Number],
      validate: [(v) => v.length >= 1, "At least 1 correct option required"]
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
