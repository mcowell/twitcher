import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HistoryGrid, type HistoryIdentification } from "./history-grid";
import { ServiceUnavailable } from "../../service-unavailable";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const PAGE_SIZE = 30;

export default async function HistoryPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/");

  let response: Response;
  try {
    const token = await getToken();
    response = await fetch(`${API_BASE_URL}/admin/identifications?limit=${PAGE_SIZE}&offset=0`, {
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

  if (!response.ok) return <ServiceUnavailable />;

  const identifications: HistoryIdentification[] = await response.json();

  return (
    <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Identification history</h1>
        <Link href="/admin" className="text-sm font-medium text-sky-700 hover:underline">
          ← Account approvals
        </Link>
      </div>
      <HistoryGrid initialIdentifications={identifications} pageSize={PAGE_SIZE} />
    </main>
  );
}
