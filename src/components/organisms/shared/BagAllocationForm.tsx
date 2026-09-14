"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import { availableBags, branches, mutate, type Database } from "@/lib/store";
import { fmt } from "@/lib/format";

export function BagAllocationForm({ db, lotId, date, onClose, onSaved }: { db: Database; lotId: string; date: string; onClose: () => void; onSaved: () => void }) {
  const bags = availableBags(db, lotId);
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      let next = latestDatabase();
      let count = 0;
      for (const branchName of branches) {
        const selected = bags.filter((bag) => destinations[bag.id] === branchName);
        if (!selected.length) continue;
        next = mutate(next, "owner", "allocate", { branch: branchName, bagIds: selected.map((bag) => bag.id).join(","), deliveryDate: date }, lotId, date);
        count += selected.length;
      }
      if (!count) throw new Error("เลือกสาขาปลายทางอย่างน้อย 1 ถุง");
      saveDatabase(next);
      onSaved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "จัดสรรไม่สำเร็จ"); }
  }
  return <div className="modal-backdrop"><section className="form-dialog" role="dialog" aria-modal="true"><header><div><span className="overline">{lotId}</span><h2>จัดสรรถุงเนื้อไปสาขา</h2></div><button type="button" className="icon-button" onClick={onClose}><X /></button></header><form onSubmit={submit}><div className="form-body"><DataTable title="เลือกปลายทางทีละถุง" columns={["ถุง", "น้ำหนัก", "สาขาปลายทาง"]} rows={bags.map((bag, index) => [`ถุงที่ ${index + 1}`, `${fmt(bag.weight)} กก.`, <select key={bag.id} value={destinations[bag.id] || ""} onChange={(event) => setDestinations((current) => ({ ...current, [bag.id]: event.target.value }))}><option value="">ยังไม่จัดสรร</option>{branches.map((name) => <option key={name}>{name}</option>)}</select>])} />{error && <div className="notice warning">{error}</div>}</div><footer><p>เลือกหลายถุงและส่งให้ทั้งสองสาขาได้ในครั้งเดียว</p><button type="button" className="secondary" onClick={onClose}>ยกเลิก</button><button className="primary">บันทึกการจัดสรร</button></footer></form></section></div>;
}
