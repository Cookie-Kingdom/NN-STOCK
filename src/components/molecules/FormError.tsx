import { Notice } from "@/components/molecules/Notice";

export function FormError({
  error,
  className,
}: {
  error?: string | null;
  className?: string;
}) {
  return error ? (
    <Notice tone="danger" className={className}>
      {error}
    </Notice>
  ) : null;
}
