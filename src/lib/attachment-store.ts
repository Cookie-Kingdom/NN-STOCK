"use client";

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
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("ไม่สามารถเปิดพื้นที่เก็บไฟล์ได้"));
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
    request.onsuccess = () => resolve(request.result as StoredAttachment | undefined);
    request.onerror = () => reject(request.error || new Error("ไม่สามารถเปิดไฟล์ Invoice ได้"));
    transaction.oncomplete = () => database.close();
  });
}

export async function saveAttachment(file: File): Promise<string> {
  const id = crypto.randomUUID();
  await putLocal({ id, name: file.name, type: file.type, blob: file });
  const remote = storage();
  if (remote) {
    // The object name carries the original file name so a download keeps it.
    const { error } = await remote.upload(`${id}/${file.name}`, file, { contentType: file.type });
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
  );
}

export async function getAttachment(id: string): Promise<StoredAttachment | undefined> {
  const local = await getLocal(id);
  const remote = storage();
  if (local || !remote) return local;
  const { data: listed } = await remote.list(id, { limit: 1 });
  const name = listed?.[0]?.name;
  if (!name) return undefined;
  const { data: blob, error } = await remote.download(`${id}/${name}`);
  if (error || !blob) throw new Error(`ดาวน์โหลดไฟล์ไม่สำเร็จ: ${error?.message || "ไม่พบไฟล์"}`);
  const record = { id, name, type: blob.type, blob };
  await putLocal(record).catch(() => undefined);
  return record;
}
