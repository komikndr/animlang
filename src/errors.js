export class AnimlangError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AnimlangError';
    this.code = code;
    this.details = details;
  }
}

export function requireValue(condition, code, message) {
  if (!condition) throw new AnimlangError(code, message);
}
