import { google } from "googleapis";
import { encrypt, decrypt } from "./encryption";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
  );
}

export function getAuthUrl(state: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state,
    prompt: "consent",
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getAuthenticatedClient(inbox: {
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
}) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: decrypt(inbox.access_token),
    refresh_token: decrypt(inbox.refresh_token),
    expiry_date: inbox.token_expires_at
      ? new Date(inbox.token_expires_at).getTime()
      : undefined,
  });

  // Handle token refresh
  oauth2Client.on("tokens", (tokens) => {
    // Token was refreshed — caller should update DB
    console.log("Token refreshed for inbox");
  });

  return oauth2Client;
}

export function encryptTokens(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
}) {
  return {
    access_token: tokens.access_token ? encrypt(tokens.access_token) : null,
    refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
  };
}

interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  date: string;
}

export async function fetchNewEmails(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>,
  syncCursor?: string | null,
  maxResults = 100
): Promise<{ messages: GmailMessage[]; newSyncCursor: string }> {
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Get current history ID for the new cursor
  const profile = await gmail.users.getProfile({ userId: "me" });
  const newSyncCursor = profile.data.historyId ?? "";

  let messageIds: string[] = [];

  if (syncCursor) {
    // Incremental sync using history
    try {
      const history = await gmail.users.history.list({
        userId: "me",
        startHistoryId: syncCursor,
        historyTypes: ["messageAdded"],
        labelId: "INBOX",
      });

      messageIds =
        history.data.history?.flatMap(
          (h) => h.messagesAdded?.map((m) => m.message?.id ?? "") ?? []
        ) ?? [];
    } catch (err: any) {
      if (err?.code === 404) {
        // History expired, do a full sync of today's emails
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const afterDate = Math.floor(today.getTime() / 1000);
        const list = await gmail.users.messages.list({
          userId: "me",
          labelIds: ["INBOX"],
          q: `after:${afterDate}`,
          maxResults,
        });
        messageIds = list.data.messages?.map((m) => m.id ?? "") ?? [];
      } else {
        throw err;
      }
    }
  } else {
    // First sync — try today, then expand to last 7 days, then 30 days
    for (const daysBack of [0, 7, 30]) {
      const since = new Date();
      since.setDate(since.getDate() - daysBack);
      since.setHours(0, 0, 0, 0);
      const afterDate = Math.floor(since.getTime() / 1000);
      const list = await gmail.users.messages.list({
        userId: "me",
        labelIds: ["INBOX"],
        q: `after:${afterDate}`,
        maxResults,
      });
      messageIds = list.data.messages?.map((m) => m.id ?? "") ?? [];
      if (messageIds.length > 0) break;
    }
  }

  // Deduplicate and limit
  messageIds = [...new Set(messageIds.filter(Boolean))].slice(0, maxResults);

  // Fetch full messages
  const messages: GmailMessage[] = [];
  for (const msgId of messageIds) {
    try {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: msgId,
        format: "full",
      });

      const headers = msg.data.payload?.headers ?? [];
      const from = headers.find((h) => h.name === "From")?.value ?? "";
      const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
      const date = headers.find((h) => h.name === "Date")?.value ?? "";

      // Extract from name and email
      const fromMatch = from.match(/^(.*?)\s*<(.+?)>$/);
      const fromName = fromMatch ? fromMatch[1].replace(/"/g, "") : from;
      const fromEmail = fromMatch ? fromMatch[2] : from;

      // Extract body text
      const body = extractBodyText(msg.data.payload);

      messages.push({
        id: msgId,
        threadId: msg.data.threadId ?? "",
        from: fromName,
        fromEmail,
        subject,
        body: body.slice(0, 4000), // Truncate to 4000 chars
        date,
      });
    } catch {
      // Skip individual message errors
      continue;
    }
  }

  return { messages, newSyncCursor };
}

export async function fetchSentEmails(
  oauth2Client: InstanceType<typeof google.auth.OAuth2>,
  sentSyncCursor?: string | null
): Promise<{
  sentMessages: Array<{ threadId: string; body: string }>;
  newSentSyncCursor: string;
}> {
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const profile = await gmail.users.getProfile({ userId: "me" });
  const newSentSyncCursor = profile.data.historyId ?? "";

  let messageIds: string[] = [];

  if (sentSyncCursor) {
    try {
      const history = await gmail.users.history.list({
        userId: "me",
        startHistoryId: sentSyncCursor,
        historyTypes: ["messageAdded"],
        labelId: "SENT",
      });

      messageIds =
        history.data.history?.flatMap(
          (h) => h.messagesAdded?.map((m) => m.message?.id ?? "") ?? []
        ) ?? [];
    } catch (err: any) {
      if (err?.code === 404) {
        // History expired — skip, will catch up next time
        return { sentMessages: [], newSentSyncCursor };
      }
      throw err;
    }
  } else {
    // First sync — get recent sent messages
    const list = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["SENT"],
      maxResults: 50,
    });
    messageIds = list.data.messages?.map((m) => m.id ?? "") ?? [];
  }

  messageIds = [...new Set(messageIds.filter(Boolean))].slice(0, 50);

  const sentMessages: Array<{ threadId: string; body: string }> = [];
  for (const msgId of messageIds) {
    try {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: msgId,
        format: "full",
      });

      const body = extractBodyText(msg.data.payload);

      sentMessages.push({
        threadId: msg.data.threadId ?? "",
        body: body.slice(0, 4000),
      });
    } catch {
      continue;
    }
  }

  return { sentMessages, newSentSyncCursor };
}

function extractBodyText(payload: any): string {
  if (!payload) return "";

  // Direct text body
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  // Multipart — find text/plain part
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    // Fallback: try nested parts
    for (const part of payload.parts) {
      const result = extractBodyText(part);
      if (result) return result;
    }
  }

  // Last resort: HTML body
  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = Buffer.from(payload.body.data, "base64").toString("utf-8");
    // Strip HTML tags for plain text
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  return "";
}
