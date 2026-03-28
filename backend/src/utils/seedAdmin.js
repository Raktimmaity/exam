const Admin = require("../models/Admin");
const { hashPassword } = require("./password");

module.exports = async function seedAdmin() {
  const seedEmail = (process.env.ADMIN_SEED_EMAIL || "admin@company.com").toLowerCase();
  const seedPassword = process.env.ADMIN_SEED_PASSWORD || "Admin@123";

  const existing = await Admin.findOne({ email: seedEmail });
  if (existing) return;

  await Admin.create({
    name: "System Admin",
    email: seedEmail,
    password: hashPassword(seedPassword)
  });

  console.log(`Seed admin created (${seedEmail})`);
};
