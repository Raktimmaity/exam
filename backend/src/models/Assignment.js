const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    scheduledAt: { type: Date, required: true },
    validityHours: { type: Number, default: 2, min: 1 },
    isActivated: { type: Boolean, default: false },
    inviteToken: { type: String, required: true, unique: true },
    startedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "expired"],
      default: "scheduled"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Assignment", assignmentSchema);
