/**
 * Offline, model-agnostic token estimation.
 *
 * The MCP never calls a model and ships no tokenizer, so it estimates token
 * counts from character length using a configurable characters-per-token ratio.
 * Different model families have slightly different ratios (~3.5–4.2 chars/token
 * for English source code); the host supplies the ratio for its model in config,
 * which is why swapping models is a config change, not a code change.
 */
export function estimateTokens(text: string, charsPerToken: number): number {
  if (charsPerToken <= 0) throw new Error("charsPerToken must be > 0");
  if (text.length === 0) return 0;
  return Math.ceil(text.length / charsPerToken);
}
