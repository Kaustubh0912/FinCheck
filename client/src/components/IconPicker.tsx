import { Icon, ICON_CHOICES } from "../lib/icons";

/** A scrollable grid of Font Awesome icons to pick from. */
export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color: string;
  onChange: (slug: string) => void;
}) {
  return (
    <div className="icon-picker">
      {ICON_CHOICES.map((slug) => (
        <button
          key={slug}
          type="button"
          className={`icon-pick ${value === slug ? "icon-pick-active" : ""}`}
          style={value === slug ? { borderColor: color, color } : undefined}
          onClick={() => onChange(slug)}
          aria-label={slug}
        >
          <Icon name={slug} />
        </button>
      ))}
    </div>
  );
}
