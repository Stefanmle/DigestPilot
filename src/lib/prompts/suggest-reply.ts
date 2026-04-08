interface ReplyPattern {
  email_context_summary: string;
  ai_suggestion: string;
  user_reply: string;
  language: string | null;
}

export function suggestReplyPrompt(
  replyPatterns: ReplyPattern[],
  detectedLanguage?: string
): string {
  if (replyPatterns.length === 0) {
    return "";
  }

  const examples = replyPatterns
    .slice(0, 10)
    .map(
      (p, i) =>
        `Example ${i + 1}:
Email context: ${p.email_context_summary}
AI suggested: ${p.ai_suggestion}
User actually wrote: ${p.user_reply}`
    )
    .join("\n\n");

  return `
IMPORTANT: The user has a specific writing style. Here are examples of how they've replied to emails in the past. Match their tone, length, formality, and language preferences when generating replies.

${examples}

${detectedLanguage ? `The incoming email is in ${detectedLanguage}. Reply in the same language.` : "Reply in the same language as the incoming email."}`;
}
