"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { isAllowedEmail } from "@/lib/allowlist";

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function getSupabase() {
    return createBrowserClient();
  }

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.email) {
        if (isAllowedEmail(session.user.email)) {
          window.location.href = "/onboarding";
        } else {
          window.location.href = "/request-access";
        }
      }
    });
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        if (isAllowedEmail(user.email)) {
          window.location.href = "/dashboard";
        } else {
          window.location.href = "/request-access";
        }
      }
    });
  }, []);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}` },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    if (isSignUp) {
      const { error } = await getSupabase().auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}` },
      });
      if (error) setError(error.message);
      else setMessage("Check your email for a confirmation link.");
    } else {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else window.location.href = "/dashboard";
    }
    setLoading(false);
  }

  return (
    <div className="min-h-dvh bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">D</div>
            <span className="text-lg font-semibold tracking-tight">DigestPilot</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors hidden sm:block">Features</a>
            <a href="#how-it-works" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors hidden sm:block">How it works</a>
            <a href="#privacy" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors hidden sm:block">Privacy</a>
            <Button size="sm" className="rounded-full px-5" onClick={() => setShowLogin(true)}>
              Get started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 via-white to-white" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              AI-powered email assistant
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 leading-[1.1]">
              Never miss a reply.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">
                Never forget a promise.
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-zinc-500 leading-relaxed max-w-2xl mx-auto">
              DigestPilot reads your inbox, summarizes what matters, suggests replies,
              and tracks what you promised people — so nothing falls through the cracks.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="rounded-full px-8 h-12 text-base shadow-lg shadow-zinc-900/10" onClick={() => setShowLogin(true)}>
                Get started free
              </Button>
              <a href="#how-it-works" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-1">
                See how it works
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" /></svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="border-y border-zinc-100 bg-zinc-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-center gap-8 text-sm text-zinc-400">
          <span className="flex items-center gap-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg> Read-only access</span>
          <span className="flex items-center gap-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg> We never send emails on your behalf</span>
          <span className="flex items-center gap-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg> No data stored permanently</span>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">Everything you need to stay on top of email</h2>
          <p className="mt-4 text-lg text-zinc-500 max-w-2xl mx-auto">One digest, delivered when you want it. AI does the reading, you do the deciding.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>}
            title="Smart email digest"
            description="AI reads and summarizes every email. Urgent items on top, newsletters at the bottom. Know what matters in 30 seconds."
          />
          <FeatureCard
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>}
            title="One-tap replies"
            description="AI suggests replies in your language and tone. Tap once to open your email client with the reply pre-filled. Edit if you want."
          />
          <FeatureCard
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
            title="Auto calendar events"
            description="'Call me Tuesday at 10' — DigestPilot creates a calendar event with the phone number, address, and context. One tap to add."
          />
          <FeatureCard
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            title="Commitment tracking"
            description="You wrote 'I'll send the quote tomorrow'? DigestPilot remembers and reminds you until it's done. Auto-resolves when you deliver."
          />
          <FeatureCard
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>}
            title="Learns your style"
            description="The more you reply, the better suggestions get. DigestPilot learns your tone, language, and preferences over time."
          />
          <FeatureCard
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>}
            title="Smart actions"
            description="Each email gets a recommended action: reply, add to calendar, follow up, unsubscribe, or archive. AI decides, you confirm."
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-zinc-50 border-y border-zinc-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">Simple as 1-2-3</h2>
            <p className="mt-4 text-lg text-zinc-500">Set it up once, benefit forever.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <StepCard number="1" title="Connect Gmail" description="Sign in with Google and grant read-only access. We never send, delete, or modify your emails." />
            <StepCard number="2" title="Choose your schedule" description="Pick when you want your digest — morning, afternoon, or both. Your timezone, your rules." />
            <StepCard number="3" title="Get your digest" description="AI summarizes your inbox, suggests replies, extracts calendar events, and tracks your commitments." />
          </div>
        </div>
      </section>

      {/* Commitments highlight */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              New feature
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 leading-tight">
              Your AI accountability partner
            </h2>
            <p className="mt-4 text-lg text-zinc-500 leading-relaxed">
              You wrote "I'll send the quote tomorrow" — DigestPilot catches that commitment,
              creates a reminder, and follows up until it's done. When you deliver, it auto-resolves.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "Detects promises in your sent emails automatically",
                "Reminds you at the right time (morning = today, evening = tomorrow)",
                "Auto-resolves when AI detects you've delivered",
                "One-tap 'Done' from the digest email",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-zinc-600">
                  <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200/50">
            <div className="bg-white rounded-xl shadow-sm border border-zinc-200/80 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><span>⚡</span> Your commitments today</div>
              <div className="flex items-start gap-3 bg-red-50 rounded-lg p-3 border-l-2 border-l-red-500">
                <span className="text-sm">📦</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">Send quote to Maria</p>
                  <p className="text-xs text-red-600">1 day overdue</p>
                </div>
                <span className="text-xs bg-emerald-500 text-white px-2 py-1 rounded">Done</span>
              </div>
              <div className="flex items-start gap-3 bg-amber-50 rounded-lg p-3 border-l-2 border-l-amber-400">
                <span className="text-sm">📞</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">Call Alexander at 10:00</p>
                  <p className="text-xs text-amber-700">Today — 0704405600</p>
                </div>
                <span className="text-xs bg-emerald-500 text-white px-2 py-1 rounded">Done</span>
              </div>
              <div className="flex items-start gap-3 bg-zinc-50 rounded-lg p-3 border-l-2 border-l-zinc-300">
                <span className="text-sm">🤝</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">Meeting with Lennart</p>
                  <p className="text-xs text-zinc-500">Tomorrow 14:00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy & Security — important for Google approval */}
      <section id="privacy" className="bg-zinc-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Built with privacy first</h2>
            <p className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto">
              DigestPilot uses Google's limited OAuth scope (gmail.readonly). We can read your emails to create summaries, but we can never send, delete, or modify anything in your inbox.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <PrivacyCard title="Read-only access" description="We only request gmail.readonly permission. We cannot send emails, delete messages, or modify your inbox in any way." />
            <PrivacyCard title="No permanent storage" description="Email content is processed in real-time to generate summaries, then discarded. Only summaries are stored." />
            <PrivacyCard title="Encrypted tokens" description="Your Gmail access tokens are encrypted with AES-256-GCM before storage. We use key versioning for rotation." />
            <PrivacyCard title="You're in control" description="Disconnect anytime from Settings. Delete your account and all data is permanently removed." />
          </div>

          <div className="mt-12 text-center space-x-6">
            <a href="/privacy" className="text-sm text-zinc-400 hover:text-white underline underline-offset-4 transition-colors">Privacy Policy</a>
            <a href="/terms" className="text-sm text-zinc-400 hover:text-white underline underline-offset-4 transition-colors">Terms of Service</a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
          Stop missing emails. Start delivering on promises.
        </h2>
        <p className="mt-4 text-lg text-zinc-500 max-w-xl mx-auto">
          Join the waitlist or sign in if you already have access.
        </p>
        <div className="mt-8">
          <Button size="lg" className="rounded-full px-8 h-12 text-base shadow-lg shadow-zinc-900/10" onClick={() => setShowLogin(true)}>
            Get started free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 bg-zinc-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-zinc-900 text-white flex items-center justify-center text-[10px] font-bold">D</div>
            <span className="text-sm text-zinc-500">DigestPilot &copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <a href="/privacy" className="hover:text-zinc-900 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-zinc-900 transition-colors">Terms</a>
            <a href="mailto:stefan.aberg84@gmail.com" className="hover:text-zinc-900 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      {/* Login modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowLogin(false); }}>
          <Card className="w-full max-w-sm shadow-2xl border-0">
            <CardContent className="p-6 space-y-5">
              <div className="text-center">
                <div className="inline-flex w-10 h-10 rounded-xl bg-zinc-900 text-white items-center justify-center text-lg font-bold mb-3">D</div>
                <h3 className="text-lg font-semibold">{isSignUp ? "Create account" : "Welcome back"}</h3>
              </div>

              <Button
                variant="outline"
                className="w-full h-11 text-sm font-medium rounded-xl"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-zinc-400 uppercase tracking-wider">or</span></div>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-xs">Email</Label>
                  <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-xs">Password</Label>
                  <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-10 rounded-xl" />
                </div>
                <Button type="submit" className="w-full h-10 rounded-xl" disabled={loading}>
                  {loading ? "Loading..." : isSignUp ? "Create account" : "Sign in"}
                </Button>
              </form>

              {error && <div className="rounded-xl bg-red-50 p-3"><p className="text-sm text-red-600 text-center">{error}</p></div>}
              {message && <div className="rounded-xl bg-emerald-50 p-3"><p className="text-sm text-emerald-700 text-center">{message}</p></div>}

              <p className="text-center text-xs text-zinc-400">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button type="button" className="text-zinc-900 font-medium hover:underline" onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}>
                  {isSignUp ? "Sign in" : "Sign up"}
                </button>
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl border border-zinc-100 hover:border-zinc-200 hover:shadow-sm transition-all bg-white">
      <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600 mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-zinc-900 mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center text-sm font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-base font-semibold text-zinc-900 mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
    </div>
  );
}

function PrivacyCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-5 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
      <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
      <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}
