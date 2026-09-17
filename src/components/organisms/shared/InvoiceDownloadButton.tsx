"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Muted } from "@/components/atoms/Text";
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

/* ponytail: one 20s ceiling for IndexedDB/Storage calls that never settle, so the
 * button cannot sit on "กำลังโหลด" with no message. */
function withTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      window.setTimeout(
        () =>
          reject(
            new Error("ดาวน์โหลดไฟล์ไม่สำเร็จ: หมดเวลาเชื่อมต่อ กรุณาลองใหม่"),
          ),
        20_000,
      ),
    ),
  ]);
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
      const file = await withTimeout(load(name, data, storageKey));
      if (!file)
        throw new Error(
          "ไม่พบไฟล์แนบในระบบ: ไฟล์นี้อัปโหลดไม่สำเร็จ กรุณาให้ผู้ส่งแนบไฟล์ใหม่",
        );
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name || file.name || "invoice";
      // Firefox only honours `download` on an anchor that is in the document.
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ดาวน์โหลดไฟล์ไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  };
  if (!name && !data && !storageKey)
    return <Muted as="span">ยังไม่มีไฟล์แนบ</Muted>;
  /* A name with no stored copy still gets a live button whose click says the file
   * is missing. The message sits under the button, not beside it: beside it, it
   * widened the last table column past the scroll edge and read as "nothing". */
  return (
    <div className="grid justify-items-end gap-1">
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
          className="max-w-64 text-right text-caption whitespace-normal text-danger"
        >
          {message}
        </small>
      )}
    </div>
  );
}
