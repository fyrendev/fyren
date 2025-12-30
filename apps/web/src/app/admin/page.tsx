import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <h1 className="text-4xl font-bold mb-4">Admin Dashboard</h1>
        <p className="text-navy-400 mb-6">
          The admin dashboard will be implemented in Phase 8.
        </p>
        <Link
          href="/"
          className="px-6 py-2 bg-white text-navy-900 font-medium rounded-lg hover:bg-navy-100 transition-colors inline-block"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
