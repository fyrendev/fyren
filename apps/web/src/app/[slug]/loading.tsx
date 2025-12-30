export default function Loading() {
  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-navy-800 rounded animate-pulse" />
          <div className="h-8 w-48 bg-navy-800 rounded animate-pulse" />
        </div>

        {/* Status banner skeleton */}
        <div className="mt-6 h-20 bg-navy-800 rounded-lg animate-pulse" />

        {/* Components skeleton */}
        <div className="mt-8">
          <div className="h-6 w-32 bg-navy-800 rounded animate-pulse mb-4" />
          <div className="bg-navy-900 rounded-lg border border-navy-800 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="px-4 py-4 border-b border-navy-800 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-navy-700 rounded-full animate-pulse" />
                    <div className="h-5 w-24 bg-navy-700 rounded animate-pulse" />
                  </div>
                  <div className="h-5 w-16 bg-navy-700 rounded animate-pulse" />
                </div>
                <div className="mt-3 h-8 bg-navy-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Subscribe skeleton */}
        <div className="mt-12 bg-navy-900 border border-navy-800 rounded-lg p-6">
          <div className="h-5 w-40 bg-navy-800 rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-navy-800 rounded animate-pulse mb-4" />
          <div className="flex gap-2">
            <div className="flex-1 h-10 bg-navy-800 rounded-lg animate-pulse" />
            <div className="w-28 h-10 bg-navy-700 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
