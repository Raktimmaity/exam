const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

  transporter = hasSmtp
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      })
    : nodemailer.createTransport({ jsonTransport: true });

  return transporter;
}

async function sendInviteMail({ to, candidateName, examTitle, scheduledAt, validityHours, inviteUrl }) {
  const t = getTransporter();
  const from = process.env.MAIL_FROM || "no-reply@exam-system.local";
  const localDate = new Date(scheduledAt).toLocaleString();

  const info = await t.sendMail({
    from,
    to,
    subject: `Your exam is scheduled: ${examTitle}`,
    text: [
      `Hi ${candidateName},`,
      "",
      `Your exam "${examTitle}" is scheduled at ${localDate}.`,
      `This exam link stays valid for ${validityHours} hour(s) after scheduled time.`,
      `Exam link: ${inviteUrl}`,
      "",
      "If you open before start time, you will see a countdown.",
      "Good luck!"
    ].join("\n")
  });

  if (info.message) {
    console.log("Mail preview:", info.message.toString());
  }

  return info;
}

module.exports = {
  sendInviteMail
};
