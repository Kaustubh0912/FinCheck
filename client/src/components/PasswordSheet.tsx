import { useEffect, useState } from "react";
import { Sheet } from "./Sheet";
import { useDelayedPending } from "../lib/useDelayedPending";
import { PasswordChecklist } from "./PasswordChecklist";

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
  const delayedChanging = useDelayedPending(changingPassword);

  const hasMinLength = newPassword.length >= 8;
  const hasNumber = /[0-9]/.test(newPassword);
  const matchesConfirm = confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && hasMinLength && hasNumber && matchesConfirm;

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
    if (!hasMinLength || !hasNumber) {
      setLocalErr("New password must be at least 8 characters and include a number");
      return;
    }
    if (!matchesConfirm) {
      setLocalErr("New passwords do not match");
      return;
    }
    changePassword();
  }

  function getMissingHint() {
    if (!currentPassword) return "Enter your current password";
    if (!hasMinLength || !hasNumber) return "Meet all password requirements";
    if (!confirmPassword) return "Confirm your new password";
    if (!matchesConfirm) return "Passwords do not match";
    return "";
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Change Password"
      footer={
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <div className="row gap">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary grow" onClick={submit} disabled={changingPassword || !canSubmit}>
              {delayedChanging ? "Changing…" : "Change Password"}
            </button>
          </div>
          {!canSubmit && !changingPassword && (
            <p className="field-hint">{getMissingHint()}</p>
          )}
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
          maxLength={200}
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
          placeholder="Enter new password (min 8 characters)"
          maxLength={200}
        />
        <PasswordChecklist
          password={newPassword}
          confirmPassword={confirmPassword}
          showConfirm={confirmPassword.length > 0}
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
          maxLength={200}
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