require('dotenv').config();
const express   = require('express');
const bcrypt    = require('bcrypt');
const jwt       = require('jsonwebtoken');
const db = (process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'undefined' && process.env.SUPABASE_URL.startsWith('http') && process.env.SUPABASE_SERVICE_KEY)
  ? require('./db_pg')
  : require('./db');
const { sendOTPEmail } = require('./mailer');

const router = express.Router();
const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'transitops_jwt_secret_default_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'transitops_jwt_refresh_default_key_2026';

const VALID_ROLES = ['fleet_manager', 'driver', 'safety_officer', 'financial_analyst', 'dispatcher'];

// ─────────────────────────────────────────────
// PASSWORD STRENGTH VALIDATOR
// ─────────────────────────────────────────────
function isStrongPassword(pw) {
  return (
    pw.length >= 8 &&
    /[A-Z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}

// ─────────────────────────────────────────────
// JWT HELPERS
// ─────────────────────────────────────────────
function issueAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function issueRefreshToken(user) {
  return jwt.sign(
    { userId: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

// ─────────────────────────────────────────────
// POST /api/auth/signup
// ─────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role selected.' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character.'
    });
  }

  try {
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.createUser({
      email,
      password_hash,
      name,
      role,
      phone: phone || null,
      is_verified: false,
      fail_count: 0
    });

    const otp = await db.createOTP(email, 'signup');
    await sendOTPEmail(email, otp, 'signup');

    res.status(201).json({ message: 'Account created. Check your email for the verification code.' });
  } catch (err) {
    console.error('[SIGNUP ERROR]', err);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/verify-otp  (signup verification)
// ─────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

  try {
    const valid = await db.verifyOTP(email, otp, 'signup');
    if (!valid) return res.status(400).json({ error: 'Invalid or expired code. Please request a new one.' });

    const user = await db.getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await db.updateUser(user.id, { is_verified: true });
    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error('[VERIFY OTP ERROR]', err);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/resend-otp
// ─────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  const { email, purpose } = req.body;
  if (!email || !purpose) return res.status(400).json({ error: 'Email and purpose are required.' });

  try {
    const otp = await db.createOTP(email, purpose);
    await sendOTPEmail(email, otp, purpose);
    res.json({ message: 'A new code has been sent to your email.' });
  } catch (err) {
    console.error('[RESEND OTP ERROR]', err);
    res.status(500).json({ error: 'Failed to resend code.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  try {
    const user = await db.getUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check account freeze
    if (user.frozen_until && new Date(user.frozen_until) > new Date()) {
      return res.status(423).json({
        error: 'Account locked after too many failed attempts.',
        frozen: true,
        frozen_until: user.frozen_until
      });
    }

    // Check verified
    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Please verify your email first. Check your inbox for the verification code.',
        unverified: true,
        email: user.email
      });
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const updated = await db.recordFailedLogin(email);
      const remaining = Math.max(0, 5 - (updated?.fail_count || 0));
      if (updated?.frozen_until) {
        return res.status(423).json({
          error: 'Account locked after 5 failed attempts. Check your email to unlock.',
          frozen: true
        });
      }
      return res.status(401).json({
        error: `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`
      });
    }

    // Reset fail count on success
    await db.resetFailCount(user.id);

    // Issue tokens
    const accessToken  = issueAccessToken(user);
    const refreshToken = issueRefreshToken(user);
    await db.setRefreshToken(user.id, refreshToken);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id:    user.id,
        email: user.email,
        name:  user.name,
        role:  user.role,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required.' });

  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await db.getUserById(payload.userId);

    if (!user || user.refresh_token !== refreshToken) {
      return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }

    const newAccessToken  = issueAccessToken(user);
    const newRefreshToken = issueRefreshToken(user);
    await db.setRefreshToken(user.id, newRefreshToken);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      await db.clearRefreshToken(payload.userId);
    } catch (_) { /* token already invalid — fine */ }
  }
  res.json({ message: 'Logged out successfully.' });
});

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const user = await db.getUserByEmail(email);
    // Always return success to prevent email enumeration
    if (user) {
      const otp = await db.createOTP(email, 'reset');
      await sendOTPEmail(email, otp, 'reset');
    }
    res.json({ message: 'If that email exists, a reset code has been sent.' });
  } catch (err) {
    console.error('[FORGOT PASSWORD ERROR]', err);
    res.status(500).json({ error: 'Failed to send reset code.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters with an uppercase letter, number, and special character.'
    });
  }

  try {
    const valid = await db.verifyOTP(email, otp, 'reset');
    if (!valid) return res.status(400).json({ error: 'Invalid or expired code.' });

    const user = await db.getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.updateUser(user.id, { password_hash, fail_count: 0, frozen_until: null });

    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    console.error('[RESET PASSWORD ERROR]', err);
    res.status(500).json({ error: 'Password reset failed.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/request-unfreeze  (send OTP to unlock frozen account)
// ─────────────────────────────────────────────
router.post('/request-unfreeze', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const user = await db.getUserByEmail(email);
    if (user) {
      const otp = await db.createOTP(email, 'unfreeze');
      await sendOTPEmail(email, otp, 'unfreeze');
    }
    res.json({ message: 'If that account exists, an unlock code has been sent to your email.' });
  } catch (err) {
    console.error('[UNFREEZE REQUEST ERROR]', err);
    res.status(500).json({ error: 'Failed to send unlock code.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/unfreeze  (verify OTP + force password reset to unlock)
// ─────────────────────────────────────────────
router.post('/unfreeze', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters with an uppercase letter, number, and special character.'
    });
  }

  try {
    const valid = await db.verifyOTP(email, otp, 'unfreeze');
    if (!valid) return res.status(400).json({ error: 'Invalid or expired unlock code.' });

    const user = await db.getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.updateUser(user.id, {
      password_hash,
      fail_count:   0,
      frozen_until: null
    });

    res.json({ message: 'Account unlocked and password updated. You can now log in.' });
  } catch (err) {
    console.error('[UNFREEZE ERROR]', err);
    res.status(500).json({ error: 'Account unlock failed.' });
  }
});

module.exports = router;
