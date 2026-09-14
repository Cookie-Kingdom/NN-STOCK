// Barrel kept so existing imports of "organisms/shared/documents" keep working.
// Pure helpers live in documentRows.ts; the filter panel in DocumentFilterBar.tsx.
export {
  dateLabel,
  lotIssueDate,
  matchesDocumentFilter,
  purchaseOrderRows,
  type DocumentReferenceType,
} from "@/components/organisms/shared/documentRows";
export { DocumentFilterBar } from "@/components/organisms/shared/DocumentFilterBar";
