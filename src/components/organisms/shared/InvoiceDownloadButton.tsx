"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Muted } from "@/components/atoms/Text";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { getAttachment } from "@/lib/attachment-store";

/* Inline `data:` URLs (entries saved before the storage bucket) and bucket files
 * share one path: fetch to a Blob, then download it. A plain `<a href download>`
 * fails silently when the URL is stale, so nothing here is left to the browser. */
async function load(name: string, data?: string, storageKey?: string) {
  if (!data) return storageKey ? getAttachment(storageKey) : undefined;
  const blob = await fetch(data)
    .then((response) => response.blob())
    .catch(() => undefined);
  return blob && { name, blob };
}

export function InvoiceDownloadButton({
  name,
  data,
  storageKey,
}: {
  name: string;
  data?: string;
  storageKey?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const download = async () => {
    setLoading(true);
    setMessage("");
    try {
      const file = await load(name, data, storageKey);
      if (!file)
        throw new Error(
          "ไม่พบไฟล์แนบ: ไฟล์นี้อยู่เฉพาะในเบราว์เซอร์ที่อัปโหลด กรุณาแนบไฟล์ใหม่",
        );
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name || file.name || "invoice";
      // Firefox only honours `download` on an anchor that is in the document.
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ดาวน์โหลดไฟล์ไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  };
  if (!data && !storageKey)
    return (
      <Muted as="span">
        {name ? "ไฟล์เดิมยังไม่มีให้ดาวน์โหลด" : "ยังไม่มีไฟล์แนบ"}
      </Muted>
    );
  return (
    <ButtonRow>
      <Button
        variant="table"
        onClick={download}
        disabled={loading}
        icon={<Download className="size-3.5" />}
      >
        {loading ? "กำลังโหลด" : "ดาวน์โหลด"}
      </Button>
      {message && (
        <small
          role="alert"
          className="max-w-64 text-caption whitespace-normal text-danger"
        >
          {message}
        </small>
      )}
    </ButtonRow>
  );
}
