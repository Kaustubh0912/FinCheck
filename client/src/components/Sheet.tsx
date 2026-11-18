import { useEffect, useId, useRef, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { Icon } from "../lib/icons";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** A bottom sheet on mobile that becomes a centered modal on wider screens. */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    const dialog = event.currentTarget;
    if (event.target !== dialog) return;

    // `closedby="any"` is not supported in every browser yet. Keep backdrop
    // dismissal working there without treating clicks on dialog padding as outside.
    const rect = dialog.getBoundingClientRect();
    const clickedOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (clickedOutside) dialog.close();
  }

  return (
    <dialog
      {...({ closedby: "any" } as HTMLAttributes<HTMLDialogElement>)}
      ref={dialogRef}
      className="sheet"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : "Dialog"}
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className="sheet-handle" />
      <div className="sheet-header">
        {title ? <h2 id={titleId}>{title}</h2> : <span />}
        <button type="button" className="icon-btn" onClick={() => dialogRef.current?.close()} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="sheet-body">{children}</div>
      {footer && <div className="sheet-footer">{footer}</div>}
    </dialog>
  );
}
