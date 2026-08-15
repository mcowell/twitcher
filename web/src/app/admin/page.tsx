import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AdminTable, type AppUser } from "./admin-table";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default async function AdminPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/");

  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (response.status === 403) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-gray-500">You don&apos;t have access to this page.</p>
      </main>
    );
  }

  const users: AppUser[] = await response.json();

  return (
    <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Account approvals</h1>
      <AdminTable initialUsers={users} />
    </main>
  );
}
