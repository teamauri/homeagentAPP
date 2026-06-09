import clsx from "clsx";

type IconProps = {
  name: string;
  className?: string;
  monochrome?: boolean;
  active?: boolean;
};

const accentFor = (name: string) => {
  const map: Record<string, string> = {
    piano: "#7A55C7",
    music: "#7A55C7",
    book: "#E24F4F",
    meal: "#2F9D5B",
    bottle: "#2E7DD1",
    robot: "#00A8A8",
    "mail-heart": "#DB5A82",
    "camera-note": "#2E7DD1",
    calendar: "#2E7DD1",
    spark: "#C08A2B",
    soccer: "#2F9D5B",
    phone: "#7A55C7",
    person: "#C08A2B",
    backpack: "#E07A2F",
    "video-heart": "#DB5A82",
  };
  return map[name] ?? "#C08A2B";
};

export function DoodleIcon({ name, className, monochrome = false, active = false }: IconProps) {
  const accent = monochrome ? (active ? "#080808" : "#7a7a7a") : accentFor(name);
  const stroke = monochrome ? (active ? "#080808" : "#7a7a7a") : "#080808";
  const fillActive = active ? "#080808" : "none";
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={clsx("h-11 w-11", className)}>
      <g fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {name === "piano" || name === "music" ? (
          <>
            <path d="M18 44V16l28-4v28" />
            <circle cx="15" cy="46" r="7" />
            <circle cx="43" cy="42" r="7" />
            <path d="M18 24l28-4" stroke={accent} />
            <path d="M50 12l5-6M55 22h6M49 30l5 5" stroke={accent} />
          </>
        ) : name === "book" ? (
          <>
            <path d="M12 16c8-2 14 0 20 5v31c-6-5-12-7-20-5z" />
            <path d="M52 16c-8-2-14 0-20 5v31c6-5 12-7 20-5z" />
            <path d="M32 21v31" stroke={accent} />
            <path d="M18 26h8M38 26h8" />
            <path d="M14 11l-4-5M48 11l4-5" stroke={accent} />
          </>
        ) : name === "robot" ? (
          <>
            <rect x="14" y="19" width="36" height="28" rx="8" />
            <circle cx="26" cy="33" r="3" fill="#080808" />
            <circle cx="38" cy="33" r="3" fill="#080808" />
            <path d="M28 42h8" />
            <path d="M32 19V10M28 10h8" />
            <path d="M9 26l-5-4M55 26l5-4M10 41l-6 3M54 41l6 3" stroke={accent} />
          </>
        ) : name === "mail-heart" ? (
          <>
            <rect x="12" y="20" width="40" height="28" rx="4" />
            <path d="M12 24l20 14 20-14" />
            <path d="M32 34c-6-4-10-7-10-12 0-3 2-5 5-5 2 0 4 1 5 3 1-2 3-3 5-3 3 0 5 2 5 5 0 5-4 8-10 12z" stroke={accent} />
          </>
        ) : name === "camera-note" ? (
          <>
            <rect x="14" y="20" width="36" height="28" rx="5" />
            <path d="M24 20l3-6h10l3 6" />
            <circle cx="32" cy="34" r="8" />
            <path d="M45 25h1" />
            <path d="M27 52h20" stroke={accent} />
          </>
        ) : name === "calendar" ? (
          <>
            <rect x="13" y="16" width="38" height="36" rx="5" />
            <path d="M13 26h38M22 11v10M42 11v10" />
            <path d="M22 34h6M34 34h6M22 43h6M34 43h6" stroke={accent} />
          </>
        ) : name === "meal" ? (
          <>
            <path d="M13 30h38c-2 13-8 20-19 20S15 43 13 30z" />
            <path d="M19 30c1-8 7-13 13-13s12 5 13 13" />
            <path d="M24 17c-2-4 1-7 5-7M36 17c-1-5 3-8 7-6" stroke={accent} />
          </>
        ) : name === "bottle" ? (
          <>
            <path d="M26 10h12v11l4 6v23c0 3-2 5-5 5H27c-3 0-5-2-5-5V27l4-6z" />
            <path d="M26 18h12M22 36h20" />
            <path d="M42 42c-5 2-9 2-14 0" stroke={accent} />
          </>
        ) : name === "pencil" ? (
          <>
            <path d="M16 48l8-2 26-26-6-6-26 26z" />
            <path d="M39 19l6 6" />
            <path d="M15 54h34" stroke={accent} />
          </>
        ) : name === "soccer" ? (
          <>
            <circle cx="32" cy="32" r="20" />
            <path d="M32 20l8 6-3 10H27l-3-10z" />
            <path d="M24 26l-9 2M40 26l9 2M27 36l-6 10M37 36l6 10" stroke={accent} />
          </>
        ) : name === "backpack" ? (
          <>
            <rect x="18" y="22" width="28" height="30" rx="6" />
            <path d="M24 22c1-7 15-7 16 0M18 33h28M25 43h14" />
            <path d="M14 30c0-5 2-8 4-8M50 30c0-5-2-8-4-8" stroke={accent} />
          </>
        ) : name === "video-heart" ? (
          <>
            <rect x="13" y="19" width="34" height="26" rx="5" />
            <path d="M47 27l10-7v24l-10-7z" />
            <path d="M30 36c-5-3-8-6-8-10 0-2 2-4 4-4 2 0 3 1 4 3 1-2 2-3 4-3 2 0 4 2 4 4 0 4-3 7-8 10z" stroke={accent} />
          </>
        ) : name === "phone" ? (
          <>
            <rect x="22" y="9" width="20" height="46" rx="6" />
            <path d="M29 49h6" />
            <path d="M16 24l-5-4M48 24l5-4M16 40l-5 4M48 40l5 4" stroke={accent} />
          </>
        ) : name === "photos" ? (
          <>
            <circle cx="32" cy="32" r="7" stroke={accent} />
            <path d="M32 10v15M32 39v15M10 32h15M39 32h15M17 17l10 10M37 37l10 10M47 17L37 27M27 37L17 47" />
          </>
        ) : name === "shield" ? (
          <>
            <path d="M32 10l18 7v12c0 12-8 20-18 25-10-5-18-13-18-25V17z" />
            <path d="M24 32l6 6 12-14" stroke={accent} />
          </>
        ) : name === "heart" ? (
          <path d="M32 50C20 42 12 35 12 24c0-7 5-12 12-12 4 0 7 2 8 5 1-3 4-5 8-5 7 0 12 5 12 12 0 11-8 18-20 26z" fill={fillActive} stroke={accent} />
        ) : name === "home" ? (
          <>
            <path d="M12 31L32 14l20 17" fill="none" />
            <path d="M18 29v23h28V29" fill={fillActive} />
            <path d="M28 52V39h8v13" stroke={active ? "#ffffff" : stroke} />
          </>
        ) : name === "map" ? (
          <>
            <path d="M14 16l12-5 12 5 12-5v37l-12 5-12-5-12 5z" fill={fillActive} />
            <path d="M26 11v37M38 16v37" stroke={active ? "#ffffff" : stroke} />
          </>
        ) : name === "family" ? (
          <>
            <circle cx="24" cy="24" r="7" fill={active ? "#080808" : "none"} />
            <circle cx="42" cy="26" r="6" fill={active ? "#080808" : "none"} />
            <path d="M11 52c2-11 9-18 17-18 7 0 13 5 15 14" fill={fillActive} />
            <path d="M34 52c1-8 6-13 12-13 5 0 9 4 10 13" fill={fillActive} />
          </>
        ) : name === "bell" ? (
          <>
            <path d="M20 42h24l-3-5V27c0-7-4-12-9-12s-9 5-9 12v10z" />
            <path d="M28 47c1 3 7 3 8 0" stroke={accent} />
          </>
        ) : name === "person" ? (
          <>
            <circle cx="32" cy="22" r="9" />
            <path d="M16 52c2-10 10-16 16-16s14 6 16 16" stroke={accent} />
          </>
        ) : name === "spark" ? (
          <>
            <path d="M32 8l5 17 17 7-17 7-5 17-5-17-17-7 17-7z" />
            <path d="M14 12l3 8M50 12l-3 8M14 52l3-8M50 52l-3-8" stroke={accent} />
          </>
        ) : name === "girl" || name === "boy" || name === "baby" || name === "mom" || name === "dad" || name === "grandma" ? (
          <>
            <circle cx="32" cy="24" r="10" />
            <path d="M16 54c2-12 10-18 16-18s14 6 16 18" />
            <path d="M23 17c4-7 14-7 18 0" stroke={accent} />
          </>
        ) : (
          <>
            <circle cx="32" cy="32" r="18" />
            <path d="M24 32h16M32 24v16" stroke={accent} />
          </>
        )}
      </g>
    </svg>
  );
}
