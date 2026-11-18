import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "../lib/icons";

function supportsAnchoredPopoverPositioning() {
  return typeof CSS !== "undefined" &&
    CSS.supports("position-area", "block-end") &&
    CSS.supports("width", "anchor-size(width)");
}

export interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
}

/**
 * A branded select combining high-fidelity editorial styling (per-option icons,
 * paper/ink theme, checkmarks) with modern accessibility (ARIA combobox/listbox,
 * full keyboard navigation, typeahead) and native Top-Layer rendering via the Popover API.
 */
export function Dropdown({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const typeaheadBuffer = useRef("");
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout>>();

  const selected = options[selectedIndex] ?? options[0];

  // Keep highlighted index in sync when selected value changes
  useEffect(() => {
    const idx = options.findIndex((o) => o.value === value);
    if (idx >= 0) setHighlightedIndex(idx);
  }, [value, options]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !popoverRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 6;
    const availableWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
    const width = Math.min(rect.width, availableWidth);
    const maxHeight = Math.max(0, Math.min(260, window.innerHeight * 0.42));
    const estimatedHeight = Math.max(popoverRef.current.scrollHeight, options.length * 40 + 14);
    const menuHeight = Math.min(estimatedHeight, maxHeight);
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const spaceAbove = rect.top - gap - viewportPadding;
    const opensAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;
    const top = opensAbove
      ? Math.max(viewportPadding, rect.top - gap - menuHeight)
      : Math.min(rect.bottom + gap, window.innerHeight - menuHeight - viewportPadding);
    const left = Math.max(
      viewportPadding,
      Math.min(rect.left, window.innerWidth - width - viewportPadding)
    );

    const style = popoverRef.current.style;
    style.position = "fixed";
    style.margin = "0";
    style.inset = "auto";
    style.top = `${top}px`;
    style.left = `${left}px`;
    style.width = `${width}px`;
    style.maxWidth = `${availableWidth}px`;
    style.maxHeight = `${maxHeight}px`;
  }, [options.length]);

  // Sync Popover native open/closed states via the native 'toggle' event
  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    const onToggle = (e: Event) => {
      const isNowOpen = (e as unknown as { newState?: string }).newState === "open";
      setOpen(isNowOpen);
      if (isNowOpen && !supportsAnchoredPopoverPositioning()) {
        updatePosition();
      }
    };

    popover.addEventListener("toggle", onToggle);
    return () => popover.removeEventListener("toggle", onToggle);
  }, [updatePosition]);

  // Keep the non-anchor-positioning fallback attached during scrolling/resizing.
  useEffect(() => {
    if (!open || supportsAnchoredPopoverPositioning()) return;

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  // Keep the active descendant visible as keyboard navigation changes it.
  useEffect(() => {
    if (!open) return;
    const activeOptionId = `${listId}-opt-${options[highlightedIndex]?.value}`;
    document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [open, highlightedIndex, listId, options]);

  function toggleDropdown(initialIndex = selectedIndex >= 0 ? selectedIndex : 0) {
    const popover = popoverRef.current;
    const trigger = triggerRef.current;
    if (!popover || !trigger) return;

    if (open) {
      popover.hidePopover?.();
    } else {
      setHighlightedIndex(initialIndex);
      if (!supportsAnchoredPopoverPositioning()) updatePosition();
      if (typeof popover.showPopover === "function") {
        // The project's DOM lib predates `showPopover({ source })`; keep the cast local.
        const showPopoverWithSource = popover.showPopover as unknown as (
          this: HTMLUListElement,
          options: { source: HTMLButtonElement }
        ) => void;
        showPopoverWithSource.call(popover, { source: trigger });
      }
    }
  }

  function selectOption(val: string) {
    onChange(val);
    popoverRef.current?.hidePopover?.();
    triggerRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (options.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        toggleDropdown();
      } else {
        setHighlightedIndex((prev) => (prev + 1) % options.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        toggleDropdown();
      } else {
        setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      if (open) setHighlightedIndex(0);
      else toggleDropdown(0);
    } else if (e.key === "End") {
      e.preventDefault();
      if (open) setHighlightedIndex(options.length - 1);
      else toggleDropdown(options.length - 1);
    } else if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      const target = options[highlightedIndex];
      if (target) selectOption(target.value);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      popoverRef.current?.hidePopover?.();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Typeahead search
      typeaheadBuffer.current += e.key.toLowerCase();
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
      typeaheadTimer.current = setTimeout(() => {
        typeaheadBuffer.current = "";
      }, 500);

      const match = options.findIndex((o) =>
        o.label.toLowerCase().startsWith(typeaheadBuffer.current)
      );
      if (match !== -1) {
        if (!open) toggleDropdown(match);
        else setHighlightedIndex(match);
      }
    }
  }

  return (
    <div className="dropdown">
      <button
        ref={triggerRef}
        type="button"
        className={`dropdown-trigger input${selected?.icon ? " has-icon" : ""}`}
        aria-label={ariaLabel}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-opt-${options[highlightedIndex]?.value}` : undefined}
        onClick={() => toggleDropdown()}
        onKeyDown={handleKeyDown}
      >
        <span className="dropdown-value">
          {selected?.icon && <Icon name={selected.icon} />}
          {selected?.label}
        </span>
        <Icon name="chevron-down" className={`dropdown-caret ${open ? "open" : ""}`} />
      </button>

      <ul
        ref={popoverRef}
        id={listId}
        {...({ popover: "auto" } as React.HTMLAttributes<HTMLUListElement>)}
        className="dropdown-menu"
        role="listbox"
        aria-label={ariaLabel}
      >
        {options.map((o, idx) => {
          const isSelected = o.value === value;
          const isHighlighted = idx === highlightedIndex;
          return (
            <li
              key={o.value}
              id={`${listId}-opt-${o.value}`}
              role="option"
              aria-selected={isSelected}
              className={`dropdown-item ${isSelected ? "active" : ""} ${isHighlighted ? "highlighted" : ""}`}
              onClick={() => selectOption(o.value)}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              {o.icon ? <Icon name={o.icon} /> : <span className="dropdown-bullet" />}
              <span className="dropdown-item-label">{o.label}</span>
              {isSelected && <Icon name="check" className="dropdown-check" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
