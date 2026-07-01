import clsx from "clsx";

type IconProps = {
  name: string;
  className?: string;
  monochrome?: boolean;
  active?: boolean;
};

const emojiFor = (name: string): string => {
  const map: Record<string, string> = {
    // activity icons
    piano: "🎹",
    music: "🎵",
    book: "📖",
    meal: "🍜",
    bottle: "🍼",
    backpack: "🎒",
    soccer: "⚽",
    muscle: "💪",
    "video-heart": "📹",
    photos: "🖼️",
    "camera-note": "📷",
    bell: "🔔",
    calendar: "🗓️",
    spark: "✨",
    robot: "🤖",
    // people
    person: "🧑",
    girl: "👧",
    boy: "👦",
    baby: "👶",
    mom: "👩",
    dad: "👨",
    grandma: "👵",
    // nav / misc
    home: "🏠",
    map: "🗺️",
    family: "👨‍👩‍👧‍👦",
    heart: "❤️",
    "mail-heart": "💌",
    phone: "📞",
    shield: "🛡️",
    pencil: "✏️",
  };
  return map[name] ?? "⭐";
};

export function DoodleIcon({ name, className, monochrome = false, active = false }: IconProps) {
  const emoji = emojiFor(name);
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "flex items-center justify-center select-none leading-none",
        monochrome && "grayscale",
        className ?? "h-11 w-11 text-3xl"
      )}
      style={{ fontSize: "inherit" }}
    >
      {emoji}
    </span>
  );
}
