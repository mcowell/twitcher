import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import { ResetProvider } from "./reset-context";
import { HeaderLogo } from "./header-logo";
import { getMe } from "./get-me";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Twitcher",
  description: "Upload a bird photo and get it identified by Claude.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const result = await getMe();
  const isAdmin = result.kind === "ok" && result.me.isAdmin;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gradient-to-b from-sky-50 to-white text-gray-900">
        <ClerkProvider>
          <ResetProvider>
            <header className="flex items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-sky-600 to-sky-800">
              <HeaderLogo />
              <Show when="signed-out">
                <div className="flex items-center gap-2">
                  <SignInButton>
                    <button
                      type="button"
                      className="rounded-full px-4 py-1.5 text-sm font-medium text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Login
                    </button>
                  </SignInButton>
                  <SignUpButton>
                    <button
                      type="button"
                      className="rounded-full bg-white text-sky-700 px-4 py-1.5 text-sm font-medium hover:bg-sky-50 transition-colors cursor-pointer"
                    >
                      Sign up
                    </button>
                  </SignUpButton>
                </div>
              </Show>
              <Show when="signed-in">
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="rounded-full px-4 py-1.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
                    >
                      Admin
                    </Link>
                  )}
                  <UserButton
                    showName
                    appearance={{
                      elements: {
                        // A className string lost a specificity fight against
                        // Clerk's own component styles. This CSS-object form
                        // applies as inline styles instead, which reliably wins.
                        userButtonOuterIdentifier: {
                          color: "#ffffff",
                          fontWeight: 700,
                        },
                      },
                    }}
                  />
                </div>
              </Show>
            </header>
            {children}
          </ResetProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
