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
  category: string;
  summary: string;
  suggestedReply: string | null;
  tokenEstimate: number;
  recommendedAction: string;
  actionReason: string | null;
  actionData: Record<string, any> | null;
}

export async function processDigestEmails(
  emails: EmailInput[],
  replyPatterns: ReplyPattern[],
  detectedLanguage?: string
): Promise<{ results: DigestResult[]; totalCostCents: number }> {
  if (emails.length === 0) return { results: [], totalCostCents: 0 };

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Step 1: Classify urgency + category (Haiku) — batch to avoid overloading
  const classificationBatches = createDynamicBatches(emails, 15000); // ~15 emails per batch
  const classificationResults: Record<string, { urgency: "low" | "medium" | "high"; category: string; action: string; actionReason?: string; event?: Record<string, any> }> = {};
  let classInputTokens = 0;
  let classOutputTokens = 0;

  for (const batch of classificationBatches) {
    const batchResult = await classifyEmails(batch);
    Object.assign(classificationResults, batchResult.results);
    classInputTokens += batchResult.inputTokens;
    classOutputTokens += batchResult.outputTokens;
  }

  const classification = { results: classificationResults, inputTokens: classInputTokens, outputTokens: classOutputTokens };
  totalInputTokens += classification.inputTokens;
  totalOutputTokens += classification.outputTokens;

  // Step 2: Separate emails by category
  const emailsWithCategory = emails.map((e) => ({
    ...e,
    category: classification.results[e.id]?.category ?? "personal",
  }));

  const needsAI = emailsWithCategory.filter(
    (e) => !["newsletter", "notification", "spam", "transactional"].includes(e.category)
  );
  const skipAI = emailsWithCategory.filter(
    (e) => ["newsletter", "notification", "spam", "transactional"].includes(e.category)
  );

  // Step 3: Only send personal/work emails to Sonnet (expensive model)
  const allSummaryResults: Array<{
    emailId: string;
    summary: string;
    suggestedReply: string | null;
    emailBody: string;
  }> = [];

  if (needsAI.length > 0) {
    const batches = createDynamicBatches(needsAI, 30000);
    for (const batch of batches) {
      const batchResults = await summarizeAndSuggestReplies(
        batch,
        replyPatterns,
        detectedLanguage
      );
      totalInputTokens += batchResults.inputTokens;
      totalOutputTokens += batchResults.outputTokens;
      allSummaryResults.push(...batchResults.results);
    }
  }

  // Step 4: Generate cheap summaries for newsletters/spam (no AI call — template-based)
  for (const email of skipAI) {
    const cat = email.category;
    const summary =
      cat === "spam" ? `Probable spam from ${email.from}.` :
      cat === "newsletter" ? `Newsletter from ${email.from}: ${email.subject}` :
      cat === "transactional" ? `Receipt/confirmation from ${email.from}.` :
      `Notification from ${email.from}: ${email.subject}`;

    allSummaryResults.push({
      emailId: email.id,
      summary,
      suggestedReply: null,
      emailBody: email.body,
    });
  }

  // Combine results
  const results: DigestResult[] = allSummaryResults.map((r) => {
    const cls = classification.results[r.emailId];
    return {
      emailId: r.emailId,
      urgency: cls?.urgency ?? "low",
      category: cls?.category ?? "personal",
      summary: r.summary,
      suggestedReply: r.suggestedReply,
      tokenEstimate: Math.ceil(r.emailBody.length / 4),
      recommendedAction: cls?.action ?? "archive",
      actionReason: cls?.actionReason ?? null,
      actionData: cls?.event ?? null,
    };
  });

  // Calculate cost
  const haikuCost =
    (classification.inputTokens * 0.25 + classification.outputTokens * 1.25) / 1_000_000;
  const sonnetInputTokens = totalInputTokens - classification.inputTokens;
  const sonnetOutputTokens = totalOutputTokens - classification.outputTokens;
  const sonnetCost =
    (sonnetInputTokens * 3 + sonnetOutputTokens * 15) / 1_000_000;
  const totalCostCents = Math.ceil((haikuCost + sonnetCost) * 100);

  return { results, totalCostCents };
}

async function classifyEmails(
  emails: EmailInput[]
): Promise<{
  results: Record<string, { urgency: "low" | "medium" | "high"; category: string; action: string; actionReason?: string; event?: Record<string, any> }>;
  inputTokens: number;
  outputTokens: number;
}> {
  const prompt = classifyUrgencyPrompt(emails);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  const validActions = ["reply", "calendar", "follow_up", "archive", "spam", "unsubscribe"];
  const results: Record<string, { urgency: "low" | "medium" | "high"; category: string; action: string; actionReason?: string; event?: Record<string, any> }> = {};
  try {
    const parsed = parseJsonResponse(text);
    for (const [id, val] of Object.entries(parsed)) {
      const v = val as any;
      const action = validActions.includes(v.action) ? v.action : "archive";
      results[id] = {
        urgency: ["high", "medium", "low"].includes(v.urgency) ? v.urgency : "medium",
        category: v.category ?? "personal",
        action,
        ...(v.action_reason ? { actionReason: v.action_reason } : {}),
        ...(v.event ? { event: v.event } : {}),
      };
    }
  } catch {
    for (const email of emails) {
      results[email.id] = { urgency: "medium", category: "personal", action: "archive" };
    }
  }

  return {
    results,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function summarizeAndSuggestReplies(
  emails: (EmailInput & { category?: string })[],
  replyPatterns: ReplyPattern[],
  detectedLanguage?: string
): Promise<{
  results: Array<{
    emailId: string;
    summary: string;
    suggestedReply: string | null;
    emailBody: string;
  }>;
  inputTokens: number;
  outputTokens: number;
}> {
  const prompt =
    summarizePrompt(emails) +
    "\n\n" +
    suggestReplyPrompt(replyPatterns, detectedLanguage);

  if (!prompt.trim()) {
    return { results: [], inputTokens: 0, outputTokens: 0 };
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  const results: Array<{
    emailId: string;
    summary: string;
    suggestedReply: string | null;
    emailBody: string;
  }> = [];

  try {
    const parsed = parseJsonResponse(text);
    for (const item of parsed) {
      const email = emails.find((e) => e.id === item.id);
      results.push({
        emailId: item.id,
        summary: item.summary ?? "",
        suggestedReply: item.reply ?? null,
        emailBody: email?.body ?? "",
      });
    }
  } catch {
    for (const email of emails) {
      results.push({
        emailId: email.id,
        summary: `Email from ${email.from} about: ${email.subject}`,
        suggestedReply: null,
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

function parseJsonResponse(text: string): any {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned = jsonMatch ? jsonMatch[1].trim() : text.trim();
  return JSON.parse(cleaned);
}

function createDynamicBatches<T extends EmailInput>(
  emails: T[],
  maxTokensPerBatch: number
): T[][] {
  const batches: T[][] = [];
  let currentBatch: T[] = [];
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

  if (currentBatch.length > 0) batches.push(currentBatch);
  return batches;
}
