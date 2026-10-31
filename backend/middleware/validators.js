/**
 * @file validators.js
 * @description Input validation and sanitization rules for forensic integrity.
 */

const { validationResult, body, param, query } = require('express-validator');

/**
 * Middleware that checks validation results and returns a structured 400 response on failure.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload or query parameters.',
        details: errors.array().map(e => ({
          field: e.path || e.param,
          message: e.msg,
          value: e.value
        }))
      }
    });
  }
  next();
}

const officerRegisterRules = [
  body('badge_number').trim().notEmpty().withMessage('Badge number is required.'),
  body('full_name').trim().notEmpty().withMessage('Full legal name is required.'),
  body('email').trim().isEmail().withMessage('Valid official email address is required.'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.'),
  body('department').trim().notEmpty().withMessage('Department unit is required.'),
  body('rank_designation').trim().notEmpty().withMessage('Rank designation is required.'),
  body('role')
    .optional()
    .isIn(['INVESTIGATOR', 'SENIOR_DETECTIVE', 'LEAD_OFFICER', 'ADMIN'])
    .withMessage('Invalid system role.')
];

const officerLoginRules = [
  body('badge_number').trim().notEmpty().withMessage('Badge number is required.'),
  body('password').notEmpty().withMessage('Password is required.')
];

const createCaseRules = [
  body('case_number').trim().notEmpty().withMessage('Case file number is required.'),
  body('title').trim().notEmpty().withMessage('Case incident title is required.'),
  body('incident_date').notEmpty().withMessage('Incident date/time is required.'),
  body('incident_location').trim().notEmpty().withMessage('Incident location is required.'),
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .withMessage('Priority must be LOW, MEDIUM, HIGH, or CRITICAL.')
];

const addEvidenceRules = [
  body('case_id').isInt({ min: 1 }).withMessage('Valid case ID integer required.'),
  body('tracking_code').trim().notEmpty().withMessage('Evidence tracking code is required.'),
  body('title').trim().notEmpty().withMessage('Evidence title is required.'),
  body('category')
    .isIn([
      'CCTV',
      'PHONE_RECORD',
      'VEHICLE',
      'PHYSICAL',
      'DIGITAL',
      'FORENSIC_BIO',
      'DOCUMENT',
      'LOCATION',
      'FINANCIAL',
      'WEAPON',
      'TESTIMONY_TRANSCRIPT'
    ])
    .withMessage('Invalid evidence category.'),
  body('description').trim().notEmpty().withMessage('Evidence description is required.'),
  body('source').trim().notEmpty().withMessage('Evidence provenance/source is required.'),
  body('verification_status')
    .optional()
    .isIn(['CONFIRMED_FACT', 'UNVERIFIED_OBSERVATION', 'HYPOTHESIS'])
    .withMessage('Verification status must be CONFIRMED_FACT, UNVERIFIED_OBSERVATION, or HYPOTHESIS.'),
  body('reliability_assessment')
    .optional()
    .isIn(['HIGH', 'MEDIUM', 'LOW', 'QUESTIONABLE', 'PENDING_LAB'])
    .withMessage('Reliability assessment must be HIGH, MEDIUM, LOW, QUESTIONABLE, or PENDING_LAB.')
];

const addSuspectRules = [
  body('full_name').trim().notEmpty().withMessage('Suspect full name is required.'),
  body('status')
    .optional()
    .isIn(['PERSON_OF_INTEREST', 'PRIMARY_SUSPECT', 'EXONERATED', 'ARRESTED', 'FUGITIVE'])
    .withMessage('Invalid suspect status classification.')
];

const addVictimRules = [
  body('full_name').trim().notEmpty().withMessage('Victim full name is required.'),
  body('condition_status')
    .optional()
    .isIn(['SAFE', 'INJURED', 'DECEASED', 'MISSING', 'RECOVERED'])
    .withMessage('Invalid victim condition status.')
];

const addWitnessRules = [
  body('full_name').trim().notEmpty().withMessage('Witness full name is required.'),
  body('statement').trim().notEmpty().withMessage('Witness statement is required.'),
  body('credibility_score')
    .optional()
    .isFloat({ min: 0.0, max: 1.0 })
    .withMessage('Credibility score must be a decimal between 0.00 and 1.00.')
];

const addTimelineRules = [
  body('event_timestamp').notEmpty().withMessage('Event timestamp is required.'),
  body('event_title').trim().notEmpty().withMessage('Event title is required.'),
  body('entity_type')
    .isIn(['SUSPECT', 'VICTIM', 'WITNESS', 'EVIDENCE', 'INCIDENT', 'OFFICER_ACTION'])
    .withMessage('Invalid timeline entity type.'),
  body('entity_id').isInt({ min: 1 }).withMessage('Valid entity ID required.'),
  body('status')
    .optional()
    .isIn(['CONFIRMED_FACT', 'UNVERIFIED_OBSERVATION', 'HYPOTHESIS'])
    .withMessage('Timeline status must be CONFIRMED_FACT, UNVERIFIED_OBSERVATION, or HYPOTHESIS.')
];

const addLeadRules = [
  body('title').trim().notEmpty().withMessage('Lead title is required.'),
  body('hypothesis').trim().notEmpty().withMessage('Hypothesis is required.'),
  body('recommended_action').trim().notEmpty().withMessage('Recommended investigative action is required.'),
  body('priority_score')
    .optional()
    .isFloat({ min: 0.0, max: 100.0 })
    .withMessage('Priority score must be a number between 0.00 and 100.00.')
];

module.exports = {
  validate,
  officerRegisterRules,
  officerLoginRules,
  createCaseRules,
  addEvidenceRules,
  addSuspectRules,
  addVictimRules,
  addWitnessRules,
  addTimelineRules,
  addLeadRules
};
