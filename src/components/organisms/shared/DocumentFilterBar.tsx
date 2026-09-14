"use client";

import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Overline } from "@/components/atoms/Overline";
import { Panel } from "@/components/atoms/Panel";
import { Select } from "@/components/atoms/Select";
import { Muted } from "@/components/atoms/Text";
import { DateRangeFilter } from "@/components/molecules/DateRangeFilter";
import { FilterBar } from "@/components/molecules/FilterBar";
import { TableFilter } from "@/components/molecules/TableFilter";
import type { DocumentReferenceType } from "@/components/organisms/shared/documentRows";

export function DocumentFilterBar({
  referenceType,
  query,
  fromDate,
  toDate,
  onReferenceType,
  onQuery,
  onFromDate,
  onToDate,
}: {
  referenceType: DocumentReferenceType;
  query: string;
  fromDate: string;
  toDate: string;
  onReferenceType: (value: DocumentReferenceType) => void;
  onQuery: (value: string) => void;
  onFromDate: (value: string) => void;
  onToDate: (value: string) => void;
}) {
  const label = referenceType === "po" ? "เลข PO" : "เลข Lot";
  return (
    <Panel className="flex items-end justify-between gap-5">
      <div>
        <Overline>FILTER DOCUMENTS</Overline>
        <Muted className="mt-1.25">กรองจากวันที่ออก PO / วันที่เปิด Lot เป็นหลัก</Muted>
      </div>
      <FilterBar>
        <TableFilter label="กรองตาม">
          <Select
            variant="filter"
            value={referenceType}
            onChange={(event) => onReferenceType(event.target.value as DocumentReferenceType)}
          >
            <option value="po">เลข PO</option>
            <option value="lot">เลข Lot</option>
          </Select>
        </TableFilter>
        <TableFilter label={`ค้นหา ${label}`}>
          <Input
            variant="filter"
            value={query}
            placeholder={`เช่น ${referenceType === "po" ? "PO-2026..." : "NN-2026..."}`}
            onChange={(event) => onQuery(event.target.value)}
          />
        </TableFilter>
        <DateRangeFilter
          from={fromDate}
          to={toDate}
          onFromChange={onFromDate}
          onToChange={onToDate}
          fromLabel="ตั้งแต่วันที่ PO / Lot"
          toLabel="ถึงวันที่ PO / Lot"
        />
        <Button
          variant="secondary"
          onClick={() => {
            onQuery("");
            onFromDate("");
            onToDate("");
          }}
        >
          ล้าง Filter
        </Button>
      </FilterBar>
    </Panel>
  );
}
