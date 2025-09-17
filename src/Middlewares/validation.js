import { body, param, query, validationResult } from 'express-validator';
import catchAsync from '../Utils/catchAsync.js';
import HandleError from '../Utils/handleError.js';

const validateInput = (validations) => {
  return [
    ...validations,
    catchAsync(async (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new HandleError('Validation failed: ' + errors.array()[0].msg, 400));
      }
      next();
    }),
  ];
};

export const validateTaskId = validateInput([
  param('taskId').isMongoId().withMessage('Invalid taskId format.'),
]);

export const validateGroups = validateInput([
  body('groups').isArray().withMessage('Groups must be an array.')
    .custom((groups) => groups.every(g => typeof g === 'string')).withMessage('Groups must contain only strings.'),
]);

export const validateTournamentGroups = validateInput([
  body('tournamentGroups').isArray().withMessage('Tournament groups must be an array.')
    .custom((groups) => groups.every(g => typeof g === 'string')).withMessage('Tournament groups must contain only strings.'),
]);

export const validateEmail = validateInput([
  body('email').isEmail().withMessage('Invalid email format.')
    .normalizeEmail(),
]);

export default { validateTaskId, validateGroups, validateTournamentGroups, validateEmail };