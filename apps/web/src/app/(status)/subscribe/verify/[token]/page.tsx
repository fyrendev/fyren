"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function VerifySubscriptionPage() {
  const params = useParams();
  const token = params.token as string;

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function verify() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

        // Get the default org slug
        const orgRes = await fetch(`${apiUrl}/api/v1/org/default`);
        if (!orgRes.ok) {
          throw new Error("Organization not found");
        }
        const orgData = await orgRes.json();
        const slug = orgData.organization.slug;

        // Verify the subscription
        const res = await fetch(`${apiUrl}/api/v1/status/${slug}/subscribe/verify/${token}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error?.message || "Verification failed");
        }

        setStatus("success");
        setMessage(data.message || "Successfully subscribed to status updates");
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed");
      }
    }

    verify();
  }, [token]);

  return (
    <div className="min-h-screen status-page-bg flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 mx-auto animate-spin mb-4 theme-muted" />
            <h1 className="text-2xl font-semibold mb-2">Verifying subscription...</h1>
            <p className="theme-muted">Please wait while we verify your email.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Subscription Confirmed</h1>
            <p className="theme-muted mb-6">{message}</p>
            <Link href="/" className="brand-button inline-block">
              Go to status page
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Verification Failed</h1>
            <p className="theme-muted mb-6">{message}</p>
            <Link href="/" className="brand-button inline-block">
              Go to status page
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
