"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

interface InviteDetails {
  organization: { name: string };
  email: string;
  role: string;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch invite details
  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await fetch(`/api/v1/invites/${params.token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error?.message || "Invite not found or has expired");
          return;
        }

        setInvite(data.invite);
      } catch {
        setError("Failed to load invite details");
      } finally {
        setLoading(false);
      }
    }

    fetchInvite();
  }, [params.token]);

  async function handleAccept() {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/invites/${params.token}/accept`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || "Failed to accept invite");
        setAccepting(false);
        return;
      }

      // Redirect to admin dashboard
      window.location.href = "/admin";
    } catch {
      setError("Failed to accept invite");
      setAccepting(false);
    }
  }

  function handleSignUp() {
    // Redirect to signup with a return URL back to this invite page
    const returnUrl = encodeURIComponent(`/invites/${params.token}`);
    router.push(`/admin/register?redirect=${returnUrl}`);
  }

  if (loading || sessionLoading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-navy-900 rounded-xl border border-navy-800 p-8">
          {error && !invite ? (
            <>
              <h1 className="text-xl font-bold text-white mb-4">Invalid Invite</h1>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
              <a href="/" className="block text-center text-sm text-navy-400 hover:text-white">
                Go to homepage
              </a>
            </>
          ) : invite ? (
            <>
              <h1 className="text-xl font-bold text-white mb-2">You&apos;re invited</h1>
              <p className="text-navy-400 text-sm mb-6">
                You&apos;ve been invited to join{" "}
                <span className="text-white font-medium">{invite.organization.name}</span> as a{" "}
                <span className="text-white font-medium">{invite.role}</span>.
              </p>

              <div className="bg-navy-800 rounded-lg p-4 mb-6 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-navy-400">Email</span>
                  <span className="text-white">{invite.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-navy-400">Role</span>
                  <span className="text-white capitalize">{invite.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-navy-400">Expires</span>
                  <span className="text-white">
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {session?.user ? (
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full bg-white text-navy-900 font-medium py-2.5 rounded-lg hover:bg-navy-100 disabled:opacity-50 transition-colors"
                >
                  {accepting ? "Accepting..." : "Accept Invite"}
                </button>
              ) : (
                <button
                  onClick={handleSignUp}
                  className="w-full bg-white text-navy-900 font-medium py-2.5 rounded-lg hover:bg-navy-100 transition-colors"
                >
                  Sign up to accept
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
