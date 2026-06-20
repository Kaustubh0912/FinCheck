import { NavLink } from "react-router-dom";
import { Icon } from "../lib/icons";

const items = [
  { to: "/", name: "home", label: "Home" },
  { to: "/transactions", name: "activity", label: "Activity" },
  { to: "/splits", name: "transfer", label: "Splits" },
  { to: "/accounts", name: "wallet", label: "Accounts" },
];

export function PillNav({ onAdd }: { onAdd: () => void }) {
  return (
    <nav className="pillnav" aria-label="Primary">
      <div className="pillnav-inner">
        {items.slice(0, 2).map(({ to, name, label }) => (
          <NavLink key={to} to={to} end={to === "/"} className="pillnav-item" aria-label={label}>
            <Icon name={name} />
          </NavLink>
        ))}

        <button className="pillnav-add" onClick={onAdd} aria-label="Add transaction">
          <Icon name="plus" />
        </button>

        {items.slice(2).map(({ to, name, label }) => (
          <NavLink key={to} to={to} className="pillnav-item" aria-label={label}>
            <Icon name={name} />
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
