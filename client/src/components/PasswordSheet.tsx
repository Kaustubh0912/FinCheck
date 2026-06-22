import { useEffect, useState } from "react";
import { Sheet } from "./Sheet";

interface PasswordSheetProps {
  open: boolean;
  onClose: () => void;
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  changingPassword: boolean;
  passwordMsg: string;
  changePassword: () => void;
}

export function PasswordSheet({
  open,
  onClose,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  changingPassword,
  passwordMsg,
  changePassword,
}: PasswordSheetProps) {
  const [localErr, setLocalErr] = useState("");

  useEffect(() => {
    if (!open) {
      setLocalErr("");
      return;
    }
    // Focus on current password field when opening
    const input = document.getElementById("current-password");
    input?.focus();
  }, [open]);

  function submit() {
    setLocalErr("");
    if (newPassword.length < 6) {
      setLocalErr("New password must be at least 6 characters");
      return;
    }
    changePassword();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Change Password"
      footer={
        <div className="row gap">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary grow" onClick={submit} disabled={changingPassword}>
            {changingPassword ? "Changing…" : "Change Password"}
          </button>
        </div>
      }
    >
      <div className="field">
        <label className="field-label">Current Password</label>
        <input
          id="current-password"
          className="input"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter your current password"
          autoFocus
        />
      </div>

      <div className="field">
        <label className="field-label">New Password</label>
        <input
          className="input"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password (min 6 characters)"
        />
      </div>

      <div className="field">
        <label className="field-label">Confirm New Password</label>
        <input
          className="input"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm your new password"
        />
      </div>

      {(localErr || passwordMsg) && (
        <p className={(localErr || passwordMsg) === "Password changed successfully" ? "form-success" : "form-error"}>
          {localErr || passwordMsg}
        </p>
      )}
    </Sheet>
  );
}