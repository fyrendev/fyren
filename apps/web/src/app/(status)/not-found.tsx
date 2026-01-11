import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <h2 className="text-2xl font-medium mb-4">Not Found</h2>
        <p className="theme-muted mb-6">The page you're looking for doesn't exist.</p>
        <Link href="/" className="brand-button inline-block">
          Go to status page
        </Link>
      </div>
    </div>
  );
}
