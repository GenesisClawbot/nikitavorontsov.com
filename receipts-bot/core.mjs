const RISK_TERM_DEFINITIONS = [
  ['no data leaves', /\bno[ \t]+data[ \t]+leaves\b/i],
  ['nothing leaves', /\bnothing[ \t]+leaves\b/i],
  ['local only', /\blocal[ \t-]+only\b/i],
  ['end-to-end', /\bend[ \t-]+to[ \t-]+end\b/i],
  ['zero knowledge', /\bzero[ \t-]+knowledge\b/i],
  ['access control', /\baccess[ \t-]+controls?\b/i],
  ['security', /\bsecur(?:e|ed|es|ing|ity)\b/i],
  ['privacy', /\bpriv(?:acy|ate)\b/i],
  ['encrypt', /\bencrypt(?:ed|ing|ion|s)?\b/i],
  ['vulnerability', /\bvulnerabilit(?:y|ies)\b/i],
  ['exploit', /\bexploit(?:ed|ing|s)?\b/i],
  ['auth', /\b(?:auth|authenticat(?:e|ed|es|ing|ion)|authori[sz](?:e|ed|es|ing|ation))\b/i],
  ['permission', /\bpermissions?\b/i],
  ['sandbox', /\bsandbox(?:ed|es|ing)?\b/i],
  ['redact', /\bredact(?:ed|ing|ion|s)?\b/i],
  ['secret', /\bsecrets?\b/i],
  ['protected', /\bprotect(?:ed|ing|ion|s)?\b/i],
  ['safe', /\bsaf(?:e|er|est|ety)\b/i],
];

export const RISK_TERMS = Object.freeze(RISK_TERM_DEFINITIONS.map(([label]) => label));

function splitSentences(source) {
  return String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .flatMap((line) => line.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hashText(source) {
  let hash = 2166136261;
  for (const character of source) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function findRiskTerms(text) {
  return RISK_TERM_DEFINITIONS
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);
}

export function findFlaggedClaims(draft) {
  const occurrences = new Map();

  return splitSentences(draft).flatMap((text) => {
    const terms = findRiskTerms(text);
    if (!terms.length) return [];

    const normalized = text.replace(/\s+/g, ' ').trim();
    const baseId = `claim-${hashText(normalized)}`;
    const occurrence = (occurrences.get(baseId) ?? 0) + 1;
    occurrences.set(baseId, occurrence);

    return [{ id: `${baseId}-${occurrence}`, text, terms }];
  });
}

export function quoteAppearsInSource(quote, source) {
  const candidate = String(quote ?? '').trim();
  if (candidate.length < 12) return false;
  return String(source ?? '').includes(candidate);
}

export function quoteSupportsClaim(quote, source, claim) {
  const candidate = String(quote ?? '').trim();
  if (!quoteAppearsInSource(candidate, source)) return false;

  const quoteTerms = new Set(findRiskTerms(candidate));
  return claim.terms.every((term) => quoteTerms.has(term));
}

export function canCopyDraft({ draft, source, evidence = {} }) {
  const text = String(draft ?? '');
  if (!text.trim()) return false;

  return findFlaggedClaims(text).every((claim) => (
    quoteSupportsClaim(evidence[claim.id], source, claim)
  ));
}
