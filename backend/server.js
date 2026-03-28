require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDb = require("./src/config/db");
const seedAdmin = require("./src/utils/seedAdmin");

const adminAuthRoutes = require("./src/routes/adminAuthRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const candidateRoutes = require("./src/routes/candidateRoutes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "Exam management API running" });
});

app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/candidate", candidateRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDb();
    await seedAdmin();
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Startup error:", error.message);
    process.exit(1);
  }
})();
