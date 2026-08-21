import { CommunityList, type CommunityIdentification } from "./community-list";
import { ServiceUnavailable } from "../service-unavailable";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const PAGE_SIZE = 30;

// Deliberately public — no auth() call, no redirect, no token on the
// fetch. GET /community is itself unauthenticated (see community.ts).
export default async function CommunityPage() {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/community?limit=${PAGE_SIZE}&offset=0`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return <ServiceUnavailable />;
  }

  if (!response.ok) return <ServiceUnavailable />;

  const identifications: CommunityIdentification[] = await response.json();

  return (
    <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Community sightings</h1>
      <CommunityList initialIdentifications={identifications} pageSize={PAGE_SIZE} />
    </main>
  );
}
