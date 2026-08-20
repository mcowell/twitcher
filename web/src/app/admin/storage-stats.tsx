export interface StorageStats {
  imageCount: number;
  totalBytes: number;
}

// Matches Supabase's free-tier Storage quota (separate from the 500MB
// database quota — image bytes live in Storage, not in a table).
const FREE_TIER_BYTES = 1024 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function StorageStatsCard({ stats }: { stats: StorageStats }) {
  const percentUsed = (stats.totalBytes / FREE_TIER_BYTES) * 100;

  return (
    <div className="rounded-2xl border border-sky-100 bg-white shadow-sm p-5 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-gray-700">Storage</p>
        <p className="text-xs text-gray-500 mt-1">
          {stats.imageCount} image{stats.imageCount === 1 ? "" : "s"} · {formatBytes(stats.totalBytes)} used
        </p>
      </div>
      <div className="text-right">
        <p className="text-lg font-semibold text-sky-700">{percentUsed.toFixed(2)}%</p>
        <p className="text-xs text-gray-400">of 1GB free tier</p>
      </div>
    </div>
  );
}
