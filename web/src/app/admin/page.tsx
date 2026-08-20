import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminTable, type AppUser } from "./admin-table";
import { NotificationEmails } from "./notification-emails";
import { ServiceUnavailable } from "../service-unavailable";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default async function AdminPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/");

  let usersResponse: Response;
  let emailsResponse: Response;
  try {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}` };
    [usersResponse, emailsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/admin/users`, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) }),
      fetch(`${API_BASE_URL}/admin/notification-emails`, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      }),
    ]);
  } catch {
    return <ServiceUnavailable />;
  }

  if (usersResponse.status === 403) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-gray-500">You don&apos;t have access to this page.</p>
      </main>
    );
  }

  if (!usersResponse.ok || !emailsResponse.ok) return <ServiceUnavailable />;

  const users: AppUser[] = await usersResponse.json();
  const notificationEmails: string[] = await emailsResponse.json();

  return (
    <main className="flex-1 p-8 max-w-4xl mx-auto w-full flex flex-col gap-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Account approvals</h1>
        <Link href="/admin/queue" className="text-sm font-medium text-sky-700 hover:underline">
          Frigate review queue →
        </Link>
      </div>
      <div>
        <AdminTable initialUsers={users} />
      </div>
      <NotificationEmails initialEmails={notificationEmails} />
    </main>
  );
}
