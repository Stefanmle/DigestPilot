export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <a href="/" className="text-sm text-zinc-400 hover:text-zinc-900 transition-colors mb-8 inline-block">&larr; Back to home</a>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-zinc-400 mb-8">Last updated: April 10, 2026</p>

        <div className="prose prose-zinc prose-sm max-w-none space-y-6 text-zinc-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">What DigestPilot does</h2>
            <p>DigestPilot is an AI-powered email digest service. It connects to your Gmail account with read-only access, reads your incoming and sent emails, generates AI summaries, suggests replies, extracts calendar events, and tracks commitments you make in sent emails. Digests are delivered on your chosen schedule via email.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">Google User Data</h2>
            <p>DigestPilot requests the following Google OAuth scope:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>gmail.readonly</strong> — Read-only access to your Gmail inbox and sent messages</li>
            </ul>
            <p>We use this data exclusively to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Read incoming emails to generate AI-powered summaries</li>
              <li>Read sent emails to detect commitments and learn your reply style</li>
              <li>Extract dates, times, phone numbers, and addresses to create calendar events</li>
            </ul>
            <p><strong>We do NOT:</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Send, delete, or modify any emails in your account</li>
              <li>Share your email content with third parties (except our AI provider for processing)</li>
              <li>Store full email content permanently — only AI-generated summaries are retained</li>
              <li>Use your data for advertising or sell it to anyone</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">Data we store</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account info:</strong> Your name, email, timezone (from Google sign-in)</li>
              <li><strong>Email summaries:</strong> AI-generated summaries of your emails (not the original email content)</li>
              <li><strong>Suggested replies:</strong> AI-generated reply suggestions</li>
              <li><strong>Commitments:</strong> Promises detected in your sent emails (title, description, due date)</li>
              <li><strong>Gmail OAuth tokens:</strong> Encrypted with AES-256-GCM, used to access your inbox</li>
              <li><strong>Email body previews:</strong> Up to 4000 characters of email content, used for AI processing and deleted after processing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">AI processing</h2>
            <p>Email content is sent to Anthropic's Claude AI for classification, summarization, and reply suggestion. Anthropic does not retain or train on this data. See <a href="https://www.anthropic.com/privacy" className="text-blue-600 underline">Anthropic's Privacy Policy</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">Data security</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Gmail tokens encrypted with AES-256-GCM with key versioning</li>
              <li>All data transmitted over HTTPS</li>
              <li>Database hosted on Supabase with row-level security</li>
              <li>No permanent storage of full email content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">Your rights</h2>
            <p>You can at any time:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Disconnect:</strong> Remove Gmail access from Settings — we stop reading your emails immediately</li>
              <li><strong>Delete account:</strong> Delete all your data permanently from Settings</li>
              <li><strong>Revoke access:</strong> Remove DigestPilot from your Google account at <a href="https://myaccount.google.com/permissions" className="text-blue-600 underline">myaccount.google.com/permissions</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">Contact</h2>
            <p>Questions about privacy? Email us at <a href="mailto:stefan.aberg84@gmail.com" className="text-blue-600 underline">stefan.aberg84@gmail.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
