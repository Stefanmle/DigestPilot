import Anthropic from "@anthropic-ai/sdk";
import { classifyUrgencyPrompt } from "./prompts/classify";
import { summarizePrompt } from "./prompts/summarize";
import { suggestReplyPrompt } from "./prompts/suggest-reply";

const anthropic = new Anthropic();

interface EmailInput {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  threadId: string;
}

interface ReplyPattern {
  email_context_summary: string;
  ai_suggestion: string;
  user_reply: string;
  language: string | null;
}

interface DigestResult {
  emailId: string;
  urgency: "low" | "medium" | "high";
  summary: string;
  suggestedReply: string;
  tokenEstimate: number;
}

export async function processDigestEmails(
  emails: EmailInput[],
  replyPatterns: ReplyPattern[],
  detectedLanguage?: string
): Promise<{ results: DigestResult[]; totalCostCents: number }> {
  if (emails.length === 0) return { results: [], totalCostCents: 0 };

  const results: DigestResult[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Step 1: Classify urgency (Haiku, batched)
  const urgencyMap = await classifyUrgency(emails);
  totalInputTokens += urgencyMap.inputTokens;
  totalOutputTokens += urgencyMap.outputTokens;

  // Step 2: Summarize + suggest replies (Sonnet, dynamic batching)
  const batches = createDynamicBatches(emails, 30000);

  for (const batch of batches) {
    const batchResults = await summarizeAndSuggestReplies(
      batch,
      replyPatterns,
      detectedLanguage
    );
    totalInputTokens += batchResults.inputTokens;
    totalOutputTokens += batchResults.outputTokens;

    for (const r of batchResults.results) {
      results.push({
        emailId: r.emailId,
        urgency: urgencyMap.results[r.emailId] ?? "low",
        summary: r.summary,
        suggestedReply: r.suggestedReply,
        tokenEstimate: Math.ceil(r.emailBody.length / 4),
      });
    }
  }

  // Calculate cost (Haiku: $0.25/M in, $1.25/M out; Sonnet: $3/M in, $15/M out)
  const haikuCost =
    (urgencyMap.inputTokens * 0.25 + urgencyMap.outputTokens * 1.25) / 1_000_000;
  const sonnetInputTokens = totalInputTokens - urgencyMap.inputTokens;
  const sonnetOutputTokens = totalOutputTokens - urgencyMap.outputTokens;
  const sonnetCost =
    (sonnetInputTokens * 3 + sonnetOutputTokens * 15) / 1_000_000;
  const totalCostCents = Math.ceil((haikuCost + sonnetCost) * 100);

  return { results, totalCostCents };
}

async function classifyUrgency(
  emails: EmailInput[]
): Promise<{
  results: Record<string, "low" | "medium" | "high">;
  inputTokens: number;
  outputTokens: number;
}> {
  const prompt = classifyUrgencyPrompt(emails);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  const results: Record<string, "low" | "medium" | "high"> = {};
  try {
    const parsed = JSON.parse(text);
    for (const [id, level] of Object.entries(parsed)) {
      if (level === "high" || level === "medium" || level === "low") {
        results[id] = level;
      }
    }
  } catch {
    // If parsing fails, default all to medium
    for (const email of emails) {
      results[email.id] = "medium";
    }
  }

  return {
    results,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function summarizeAndSuggestReplies(
  emails: EmailInput[],
  replyPatterns: ReplyPattern[],
  detectedLanguage?: string
): Promise<{
  results: Array<{
    emailId: string;
    summary: string;
    suggestedReply: string;
    emailBody: string;
  }>;
  inputTokens: number;
  outputTokens: number;
}> {
  const prompt = summarizePrompt(emails) + "\n\n" + suggestReplyPrompt(replyPatterns, detectedLanguage);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  const results: Array<{
    emailId: string;
    summary: string;
    suggestedReply: string;
    emailBody: string;
  }> = [];

  try {
    const parsed = JSON.parse(text);
    for (const item of parsed) {
      const email = emails.find((e) => e.id === item.id);
      results.push({
        emailId: item.id,
        summary: item.summary ?? "",
        suggestedReply: item.reply ?? "",
        emailBody: email?.body ?? "",
      });
    }
  } catch {
    // If parsing fails, create basic results
    for (const email of emails) {
      results.push({
        emailId: email.id,
        summary: `Email from ${email.from} about: ${email.subject}`,
        suggestedReply: "",
        emailBody: email.body,
      });
    }
  }

  return {
    results,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

function createDynamicBatches(
  emails: EmailInput[],
  maxTokensPerBatch: number
): EmailInput[][] {
  const batches: EmailInput[][] = [];
  let currentBatch: EmailInput[] = [];
  let currentTokens = 0;

  for (const email of emails) {
    const estimatedTokens = Math.ceil(email.body.length / 4);

    if (currentTokens + estimatedTokens > maxTokensPerBatch && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = 0;
    }

    currentBatch.push(email);
    currentTokens += estimatedTokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}
