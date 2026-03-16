const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

/**
 * Send a generic email.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[Email] Email credentials not configured. Skipping email send.');
    return null;
  }

  try {
    const info = await getTransporter().sendMail({
      from: `"IntelliClass" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    });
    return info;
  } catch (err) {
    console.error('[Email] Failed to send email:', err.message);
    return null;
  }
};

/**
 * Notify a learner that new homework has been assigned.
 */
const notifyHomeworkAssigned = async (learnerEmail, learnerName, homeworkTitle, dueDate) => {
  const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString('en-ZA') : 'No due date';
  return sendEmail({
    to: learnerEmail,
    subject: `New Homework: ${homeworkTitle}`,
    html: `
      <h2>New Homework Assigned</h2>
      <p>Hi ${learnerName},</p>
      <p>Your teacher has assigned new homework: <strong>${homeworkTitle}</strong></p>
      <p><strong>Due Date:</strong> ${dueDateStr}</p>
      <p>Log in to IntelliClass to view and submit your work.</p>
    `,
    text: `Hi ${learnerName}, new homework assigned: ${homeworkTitle}. Due: ${dueDateStr}.`,
  });
};

/**
 * Notify a teacher that homework has been submitted.
 */
const notifyHomeworkSubmitted = async (teacherEmail, teacherName, learnerName, homeworkTitle) => {
  return sendEmail({
    to: teacherEmail,
    subject: `Homework Submitted: ${homeworkTitle}`,
    html: `
      <h2>Homework Submission</h2>
      <p>Hi ${teacherName},</p>
      <p><strong>${learnerName}</strong> has submitted their homework: <strong>${homeworkTitle}</strong></p>
      <p>Log in to IntelliClass to review and grade the submission.</p>
    `,
    text: `Hi ${teacherName}, ${learnerName} submitted homework: ${homeworkTitle}.`,
  });
};

/**
 * Notify a learner of their quiz result.
 */
const notifyQuizResult = async (learnerEmail, learnerName, quizTitle, score, total, percentage) => {
  return sendEmail({
    to: learnerEmail,
    subject: `Quiz Result: ${quizTitle}`,
    html: `
      <h2>Quiz Result</h2>
      <p>Hi ${learnerName},</p>
      <p>You completed the quiz: <strong>${quizTitle}</strong></p>
      <p><strong>Score:</strong> ${score}/${total} (${percentage}%)</p>
      <p>Log in to IntelliClass to view detailed results.</p>
    `,
    text: `Hi ${learnerName}, quiz result for ${quizTitle}: ${score}/${total} (${percentage}%).`,
  });
};

module.exports = { sendEmail, notifyHomeworkAssigned, notifyHomeworkSubmitted, notifyQuizResult };
