"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { LoadingBird } from "./loading-bird";

type Status = "idle" | "loading" | "error" | "success";

// The shape of the Express API's response. Duplicated here rather than
// shared/imported — web/ and api/ are separately deployed services now, so
// this is just the contract between them, not internal code reuse.
interface BirdIdentification {
  isBird: boolean;
  isFictionalOrCostume: boolean;
  commonName: string;
  scientificName: string;
  confidence: "low" | "medium" | "high";
  description: string;
  alternativePossibilities: Array<{
    commonName: string;
    scientificName: string;
    reason: string;
  }>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const CONFIDENCE_STYLES: Record<BirdIdentification["confidence"], string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-red-100 text-red-800",
};

export function UploadForm() {
  const { getToken } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<BirdIdentification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Object URLs aren't freed automatically — revoke the previous one
  // whenever it changes, and on unmount (e.g. the header logo resetting
  // this component away). Also cancel any in-flight request on unmount so
  // clicking reset mid-request doesn't burn an API call in the background.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const selectFile = useCallback((selected: File | undefined | null) => {
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError(`Unsupported file type: ${selected.type || "unknown"}. Use JPEG, PNG, WEBP, or GIF.`);
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setResult(null);
    setError(null);
    setStatus("idle");
  }, []);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  async function handleSubmit() {
    if (!file) return;
    setStatus("loading");
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("image", file);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Fetch a fresh Clerk session token for this request. The Clerk SDK
      // caches/refreshes under the hood, so this is cheap to call every time.
      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in.");
      }

      const response = await fetch(`${API_BASE_URL}/identify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Something went wrong.");
      }
      setResult(data as BirdIdentification);
      setStatus("success");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <div className="w-full flex flex-col md:flex-row gap-6 items-start">
      {/* Left panel (top on mobile): the dropzone + submit control */}
      <div className="w-full md:flex-1 flex flex-col gap-4">
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-sky-500 bg-sky-50"
              : "border-gray-300 bg-white hover:border-sky-400 hover:bg-sky-50/50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={(event) => selectFile(event.target.files?.[0])}
            className="hidden"
          />
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL, not worth next/image config
            <img src={previewUrl} alt="Selected bird" className="max-h-64 rounded-lg object-contain" />
          ) : (
            <>
              <span className="text-4xl" aria-hidden>
                📷
              </span>
              <p className="font-medium text-gray-700">Drag a photo here, or click to browse</p>
              <p className="text-xs text-gray-500">JPEG, PNG, WEBP, or GIF</p>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!file || status === "loading"}
          className="flex items-center justify-center gap-2 rounded-full bg-sky-600 text-white py-2.5 font-medium transition-colors hover:bg-sky-700 disabled:opacity-40 disabled:hover:bg-sky-600"
        >
          {status === "loading" && (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden
            />
          )}
          {status === "loading" ? "Identifying…" : "Identify bird"}
        </button>
      </div>

      {/* Right panel (bottom on mobile): status / result — always rendered so
          the two-column layout stays balanced on desktop, not just once a
          result exists. */}
      <div className="w-full md:flex-1">
        {status === "loading" ? (
          <div className="rounded-2xl border border-sky-100 bg-white p-5 flex items-center justify-center">
            <LoadingBird />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        ) : result ? (
          <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm flex flex-col gap-2">
            {!result.isBird ? (
              <p>No bird detected in this image.</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">
                    {result.commonName}
                    {result.isFictionalOrCostume && " 🎭"}
                  </h2>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${CONFIDENCE_STYLES[result.confidence]}`}
                  >
                    {result.confidence} confidence
                  </span>
                </div>
                <p className="italic text-sm text-gray-500">{result.scientificName}</p>
                <p className="text-sm">{result.description}</p>
                {result.alternativePossibilities.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Other possibilities:</p>
                    <ul className="text-sm list-disc list-inside text-gray-600">
                      {result.alternativePossibilities.map((alt) => (
                        <li key={alt.commonName}>
                          {alt.commonName} ({alt.scientificName}) — {alt.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 p-5 text-sm text-gray-400 text-center">
            Your identification will show up here.
          </div>
        )}
      </div>
    </div>
  );
}
