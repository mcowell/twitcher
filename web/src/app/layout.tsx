import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider, SignInButton, Show, UserButton } from "@clerk/nextjs";
import { ResetProvider } from "./reset-context";
import { HeaderLogo } from "./header-logo";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gradient-to-b from-sky-50 to-white text-gray-900">
        <ClerkProvider>
          <ResetProvider>
            <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-sky-100 bg-white/70 backdrop-blur">
              <HeaderLogo />
              <Show when="signed-out">
                <SignInButton />
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </header>
            {children}
          </ResetProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
