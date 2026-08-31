import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Icon } from "../lib/icons";

const items = [
  { to: "/", name: "home", label: "Home" },
  { to: "/budget", name: "invest", label: "Budget" },
  { to: "/transactions", name: "activity", label: "Activity" },
  { to: "/splits", name: "transfer", label: "Splits" },
  { to: "/accounts", name: "wallet", label: "Accounts" },
  { to: "/settings", name: "settings", label: "Settings" },
];

/** Persistent left rail shown on desktop in place of the floating pill nav. */
export function SideNav({ onAdd }: { onAdd: () => void }) {
  const { user } = useAuth();
  const initial = (user?.name ?? user?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <aside className="sidenav">
      <div className="sidenav-brand">
        <span className="sidenav-logo"><Icon name="rupee" /></span>
        <span className="sidenav-word serif">FinCheck</span>
      </div>

      <button className="sidenav-add" onClick={onAdd}>
        <Icon name="plus" /> Add transaction
      </button>

      <nav className="sidenav-links" aria-label="Primary">
        {items.map(({ to, name, label }) => (
          <NavLink key={to} to={to} end={to === "/"} className="sidenav-link">
            <Icon name={name} className="sidenav-link-icon" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {user && (
        <NavLink to="/settings" className="sidenav-foot">
          <span className="sidenav-avatar">{initial}</span>
          <span className="sidenav-user">
            <span className="sidenav-user-name">{user.name || "Account"}</span>
            <span className="sidenav-user-mail">{user.email}</span>
          </span>
        </NavLink>
      )}
    </aside>
  );
}
