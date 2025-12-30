import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-4">
        <h1 className="text-6xl font-bold mb-4">Fyren</h1>
        <p className="text-xl text-navy-300 mb-2">
          The open source lighthouse for your services
        </p>
        <p className="text-navy-400 mb-8">
          An open source, self-hosted status page and incident management platform.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/admin"
            className="px-6 py-3 bg-white text-navy-900 font-medium rounded-lg hover:bg-navy-100 transition-colors"
          >
            Admin Dashboard
          </Link>
          <a
            href="https://github.com/fyrendev/fyren"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-navy-800 text-white font-medium rounded-lg hover:bg-navy-700 transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
