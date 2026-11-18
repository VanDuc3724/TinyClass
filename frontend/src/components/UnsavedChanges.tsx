import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { UnsavedChangesContext } from "../lib/unsavedChanges";
import type { Discard } from "../lib/unsavedChanges";
import { ActionModal } from "./ActionModal";

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{
    id: string;
    proceed: Discard;
  } | null>(null);
  const context = useMemo(
    () => ({
      request(id: string, proceed: Discard) {
        setPending((current) => current ?? { id, proceed });
      },
      dismiss(id: string) {
        setPending((current) => (current?.id === id ? null : current));
      },
    }),
    [],
  );

  return (
    <UnsavedChangesContext.Provider value={context}>
      {children}
      {pending && (
        <ActionModal
          action={{
            title: "Bỏ thay đổi chưa lưu?",
            description: "Các thay đổi trong biểu mẫu sẽ bị mất.",
            label: "Bỏ thay đổi",
            cancelLabel: "Tiếp tục chỉnh sửa",
            cancelPrimary: true,
            showReason: false,
            run: async () => pending.proceed(),
          }}
          onClose={() => context.dismiss(pending.id)}
          onSuccess={() => context.dismiss(pending.id)}
        />
      )}
    </UnsavedChangesContext.Provider>
  );
}
