"use client";

import { useState } from "react";
import { Card } from "@/components/admin/ui/Card";
import { Input } from "@/components/admin/ui/Input";
import { Button } from "@/components/admin/ui/Button";

export default function NewOrganizationPage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/admin/organization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to create organization");
      }

      // Redirect to dashboard
      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-navy-900 font-bold text-xl">F</span>
            </div>
            <span className="text-2xl font-semibold text-white">Fyren</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Create Your Organization</h1>
          <p className="text-navy-400 mt-2">
            Set up your organization to start monitoring your services.
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <Input
              label="Organization Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Company"
              required
            />

            <div className="pt-4">
              <Button type="submit" disabled={loading || !name}>
                {loading ? "Creating..." : "Create Organization"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
