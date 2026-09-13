"use client";

const databaseName = "nerdnuea-demo-files";
const storeName = "attachments";

type StoredAttachment = {
  id: string;
  name: string;
  type: string;
  blob: Blob;
};

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("ไม่สามารถเปิดพื้นที่เก็บไฟล์ได้"));
  });
}

export async function saveAttachment(file: File): Promise<string> {
  const id = crypto.randomUUID();
  const database = await openStore();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put({ id, name: file.name, type: file.type, blob: file } satisfies StoredAttachment);
    transaction.oncomplete = () => {
      database.close();
      resolve(id);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("ไม่สามารถเก็บไฟล์ Invoice ได้"));
    };
  });
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
  const database = await openStore();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result as StoredAttachment | undefined);
    request.onerror = () => reject(request.error || new Error("ไม่สามารถเปิดไฟล์ Invoice ได้"));
    transaction.oncomplete = () => database.close();
  });
}
