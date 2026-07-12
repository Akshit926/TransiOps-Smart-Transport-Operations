require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

/**
 * Send a TransitOps OTP email
 * @param {string} toEmail
 * @param {string} otp
 * @param {'signup'|'reset'|'unfreeze'} purpose
 */
async function sendOTPEmail(toEmail, otp, purpose) {
  const subjects = {
    signup:   'TransitOps — Verify Your Account',
    reset:    'TransitOps — Password Reset Code',
    unfreeze: 'TransitOps — Account Unlock Code'
  };
  const intros = {
    signup:   'Welcome! Please verify your email address to activate your TransitOps account.',
    reset:    'We received a request to reset your password.',
    unfreeze: 'Your account has been locked due to too many failed login attempts. Use the code below to unlock it.'
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',sans-serif;background:#0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:40px 20px;">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:32px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                    🚚 TransitOps
                  </h1>
                  <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Smart Transport Operations Platform</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:36px 40px;">
                  <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;">${intros[purpose]}</p>
                  <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">Your verification code is:</p>
                  <!-- OTP Box -->
                  <div style="background:#0f172a;border:2px solid #3b82f6;border-radius:12px;padding:24px;text-align:center;margin:16px 0;">
                    <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#3b82f6;font-family:monospace;">
                      ${otp}
                    </span>
                  </div>
                  <p style="margin:0;color:#64748b;font-size:12px;text-align:center;">
                    ⏱ This code expires in <strong style="color:#f59e0b;">5 minutes</strong> and can only be used once.
                  </p>
                  <hr style="border:none;border-top:1px solid #334155;margin:28px 0;">
                  <p style="margin:0;color:#64748b;font-size:12px;">
                    If you didn't request this, you can safely ignore this email. Your account remains secure.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#0f172a;padding:20px 40px;text-align:center;">
                  <p style="margin:0;color:#475569;font-size:11px;">© 2024 TransitOps · All rights reserved</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"TransitOps System" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: subjects[purpose],
    html
  });
}

/**
 * Send a compliance reminder email for expired/expiring driver license
 */
async function sendComplianceReminder(toEmail, driverName, licenseNumber, licenseCategory, expiryDate) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;font-family:'Segoe UI',sans-serif;background:#0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:40px 20px;">
            <table width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background:linear-gradient(135deg,#ef4444,#f97316);padding:32px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">⚠️ License Expiry Alert</h1>
                  <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">TransitOps Compliance System</p>
                </td>
              </tr>
              <tr>
                <td style="padding:32px 40px;">
                  <p style="margin:0 0 16px;color:#cbd5e1;font-size:15px;">Hello <strong>${driverName}</strong>,</p>
                  <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;">
                    Our compliance records show your commercial driver license requires immediate attention:
                  </p>
                  <table width="100%" cellpadding="12" style="background:#0f172a;border-radius:8px;border:1px solid #334155;">
                    <tr><td style="color:#64748b;font-size:12px;">LICENSE NUMBER</td><td style="color:#f1f5f9;font-weight:600;">${licenseNumber}</td></tr>
                    <tr><td style="color:#64748b;font-size:12px;">CATEGORY</td><td style="color:#f1f5f9;font-weight:600;">${licenseCategory}</td></tr>
                    <tr><td style="color:#64748b;font-size:12px;">EXPIRY DATE</td><td style="color:#ef4444;font-weight:700;">${expiryDate}</td></tr>
                  </table>
                  <p style="margin:20px 0 0;color:#94a3b8;font-size:14px;">
                    Please submit your renewed license to the Safety Officer immediately to remain on the active dispatch roster.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#0f172a;padding:16px 40px;text-align:center;">
                  <p style="margin:0;color:#475569;font-size:11px;">© 2024 TransitOps · Automated Compliance System</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"TransitOps Compliance" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `URGENT: License Expiry Notification — ${driverName}`,
    html
  });
}

module.exports = { sendOTPEmail, sendComplianceReminder };
