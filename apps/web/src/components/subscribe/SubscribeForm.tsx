"use client";

import { useState } from "react";

interface Props {
  slug: string;
}

export function SubscribeForm({ slug }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch(`/api/v1/status/${slug}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to subscribe");
      }

      setStatus("success");
      setMessage("Check your email to confirm your subscription.");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    }
  }

  return (
    <div className="bg-navy-900 border border-navy-800 rounded-lg p-6">
      <h3 className="font-medium mb-2">Subscribe to updates</h3>
      <p className="text-sm text-navy-400 mb-4">
        Get notified when we create or resolve incidents.
      </p>

      {status === "success" ? (
        <p className="text-green-400">{message}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="flex-1 px-4 py-2 bg-navy-800 border border-navy-700 rounded-lg
                       focus:outline-none focus:border-navy-500 placeholder-navy-500"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="px-6 py-2 bg-white text-navy-900 font-medium rounded-lg
                       hover:bg-navy-100 disabled:opacity-50 transition-colors"
          >
            {status === "loading" ? "Subscribing..." : "Subscribe"}
          </button>
        </form>
      )}

      {status === "error" && <p className="text-red-400 mt-2">{message}</p>}
    </div>
  );
}
