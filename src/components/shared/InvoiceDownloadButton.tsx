"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { getAttachment } from "@/lib/attachment-store";

export function InvoiceDownloadButton({ name, data, storageKey }: { name: string; data?: string; storageKey?: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const download = async () => {
    if (data || !storageKey) return;
    setLoading(true);
    setMessage("");
    try {
      const file = await getAttachment(storageKey);
      if (!file) throw new Error("ไม่พบไฟล์บนเบราว์เซอร์นี้");
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name || file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ดาวน์โหลดไฟล์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };
  if (data)
    return <a className="table-action" href={data} download={name || "invoice"}><Download size={14} /> ดาวน์โหลด</a>;
  if (storageKey)
    return <div className="button-row"><button className="table-action" type="button" onClick={download} disabled={loading}><Download size={14} /> {loading ? "กำลังโหลด" : "ดาวน์โหลด"}</button>{message && <small className="error-text">{message}</small>}</div>;
  if (!name) return <span className="muted">ยังไม่มีไฟล์แนบ</span>;
  return (
    <span className="muted">ไฟล์เดิมยังไม่มีให้ดาวน์โหลด</span>
  );
}
