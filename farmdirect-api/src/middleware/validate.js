const { badRequest } = require('../utils/errors');

/**
 * Validates and REPLACES req[part] with the parsed value, so unknown keys are
 * stripped (prevents mass-assignment like {"role":"admin"} or {"verified":true}).
 */
const validate =
  (schema, part = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(badRequest(details[0]?.message || 'Invalid input', details));
    }
    if (part === 'query') {
      // req.query is a getter in some Express versions; store parsed copy separately.
      req.validQuery = result.data;
    } else {
      req[part] = result.data;
    }
    next();
  };

module.exports = { validate };
