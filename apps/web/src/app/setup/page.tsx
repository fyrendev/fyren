"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { Card } from "@/components/admin/ui/Card";
import { Button } from "@/components/admin/ui/Button";
import { Input } from "@/components/admin/ui/Input";

interface SetupStatus {
  needsSetup: boolean;
  hasUsers: boolean;
  hasOrganization: boolean;
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Account creation
  const [accountData, setAccountData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Step 2: Organization creation
  const [orgData, setOrgData] = useState({
    name: "",
  });

  useEffect(() => {
    async function checkSetupStatus() {
      try {
        const res = await fetch(`/api/v1/setup/status`);
        const data: SetupStatus = await res.json();

        if (!data.needsSetup) {
          // Setup already complete, redirect to home
          router.replace("/");
          return;
        }

        if (data.hasUsers) {
          // Users exist, skip to org creation step
          setStep(2);
        }

        setLoading(false);
      } catch (err) {
        console.error("Failed to check setup status:", err);
        setError("Failed to check setup status");
        setLoading(false);
      }
    }

    checkSetupStatus();
  }, [router]);

  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOrgData({ name: e.target.value });
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    if (accountData.password !== accountData.confirmPassword) {
      setError("Passwords do not match");
      setSubmitting(false);
      return;
    }

    if (accountData.password.length < 8) {
      setError("Password must be at least 8 characters");
      setSubmitting(false);
      return;
    }

    try {
      const result = await signUp.email({
        email: accountData.email,
        password: accountData.password,
        name: accountData.name,
      });

      if (result.error) {
        setError(result.error.message || "Failed to create account");
        setSubmitting(false);
        return;
      }

      // Move to step 2
      setStep(2);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/v1/admin/organization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: orgData.name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to create organization");
      }

      // Redirect to admin dashboard
      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="text-navy-400">Loading...</div>
      </div>
    );
  }

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

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 1 ? "bg-amber-500 text-navy-900" : "bg-navy-700 text-navy-400"
            }`}
          >
            1
          </div>
          <div className="w-8 h-1 bg-navy-700" />
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 2 ? "bg-amber-500 text-navy-900" : "bg-navy-700 text-navy-400"
            }`}
          >
            2
          </div>
        </div>

        <Card>
          {step === 1 ? (
            <>
              <h1 className="text-xl font-semibold text-white text-center mb-2">
                Create Admin Account
              </h1>
              <p className="text-navy-400 text-center text-sm mb-6">
                Set up your administrator account to get started.
              </p>

              <form onSubmit={handleStep1Submit} className="space-y-4">
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <Input
                  label="Name"
                  type="text"
                  value={accountData.name}
                  onChange={(e) => setAccountData({ ...accountData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />

                <Input
                  label="Email"
                  type="email"
                  value={accountData.email}
                  onChange={(e) => setAccountData({ ...accountData, email: e.target.value })}
                  placeholder="you@example.com"
                  required
                />

                <Input
                  label="Password"
                  type="password"
                  value={accountData.password}
                  onChange={(e) => setAccountData({ ...accountData, password: e.target.value })}
                  placeholder="********"
                  required
                />

                <Input
                  label="Confirm Password"
                  type="password"
                  value={accountData.confirmPassword}
                  onChange={(e) =>
                    setAccountData({
                      ...accountData,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="********"
                  required
                />

                <Button type="submit" className="w-full" loading={submitting}>
                  Continue
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-white text-center mb-2">
                Create Organization
              </h1>
              <p className="text-navy-400 text-center text-sm mb-6">
                Set up your organization to start monitoring services.
              </p>

              <form onSubmit={handleStep2Submit} className="space-y-4">
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <Input
                  label="Organization Name"
                  type="text"
                  value={orgData.name}
                  onChange={handleOrgNameChange}
                  placeholder="My Company"
                  required
                />

                <Button
                  type="submit"
                  className="w-full"
                  loading={submitting}
                  disabled={!orgData.name}
                >
                  Complete Setup
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
