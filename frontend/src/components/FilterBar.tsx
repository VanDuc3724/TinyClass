import { Children, useId, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "./ui";
import styles from "./FilterBar.module.css";

export default function FilterBar({
  children,
  active,
  onReset,
  className = "",
}: {
  children: ReactNode;
  active: boolean;
  onReset: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false),
    id = useId();
  const elements = Children.toArray(children);
  return (
    <div className={`${styles.bar} ${className}`}>
      <div className={styles.search}>{elements[0]}</div>
      <button
        type="button"
        className={`button button-ghost ${styles.toggle}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <Icon name="settings" />
        Bộ lọc{active ? " · Đang lọc" : ""}
      </button>
      <div id={id} className={`${styles.options} ${open ? styles.open : ""}`}>
        {elements.slice(1)}
      </div>
      {active && (
        <button type="button" className="text-button" onClick={onReset}>
          Xóa bộ lọc
        </button>
      )}
    </div>
  );
}
