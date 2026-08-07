import { Icon } from "../lib/icons";

interface PasswordChecklistProps {
  password?: string;
  confirmPassword?: string;
  showConfirm?: boolean;
}

export function PasswordChecklist({
  password = "",
  confirmPassword,
  showConfirm = false,
}: PasswordChecklistProps) {
  const hasMinLength = password.length >= 8;
  const hasNumber = /[0-9]/.test(password);
  const matchesConfirm = showConfirm && confirmPassword !== undefined && confirmPassword.length > 0 && password === confirmPassword;

  return (
    <ul className="pwd-checklist">
      <li className={hasMinLength ? "check-pass" : ""}>
        <Icon name={hasMinLength ? "check" : "circle"} />
        <span>At least 8 characters</span>
      </li>
      <li className={hasNumber ? "check-pass" : ""}>
        <Icon name={hasNumber ? "check" : "circle"} />
        <span>Contains a number (0-9)</span>
      </li>
      {showConfirm && (
        <li className={matchesConfirm ? "check-pass" : ""}>
          <Icon name={matchesConfirm ? "check" : "circle"} />
          <span>Passwords match</span>
        </li>
      )}
    </ul>
  );
}
