"use client";

import { Package } from "lucide-react";

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

export function Read({ label, value }: { label: string; value: string }) {
  return (
    <div className="read-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Package size={34} />
      <p>{text}</p>
    </div>
  );
}
