import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface KeyboardNavProps {
  onAddTransaction: () => void;
  onToggleShortcuts: () => void;
}

export function useKeyboardNav({ onAddTransaction, onToggleShortcuts }: KeyboardNavProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input, textarea, or select
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT")
      ) {
        return;
      }

      if (!e.altKey || e.ctrlKey || e.metaKey) return;

      const code = e.code;
      let handled = false;

      switch (code) {
        case "Digit1":
        case "Numpad1":
          navigate("/");
          handled = true;
          break;
        case "Digit2":
        case "Numpad2":
          navigate("/budget");
          handled = true;
          break;
        case "Digit3":
        case "Numpad3":
          navigate("/transactions");
          handled = true;
          break;
        case "Digit4":
        case "Numpad4":
          navigate("/splits");
          handled = true;
          break;
        case "Digit5":
        case "Numpad5":
          navigate("/accounts");
          handled = true;
          break;
        case "Digit6":
        case "Numpad6":
          navigate("/settings");
          handled = true;
          break;
        case "KeyT":
          onAddTransaction();
          handled = true;
          break;
        case "KeyF":
          // Dispatch event that Transactions.tsx will listen for
          window.dispatchEvent(new CustomEvent("fincheck:open-search"));
          handled = true;
          break;
        case "Slash":
        case "NumpadDivide":
          onToggleShortcuts();
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, onAddTransaction, onToggleShortcuts]);
}
