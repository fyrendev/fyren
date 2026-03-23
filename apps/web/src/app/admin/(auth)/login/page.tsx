"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Card } from "@/components/admin/ui/Card";
import { Button } from "@/components/admin/ui/Button";
import { Input } from "@/components/admin/ui/Input";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message || "Failed to sign in");
        return;
      }
      // Use hard navigation to trigger server-side session check
      // Only allow relative redirects to prevent open redirect attacks
      const redirect = searchParams.get("redirect");
      const isSafeRedirect = redirect && redirect.startsWith("/") && !redirect.startsWith("//");
      window.location.href = isSafeRedirect ? redirect : "/admin";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to sign in";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-white text-center mb-6">Sign in to your account</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        <Button type="submit" className="w-full" loading={loading}>
          Sign In
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-navy-400">
        Don&apos;t have an account?{" "}
        <Link
          href={`/admin/register${searchParams.get("redirect") ? `?redirect=${searchParams.get("redirect")}` : ""}`}
          className="text-blue-400 hover:text-blue-300"
        >
          Sign up
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-navy-900 font-bold text-lg">F</span>
            </div>
            <span className="text-2xl font-semibold text-white">Fyren</span>
          </div>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
