/**
 * @file authController.js
 * @description Officer registration, authentication and profile management controller.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { execute } = require('../database/connection');
const { JWT_SECRET } = require('../middleware/auth');

/**
 * Officer registration.
 * Parameterized queries protect against SQL injection.
 */
exports.register = async (req, res, next) => {
  try {
    const { badge_number, full_name, email, password, department, rank_designation, role } = req.body;

    // Check for existing badge or email
    const [existingBadge] = await execute('SELECT officer_id FROM officers WHERE badge_number = ?', [badge_number]);
    if (existingBadge.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'BADGE_ALREADY_REGISTERED',
          message: `Badge number ${badge_number} is already registered in the system.`
        }
      });
    }

    const [existingEmail] = await execute('SELECT officer_id FROM officers WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_REGISTERED',
          message: `Email ${email} is already associated with an existing officer profile.`
        }
      });
    }

    // Cryptographic hash with salt rounds 12
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);
    const officerRole = role || 'INVESTIGATOR';

    const [result] = await execute(
      `INSERT INTO officers (badge_number, full_name, email, password_hash, department, rank_designation, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [badge_number, full_name, email, password_hash, department, rank_designation, officerRole]
    );

    const officerId = result.insertId;

    const token = jwt.sign(
      {
        officer_id: officerId,
        badge_number,
        full_name,
        role: officerRole,
        department
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        officer: {
          officer_id: officerId,
          badge_number,
          full_name,
          email,
          department,
          rank_designation,
          role: officerRole
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Officer login.
 */
exports.login = async (req, res, next) => {
  try {
    const { badge_number, password } = req.body;

    const [rows] = await execute(
      'SELECT officer_id, badge_number, full_name, email, password_hash, department, rank_designation, role, is_active FROM officers WHERE badge_number = ?',
      [badge_number]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid badge number or password combination.'
        }
      });
    }

    const officer = rows[0];

    if (!officer.is_active) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Officer credentials have been suspended or deactivated.'
        }
      });
    }

    // Secure comparison
    const passwordMatch = await bcrypt.compare(password, officer.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid badge number or password combination.'
        }
      });
    }

    const token = jwt.sign(
      {
        officer_id: officer.officer_id,
        badge_number: officer.badge_number,
        full_name: officer.full_name,
        role: officer.role,
        department: officer.department
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      data: {
        token,
        officer: {
          officer_id: officer.officer_id,
          badge_number: officer.badge_number,
          full_name: officer.full_name,
          email: officer.email,
          department: officer.department,
          rank_designation: officer.rank_designation,
          role: officer.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Officer profile retrieval.
 */
exports.getProfile = async (req, res, next) => {
  try {
    const [rows] = await execute(
      'SELECT officer_id, badge_number, full_name, email, department, rank_designation, role, created_at FROM officers WHERE officer_id = ?',
      [req.officer.officer_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'OFFICER_NOT_FOUND', message: 'Officer record not found in system directory.' }
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    next(error);
  }
};
