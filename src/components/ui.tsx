import { useState, type ReactNode } from "react";
import { rarityLabel, type CatalogItem } from "../lib/catalog";
import type { ValueMode } from "../lib/optimizer";

export const ItemIcon = ({
  item,
  size = "md",
}: {
  item: CatalogItem;
  size?: "sm" | "md" | "lg" | "xl";
}) => {
  const [failed, setFailed] = useState(false);
  const initials = item.name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("");

  return (
    <div className={`item-icon item-icon--${size} rarity-${item.rarity.toLowerCase()}`}>
      {item.image && !failed ? (
        <img
          src={`${import.meta.env.BASE_URL}${item.image.replace(/^\//, "")}`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

export const RarityBadge = ({ item }: { item: CatalogItem }) => (
  <span className={`rarity-badge rarity-${item.rarity.toLowerCase()}`}>
    {rarityLabel(item.rarity)}
  </span>
);

export const QtyStepper = ({
  qty,
  onChange,
  compact = false,
}: {
  qty: number;
  onChange: (qty: number) => void;
  compact?: boolean;
}) => (
  <div className={`qty-stepper${compact ? " qty-stepper--compact" : ""}`}>
    <button type="button" onClick={() => onChange(qty - 1)} aria-label="Retirer un">
      −
    </button>
    <input
      type="number"
      min={1}
      max={9999}
      name="quantity"
      value={qty}
      aria-label="Quantité"
      onChange={(event) => {
        const next = Number(event.target.value);
        onChange(Number.isFinite(next) ? Math.max(1, Math.floor(next)) : 1);
      }}
    />
    <button type="button" onClick={() => onChange(qty + 1)} aria-label="Ajouter un">
      +
    </button>
  </div>
);

export const CapacityBar = ({ used, capacity }: { used: number; capacity: number }) => {
  const ratio = capacity > 0 ? used / capacity : 0;
  const over = used > capacity;
  return (
    <div className="capacity">
      <div className="capacity__labels">
        <span>
          <strong>{used}</strong> / {capacity} slots
        </span>
        <span className={over ? "danger" : ratio > 0.85 ? "warning" : "muted"}>
          {over ? `${used - capacity} de trop` : `${Math.max(0, capacity - used)} libres`}
        </span>
      </div>
      <div
        className="capacity__track"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemax={capacity}
      >
        <div
          className={`capacity__fill${over ? " capacity__fill--over" : ""}`}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
    </div>
  );
};

export const ValueModeToggle = ({
  mode,
  onChange,
}: {
  mode: ValueMode;
  onChange: (mode: ValueMode) => void;
}) => (
  <div className="segmented" role="group" aria-label="Valorisation">
    <button
      type="button"
      className={mode === "sell" ? "is-active" : ""}
      onClick={() => onChange("sell")}
    >
      Revente
    </button>
    <button
      type="button"
      className={mode === "recycle" ? "is-active" : ""}
      onClick={() => onChange("recycle")}
    >
      Recyclage
    </button>
  </div>
);

export const Panel = ({
  title,
  eyebrow,
  actions,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={`panel ${className}`}>
    <header className="panel__head">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {actions ? <div className="panel__actions">{actions}</div> : null}
    </header>
    {children}
  </section>
);

export const EmptyState = ({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) => (
  <div className="empty">
    <div className="empty__mark">◫</div>
    <h3>{title}</h3>
    <p>{text}</p>
    {action}
  </div>
);

export const Stat = ({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "accent" | "ok" | "danger";
}) => (
  <div className={`stat${tone ? ` stat--${tone}` : ""}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    {hint ? <small>{hint}</small> : null}
  </div>
);
