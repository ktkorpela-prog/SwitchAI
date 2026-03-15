/**
 * Classifies a prompt into a context mode:
 *   minimal  — trivial / short prompt, send as little history as possible
 *   normal   — default, send recent history up to budget
 *   extended — (future) user-triggered deep context
 */

const TRIVIAL_PATTERNS = [
  /^(hi|hello|hey|yo|sup|howdy)[!?. ]*$/i,
  /^are you (there|here|online|available|ready)\??$/i,
  /^(yes|no|ok|okay|sure|nope|yep|nah|yup)[!?. ]*$/i,
  /^(thanks|thank you|thx|ty)[!?. ]*$/i,
  /^(got it|understood|makes sense|cool|great|perfect|nice)[!?. ]*$/i,
  /^(what do you mean|can you clarify|clarify that)[?. ]*$/i,
  /summarize (this )?in (one|1|a single) sentence/i,
];

function getLowContextThreshold() {
  return parseInt(process.env.LOW_CONTEXT_MESSAGE_CHAR_THRESHOLD || '120', 10);
}

function isLowContextPrompt(text) {
  const clean = text.trim();
  if (clean.length < 30) return true;
  if (clean.length < getLowContextThreshold() && TRIVIAL_PATTERNS.some((p) => p.test(clean))) return true;
  return false;
}

function selectContextMode(text) {
  if (isLowContextPrompt(text)) return 'minimal';
  return 'normal';
}

module.exports = { isLowContextPrompt, selectContextMode };
