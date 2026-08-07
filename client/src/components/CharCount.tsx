interface CharCountProps {
  current: number;
  max: number;
}

export function CharCount({ current, max }: CharCountProps) {
  // Only show counter when user reaches 75% of max capacity to reduce UI noise
  if (current < Math.floor(max * 0.75)) return null;

  const isNearLimit = current >= max * 0.9;
  const isAtLimit = current >= max;

  return (
    <span
      className={`char-count ${isAtLimit ? "limit-reached" : isNearLimit ? "near-limit" : ""}`}
    >
      {current}/{max}
    </span>
  );
}
