import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CommunityList, type CommunityIdentification } from "./community-list";
import { PendingApproval } from "../pending-approval";
import { ServiceUnavailable } from "../service-unavailable";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const PAGE_SIZE = 30;

export default async function CommunityPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/");

  let response: Response;
  try {
    const token = await getToken();
    response = await fetch(`${API_BASE_URL}/community?limit=${PAGE_SIZE}&offset=0`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return <ServiceUnavailable />;
  }

  if (response.status === 403) return <PendingApproval />;
  if (!response.ok) return <ServiceUnavailable />;

  const identifications: CommunityIdentification[] = await response.json();

  return (
    <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Community sightings</h1>
      <CommunityList initialIdentifications={identifications} pageSize={PAGE_SIZE} />
    </main>
  );
}
