const VOWELS = /[aeiouy]/;
const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/** Short forms that look like gibberish but are normal in chat. */
const ALLOWED = new Set([
  'ok', 'okk', 'pls', 'plz', 'thx', 'thnx', 'tnx', 'brb', 'btw', 'idk', 'lol', 'lmk', 'np',
  'hmm', 'hmmm', 'mmm', 'shh', 'pst', 'psst', 'nvm', 'smh', 'tbh', 'imo', 'asap', 'wtf', 'omg',
  'gm', 'gn', 'msg', 'pcs', 'qty', 'kg', 'km', 'cm', 'mm', 'xl', 'xxl', 'xs', 'sms', 'pdf', 'dm',
  'nd', 'wy', 'wyd', 'hw', 'dnt', 'cnt', 'wht', 'ngn', 'gsm', 'tv', 'pc', 'cv', 'sw', 'nw', 'ne', 'se',
]);

function keyboardRunLength(word) {
  let best = 1;
  let run = 1;
  for (let i = 1; i < word.length; i += 1) {
    const adjacent = KEYBOARD_ROWS.some((row) => {
      const a = row.indexOf(word[i - 1]);
      const b = row.indexOf(word[i]);
      return a >= 0 && b >= 0 && Math.abs(a - b) === 1;
    });
    run = adjacent ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Heuristic score for one lowercase alphabetic word: true when it looks like a key-smash. */
export function isGibberishWord(word) {
  const w = word.toLowerCase();
  if (w.length < 4 || ALLOWED.has(w) || /^h?m+$|^(ha)+h?$|^(he)+h?$|^z+$/.test(w)) return false;
  if (/(.)\1{3,}/.test(w)) return true;
  if (!VOWELS.test(w)) return true;
  if (/[^aeiouy]{6,}/.test(w)) return true;
  if (keyboardRunLength(w) >= 5) return true;
  const vowelCount = (w.match(/[aeiouy]/g) || []).length;
  if (w.length >= 7 && vowelCount / w.length < 0.1) return true;
  const unique = new Set(w).size;
  if (w.length >= 8 && unique / w.length < 0.3) return true;
  return false;
}

/**
 * True when a message has no readable meaning (e.g. "asdfghjkl", "xjqkzv bnmwrt").
 * Numbers, links, emoji and short replies are never flagged.
 */
export function isGibberishMessage(text) {
  const cleaned = String(text ?? '')
    .toLowerCase()
    .replace(/https?:\/\/\S+|www\.\S+/g, ' ')
    .replace(/\S+@\S+/g, ' ');
  const words = cleaned.match(/[a-z]+/g) || [];
  const letters = words.join('').length;
  if (letters < 6) return false;
  const flagged = words.filter(isGibberishWord);
  const flaggedLetters = flagged.join('').length;
  return flaggedLetters / letters >= 0.6;
}
