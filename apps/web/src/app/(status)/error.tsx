"use client";

import { useEffect } from "react";

interface Props {
  error: Error;
  reset: () => void;
}

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    console.error("Status page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
        <p className="text-navy-400 mb-6">
          We couldn't load the status page. Please try again later.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-white text-navy-900 font-medium rounded-lg hover:bg-navy-100 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
