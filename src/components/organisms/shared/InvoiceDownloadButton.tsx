"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { Muted } from "@/components/atoms/Text";
import { ActionWithError } from "@/components/molecules/ActionWithError";
import { getAttachment } from "@/lib/attachment-store";
import { uploadedFiles } from "@/lib/forms";

/* Inline `data:` URLs (entries saved before the storage bucket) and bucket files
 * share one path: fetch to a Blob, then download it. A plain `<a href download>`
 * fails silently when the URL is stale, so nothing here is left to the browser. */
async function load(name: string, data?: string, storageKey?: string) {
  if (!data) return storageKey ? getAttachment(storageKey) : undefined;
  // Only an inline file: any other URL here is not something this app wrote.
  if (!data.startsWith("data:")) return undefined;
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

/* A file is whatever its uploader says it is, and a tab opened from here shares
 * the app's origin and session: an HTML or SVG file would run its script as the
 * viewer. So a tab only ever renders these types, re-typed from the blob's claim
 * (a mislabelled file then shows broken, it never runs), and anything else is
 * downloaded instead. */
const viewableTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

/** Saves the blob as a file; the `download` attribute never renders it. */
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(
    new Blob([blob], { type: "application/octet-stream" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  // Firefox only honours `download` on an anchor that is in the document.
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
      saveFile(file.blob, name || file.name || "invoice");
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
    <ActionWithError
      error={message}
      errorClassName="max-w-64 text-right whitespace-normal"
    >
      <Button
        variant="table"
        onClick={download}
        disabled={loading}
        icon={loading ? <Spinner /> : <Download className="size-3.5" />}
      >
        {loading ? "กำลังโหลด" : "ดาวน์โหลด"}
      </Button>
    </ActionWithError>
  );
}

/** Payment slips (a `files` value): each one can be opened or downloaded. */
export function SlipList({ value }: { value?: string }) {
  const slips = uploadedFiles(value);
  if (!slips.length) return <Muted as="span">ไม่มีสลิป</Muted>;
  return (
    <span className="grid justify-items-end gap-1.5">
      {slips.map((slip) => (
        <span key={slip.storageKey} className="flex items-center gap-1.5">
          <AttachmentViewButton {...slip} label={slip.name} />
          <InvoiceDownloadButton {...slip} />
        </span>
      ))}
    </span>
  );
}

/** Opens the file the counterparty actually uploaded, instead of a generated sheet. */
export function AttachmentViewButton({
  name,
  data,
  storageKey,
  label = "ดูเอกสาร",
}: {
  name?: string;
  data?: string;
  storageKey?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const view = async () => {
    setMessage("");
    /* The tab opens inside the click handler: opened after the await, a pop-up
     * blocker kills it. A `data:` URL cannot be navigated to, so both sources
     * end up as one Blob URL. */
    const tab = window.open("", "_blank");
    if (!tab) {
      setMessage("เบราว์เซอร์บล็อก Pop-up กรุณาอนุญาตแล้วลองใหม่");
      return;
    }
    tab.document.write("กำลังเปิดไฟล์…");
    setLoading(true);
    try {
      const file = await withTimeout(load(name || "", data, storageKey));
      if (!file)
        throw new Error(
          "ไม่พบไฟล์แนบในระบบ: ไฟล์นี้อัปโหลดไม่สำเร็จ กรุณาให้ผู้ส่งแนบไฟล์ใหม่",
        );
      const type = file.blob.type.split(";")[0].trim().toLowerCase();
      if (!viewableTypes.includes(type)) {
        tab.close();
        saveFile(file.blob, name || file.name || "attachment");
        return;
      }
      const url = URL.createObjectURL(new Blob([file.blob], { type }));
      tab.location.replace(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      tab.close();
      setMessage(error instanceof Error ? error.message : "เปิดไฟล์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };
  return (
    <ActionWithError
      error={message}
      errorClassName="max-w-64 text-right whitespace-normal"
    >
      <Button
        variant="table"
        onClick={view}
        disabled={loading}
        icon={loading ? <Spinner /> : <FileText className="size-3.5" />}
      >
        {loading ? "กำลังเปิด" : label}
      </Button>
    </ActionWithError>
  );
}
