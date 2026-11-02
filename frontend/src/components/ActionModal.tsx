import { useState } from "react";
import type { FormEvent } from "react";
import { ErrorNotice, Field, Modal } from "./ui";
export interface ActionRequest {
  title: string;
  description: string;
  label: string;
  reasonRequired?: boolean;
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    <Modal title={action.title} onClose={onClose} busy={busy}>
      <p className="muted">{action.description}</p>
      <form onSubmit={submit}>
        <ErrorNotice error={error} />
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
        <div className="form-actions">
          <button
            type="button"
            className="button button-ghost"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Đang lưu…" : action.label}
          </button>
        </div>
      </form>
    </Modal>
  );
}
