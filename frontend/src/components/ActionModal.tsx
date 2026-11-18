import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ErrorNotice, Field, Icon, Modal } from "./ui";
import type { IconName } from "./ui";
export interface ActionRequest {
  title: string;
  description: string;
  label: string;
  reasonRequired?: boolean;
  showReason?: boolean;
  confirmIcon?: IconName;
  cancelIcon?: IconName;
  cancelLabel?: string;
  cancelPrimary?: boolean;
  run: (reason: string) => Promise<unknown>;
}
export function ActionModal({
  action,
  onClose,
  onSuccess,
}: {
  action: ActionRequest;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const showReason = action.showReason !== false || action.reasonRequired;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const reason = String(
      new FormData(event.currentTarget).get("reason") || "",
    ).trim();
    setBusy(true);
    setError(null);
    try {
      await action.run(reason);
      onSuccess();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={action.title}
      onClose={onClose}
      busy={busy}
      initialFocus={showReason ? undefined : cancel}
    >
      <p className="muted">{action.description}</p>
      <form onSubmit={submit}>
        <ErrorNotice error={error} />
        {showReason && (
          <Field label="Lý do" optional={!action.reasonRequired}>
            <textarea
              name="reason"
              rows={3}
              required={action.reasonRequired}
              maxLength={1000}
              disabled={busy}
              placeholder="Ghi lại để dễ đối chiếu về sau…"
            />
          </Field>
        )}
        <div className="form-actions">
          <button
            ref={cancel}
            type="button"
            className={`button ${action.cancelPrimary ? "button-primary" : "button-ghost"}`}
            disabled={busy}
            onClick={onClose}
          >
            {action.cancelIcon && <Icon name={action.cancelIcon} />}
            {action.cancelLabel || "Hủy"}
          </button>
          <button
            type="submit"
            className={`button ${action.cancelPrimary ? "button-ghost" : "button-primary"}`}
            disabled={busy}
          >
            {action.confirmIcon && <Icon name={action.confirmIcon} />}
            {busy ? "Đang lưu…" : action.label}
          </button>
        </div>
      </form>
    </Modal>
  );
}
