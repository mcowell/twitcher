"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

export interface AppUser {
  clerkUserId: string;
  email: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  approvedAt: string | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const STATUS_STYLES: Record<AppUser["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export function AdminTable({ initialUsers }: { initialUsers: AppUser[] }) {
  const { getToken } = useAuth();
  const [users, setUsers] = useState(initialUsers);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function updateStatus(clerkUserId: string, status: AppUser["status"]) {
    setPendingId(clerkUserId);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/admin/users/${clerkUserId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Update failed.");
      const updated: AppUser = await response.json();
      setUsers((current) => current.map((user) => (user.clerkUserId === clerkUserId ? updated : user)));
    } finally {
      setPendingId(null);
    }
  }

  async function removeUser(clerkUserId: string, email: string | null) {
    if (!confirm(`Remove ${email ?? "this account"}? This deletes their identification history too.`)) return;

    setPendingId(clerkUserId);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/admin/users/${clerkUserId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Remove failed.");
      setUsers((current) => current.filter((user) => user.clerkUserId !== clerkUserId));
    } finally {
      setPendingId(null);
    }
  }

  if (users.length === 0) {
    return <p className="text-gray-500">No accounts yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-sky-100 bg-white shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="bg-sky-50 text-gray-600">
          <tr>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Signed up</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => (
            <tr key={user.clerkUserId}>
              <td className="px-4 py-3">{user.email ?? <span className="text-gray-400">unknown</span>}</td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[user.status]}`}
                >
                  {user.status}
                </span>
              </td>
              {/* Plain ISO-date slice, not toLocaleDateString() — that
                  formats using the runtime's locale/timezone, which can
                  differ between the server render and the browser and
                  causes a hydration mismatch. */}
              <td className="px-4 py-3 text-gray-500">{user.createdAt.slice(0, 10)}</td>
              <td className="px-4 py-3 flex gap-2">
                {user.status !== "approved" && (
                  <button
                    type="button"
                    disabled={pendingId === user.clerkUserId}
                    onClick={() => updateStatus(user.clerkUserId, "approved")}
                    className="rounded-full bg-sky-600 text-white px-3 py-1 text-xs font-medium hover:bg-sky-700 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    Approve
                  </button>
                )}
                {user.status !== "rejected" && (
                  <button
                    type="button"
                    disabled={pendingId === user.clerkUserId}
                    onClick={() => updateStatus(user.clerkUserId, "rejected")}
                    className="rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs font-medium hover:bg-gray-200 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    Reject
                  </button>
                )}
                {user.status !== "pending" && (
                  <button
                    type="button"
                    disabled={pendingId === user.clerkUserId}
                    onClick={() => updateStatus(user.clerkUserId, "pending")}
                    className="rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs font-medium hover:bg-gray-200 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  disabled={pendingId === user.clerkUserId}
                  onClick={() => removeUser(user.clerkUserId, user.email)}
                  className="rounded-full bg-red-50 text-red-700 px-3 py-1 text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
