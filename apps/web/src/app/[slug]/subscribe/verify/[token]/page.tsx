"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function VerifySubscriptionPage() {
  const params = useParams();
  const slug = params.slug as string;
  const token = params.token as string;

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(
          `/api/v1/status/${slug}/subscribe/verify/${token}`
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error?.message || "Verification failed");
        }

        setStatus("success");
        setMessage(data.message || "Successfully subscribed to status updates");
      } catch (err) {
        setStatus("error");
        setMessage(
          err instanceof Error ? err.message : "Verification failed"
        );
      }
    }

    verify();
  }, [slug, token]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 text-navy-400 mx-auto animate-spin mb-4" />
            <h1 className="text-2xl font-semibold mb-2">
              Verifying subscription...
            </h1>
            <p className="text-navy-400">Please wait while we verify your email.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Subscription Confirmed</h1>
            <p className="text-navy-400 mb-6">{message}</p>
            <Link
              href={`/${slug}`}
              className="px-6 py-2 bg-white text-navy-900 font-medium rounded-lg hover:bg-navy-100 transition-colors inline-block"
            >
              Go to status page
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Verification Failed</h1>
            <p className="text-navy-400 mb-6">{message}</p>
            <Link
              href={`/${slug}`}
              className="px-6 py-2 bg-white text-navy-900 font-medium rounded-lg hover:bg-navy-100 transition-colors inline-block"
            >
              Go to status page
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
