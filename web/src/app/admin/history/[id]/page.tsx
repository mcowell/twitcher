import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ServiceUnavailable } from "../../../service-unavailable";
import { ShareToggle } from "../../../share-toggle";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

interface AdminIdentificationDetail {
  id: string;
  imageUrl: string;
  commonName: string;
  scientificName: string;
  isFictionalOrCostume: boolean;
  confidence: "low" | "medium" | "high";
  description: string;
  alternativePossibilities: Array<{ commonName: string; scientificName: string; reason: string }>;
  createdAt: string;
  isPublic: boolean;
  email: string | null;
}

const CONFIDENCE_STYLES: Record<AdminIdentificationDetail["confidence"], string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-red-100 text-red-800",
};

export default async function AdminIdentificationDetailPage(props: PageProps<"/admin/history/[id]">) {
  const { id } = await props.params;
  const { userId, getToken } = await auth();
  if (!userId) redirect("/");

  let response: Response;
  try {
    const token = await getToken();
    response = await fetch(`${API_BASE_URL}/admin/identifications/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return <ServiceUnavailable />;
  }

  if (response.status === 403) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-gray-500">You don&apos;t have access to this page.</p>
      </main>
    );
  }

  if (response.status === 404) notFound();
  if (!response.ok) return <ServiceUnavailable />;

  const item: AdminIdentificationDetail = await response.json();

  return (
    <main className="flex-1 p-8 max-w-2xl mx-auto w-full flex flex-col gap-6">
      <Link href="/admin/history" className="text-sm font-medium text-sky-700 hover:underline self-start">
        ← Identification history
      </Link>

      {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, not worth next/image remote-origin config */}
      <img src={item.imageUrl} alt={item.commonName} className="w-full rounded-2xl object-cover max-h-[32rem]" />

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">
            {item.commonName}
            {item.isFictionalOrCostume && " 🎭"}
          </h1>
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${CONFIDENCE_STYLES[item.confidence]}`}
          >
            {item.confidence} confidence
          </span>
        </div>
        <p className="italic text-sm text-gray-500">{item.scientificName}</p>
        <p className="text-sm">{item.description}</p>
        {item.alternativePossibilities.length > 0 && (
          <div className="mt-2">
            <p className="text-sm font-medium">Other possibilities:</p>
            <ul className="text-sm list-disc list-inside text-gray-600">
              {item.alternativePossibilities.map((alt) => (
                <li key={alt.commonName}>
                  {alt.commonName} ({alt.scientificName}) — {alt.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">
          {item.email ?? "unknown"} · {/* Plain ISO-date slice, not toLocaleDateString() — see admin-table.tsx */}
          {item.createdAt.slice(0, 10)}
        </p>
        <div className="border-t border-gray-100 mt-2 pt-3">
          <ShareToggle id={item.id} initialIsPublic={item.isPublic} adminOverride />
        </div>
      </div>
    </main>
  );
}
