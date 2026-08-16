import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AdminTable, type AppUser } from "./admin-table";
import { ServiceUnavailable } from "../service-unavailable";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default async function AdminPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/");

  let response: Response;
  try {
    const token = await getToken();
    response = await fetch(`${API_BASE_URL}/admin/users`, {
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

  const users: AppUser[] = await response.json();

  return (
    <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Account approvals</h1>
      <AdminTable initialUsers={users} />
    </main>
  );
}
