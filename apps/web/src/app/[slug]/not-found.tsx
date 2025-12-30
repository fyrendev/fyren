import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <h2 className="text-2xl font-medium mb-4">Status Page Not Found</h2>
        <p className="text-navy-400 mb-6">
          The status page you're looking for doesn't exist.
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
