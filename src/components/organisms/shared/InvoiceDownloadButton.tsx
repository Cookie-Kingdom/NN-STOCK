"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Muted } from "@/components/atoms/Text";
import { ButtonRow } from "@/components/molecules/ButtonRow";
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
    return (
      <Button variant="table" asChild icon={<Download className="size-3.5" />}>
        <a href={data} download={name || "invoice"}>ดาวน์โหลด</a>
      </Button>
    );
  if (storageKey)
    return (
      <ButtonRow>
        <Button variant="table" onClick={download} disabled={loading} icon={<Download className="size-3.5" />}>
          {loading ? "กำลังโหลด" : "ดาวน์โหลด"}
        </Button>
        {message && <small className="text-caption text-danger">{message}</small>}
      </ButtonRow>
    );
  if (!name) return <Muted as="span">ยังไม่มีไฟล์แนบ</Muted>;
  return <Muted as="span">ไฟล์เดิมยังไม่มีให้ดาวน์โหลด</Muted>;
}
