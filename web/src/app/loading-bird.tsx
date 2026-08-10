// A little animated bluebird for the loading state. Pure SVG + CSS keyframes
// (defined in globals.css) — no image assets or animation libraries needed.
// Wings "flap" via a squash-on-the-downbeat scaleY, and the whole bird bobs
// up and down, like it's hovering while Claude works.
export function LoadingBird() {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <svg
        viewBox="0 0 100 100"
        className="w-20 h-20 motion-safe:animate-[bird-bob_1s_ease-in-out_infinite]"
        aria-hidden
      >
        <ellipse
          cx="30"
          cy="50"
          rx="15"
          ry="8"
          fill="#0284c7"
          style={{ transformOrigin: "30px 50px" }}
          className="motion-safe:animate-[bird-flap-left_0.5s_ease-in-out_infinite]"
        />
        <ellipse
          cx="70"
          cy="50"
          rx="15"
          ry="8"
          fill="#0284c7"
          style={{ transformOrigin: "70px 50px" }}
          className="motion-safe:animate-[bird-flap-right_0.5s_ease-in-out_infinite]"
        />
        <ellipse cx="50" cy="55" rx="18" ry="15" fill="#38bdf8" />
        <ellipse cx="50" cy="63" rx="11" ry="8" fill="#f0f9ff" />
        <circle cx="50" cy="35" r="13" fill="#38bdf8" />
        <circle cx="55" cy="33" r="2.2" fill="#0f172a" />
        <path d="M62 36 L73 39 L62 42 Z" fill="#f59e0b" />
      </svg>
      <p className="text-sm text-gray-500">Identifying your bird…</p>
    </div>
  );
}
