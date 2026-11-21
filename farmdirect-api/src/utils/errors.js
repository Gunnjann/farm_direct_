class AppError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code || 'ERROR';
    this.details = details;
  }
}

const badRequest = (msg, details) => new AppError(400, msg, 'BAD_REQUEST', details);
const unauthorized = (msg = 'Please log in to continue') => new AppError(401, msg, 'UNAUTHORIZED');
const forbidden = (msg = 'You do not have permission to do this') => new AppError(403, msg, 'FORBIDDEN');
const notFound = (msg = 'Not found') => new AppError(404, msg, 'NOT_FOUND');
const conflict = (msg, code = 'CONFLICT') => new AppError(409, msg, code);

/** Wrap async route handlers so rejected promises reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, asyncHandler };
