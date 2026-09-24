"use client";

import { newId } from "./id";
import { LOCAL_DB } from "./local-db";
import { createClient } from "./supabase/browser";

const databaseName = "nerdnuea-demo-files";
const storeName = "attachments";
/** Supabase Storage bucket (migration 20260916000015_attachments_bucket.sql). */
const bucket = "attachments";

type StoredAttachment = {
  id: string;
  name: string;
  type: string;
  blob: Blob;
};

/* Files used to live only in the uploader's IndexedDB, so "ดาวน์โหลด" on every
 * other device found nothing. The bucket is the shared copy; IndexedDB stays as
 * a same-device cache and as the whole store in local SQLite mode. */
function storage() {
  if (LOCAL_DB) return null;
  try {
    return createClient().storage.from(bucket);
  } catch {
    return null;
  }
}

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(storeName, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("ไม่สามารถเปิดพื้นที่เก็บไฟล์ได้"));
    request.onblocked = () =>
      reject(
        new Error(
          "ไม่สามารถเปิดพื้นที่เก็บไฟล์ได้ กรุณาปิดแท็บอื่นแล้วลองใหม่",
        ),
      );
  });
}

async function putLocal(record: StoredAttachment) {
  const database = await openStore();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(record);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("ไม่สามารถเก็บไฟล์ Invoice ได้"));
    };
  });
}

async function getLocal(id: string): Promise<StoredAttachment | undefined> {
  const database = await openStore();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(id);
    request.onsuccess = () =>
      resolve(request.result as StoredAttachment | undefined);
    request.onerror = () =>
      reject(request.error || new Error("ไม่สามารถเปิดไฟล์ Invoice ได้"));
    transaction.oncomplete = () => database.close();
  });
}

/* The only files an attachment may be, by extension, with the content type it is
 * stored as (the bucket's allowed_mime_types, migration
 * 20260925000024_attachment_storage_policies.sql). No HTML or SVG: opened, they run
 * script. The browser's own `file.type` is not trusted. */
const allowedTypes: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  csv: "text/csv",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** `folder` is the entry kind the file belongs to (`foodivaConfirm`, `packingList`,
 * `smokingInvoice`, `invoicePayment`, `meatPayment`). It becomes the first path
 * segment, which the storage policies use to decide which roles may read the file.
 * Keys saved before that are a bare `<uuid>` and still load. */
export async function saveAttachment(
  file: File,
  folder: string,
): Promise<string> {
  const type = allowedTypes[file.name.split(".").pop()?.toLowerCase() ?? ""];
  if (!type)
    throw new Error(
      `แนบไฟล์ ${file.name} ไม่ได้: รองรับเฉพาะ PDF, รูปภาพ (JPG, PNG, WEBP, HEIC), CSV และ Excel`,
    );
  const id = `${folder}/${newId()}`;
  const blob = new Blob([file], { type });
  await putLocal({ id, name: file.name, type, blob });
  const remote = storage();
  if (remote) {
    // The object name carries the original file name so a download keeps it.
    const { error } = await remote.upload(`${id}/${file.name}`, blob, {
      contentType: type,
    });
    if (error) throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ: ${error.message}`);
  }
  return id;
}

export async function saveLegacyDataUrl(
  dataUrl: string,
  name: string,
): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return saveAttachment(
    new File([blob], name, { type: blob.type || "application/octet-stream" }),
    "legacy",
  );
}

export async function getAttachment(
  id: string,
): Promise<StoredAttachment | undefined> {
  // A broken or unavailable IndexedDB is only a missed cache: still try the bucket.
  const local = await getLocal(id).catch(() => undefined);
  const remote = storage();
  if (local || !remote) return local;
  const { data: listed, error: listError } = await remote.list(id, {
    limit: 1,
  });
  if (listError)
    throw new Error(`เปิดที่เก็บไฟล์ไม่สำเร็จ: ${listError.message}`);
  const name = listed?.[0]?.name;
  if (!name) return undefined;
  const { data: blob, error } = await remote.download(`${id}/${name}`);
  if (error || !blob)
    throw new Error(`ดาวน์โหลดไฟล์ไม่สำเร็จ: ${error?.message || "ไม่พบไฟล์"}`);
  const record = { id, name, type: blob.type, blob };
  await putLocal(record).catch(() => undefined);
  return record;
}
