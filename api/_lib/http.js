// HTTP response helpers shared by the API functions.
//
// Everything goes through these two functions so the shape of success and
// error responses is identical across every endpoint. That's what makes
// the frontend's error handling simple: same codes, same status line,
// same JSON envelope, every time.

/**
 * Send a JSON success response.
 * @param {object} res       Node/Express-style response from Vercel
 * @param {number} status    HTTP status (usually 200)
 * @param {object} payload   Body; must not contain the API key or upstream URLs
 */
export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Never let a browser or CDN interpret the JSON as HTML.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

/**
 * Send a JSON error response.
 * Every error from the API looks like: { "error": "RATE_LIMIT" }
 * -- nothing else. No stack, no upstream body, no key.
 * @param {object} res       Node/Express-style response from Vercel
 * @param {number} status    HTTP status code
 * @param {string} code      Short uppercase error code
 */
export function sendError(res, status, code) {
  sendJson(res, status, { error: code });
}