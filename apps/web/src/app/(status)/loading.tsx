export default function Loading() {
  return (
    <div className="min-h-screen status-page-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded animate-pulse"
            style={{ backgroundColor: "var(--card-bg)" }}
          />
          <div
            className="h-8 w-48 rounded animate-pulse"
            style={{ backgroundColor: "var(--card-bg)" }}
          />
        </div>

        {/* Status banner skeleton */}
        <div
          className="mt-6 h-20 rounded-lg animate-pulse"
          style={{ backgroundColor: "var(--card-bg)" }}
        />

        {/* Components skeleton */}
        <div className="mt-8">
          <div
            className="h-6 w-32 rounded animate-pulse mb-4"
            style={{ backgroundColor: "var(--card-bg)" }}
          />
          <div
            className="rounded-lg overflow-hidden"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
          >
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="px-4 py-4"
                style={{ borderBottom: i < 4 ? "1px solid var(--card-border)" : "none" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{ backgroundColor: "var(--input-bg)" }}
                    />
                    <div
                      className="h-5 w-24 rounded animate-pulse"
                      style={{ backgroundColor: "var(--input-bg)" }}
                    />
                  </div>
                  <div
                    className="h-5 w-16 rounded animate-pulse"
                    style={{ backgroundColor: "var(--input-bg)" }}
                  />
                </div>
                <div
                  className="mt-3 h-8 rounded animate-pulse"
                  style={{ backgroundColor: "var(--input-bg)" }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Subscribe skeleton */}
        <div
          className="mt-12 rounded-lg p-6"
          style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
          <div
            className="h-5 w-40 rounded animate-pulse mb-2"
            style={{ backgroundColor: "var(--input-bg)" }}
          />
          <div
            className="h-4 w-64 rounded animate-pulse mb-4"
            style={{ backgroundColor: "var(--input-bg)" }}
          />
          <div className="flex gap-2">
            <div
              className="flex-1 h-10 rounded-lg animate-pulse"
              style={{ backgroundColor: "var(--input-bg)" }}
            />
            <div
              className="w-28 h-10 rounded-lg animate-pulse"
              style={{ backgroundColor: "var(--input-border)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
