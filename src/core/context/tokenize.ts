/**
 * Deterministic lexical tokenization for context ranking. There is no NLP model
 * here — just lowercasing, identifier splitting (camelCase / snake_case / kebab),
 * and stopword removal. Same input always yields the same tokens.
 */
const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "you",
  "are", "was", "were", "will", "would", "should", "could", "has", "have", "had",
  "how", "why", "what", "when", "where", "which", "who", "add", "fix", "make",
  "use", "using", "get", "set", "new", "code", "file", "files", "function",
  "please", "need", "want", "can", "all", "any", "not", "but", "its", "our",
]);

/** Split an identifier or phrase into lowercase word tokens. */
export function splitIdentifier(raw: string): string[] {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase boundary
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2") // ACRONYMWord boundary
    .split(/[^A-Za-z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0);
}

/** Tokenize a free-text task into meaningful keywords. */
export function tokenizeTask(task: string): string[] {
  const tokens = splitIdentifier(task).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return [...new Set(tokens)];
}

/**
 * Lightweight stemmer for match normalization: collapses common plural/verb
 * inflections so `dependencies`↔`dependency`, `imports`↔`import`, and
 * `resolves`↔`resolve` are treated as the same term. Deliberately simple and
 * deterministic — this is lexical matching, not linguistics.
 */
export function stem(token: string): string {
  const t = token.toLowerCase();
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y"; // dependencies -> dependency
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1); // imports -> import
  return t;
}

export function stemSet(tokens: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) out.add(stem(t));
  return out;
}
