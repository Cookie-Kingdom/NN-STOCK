/** A Controls radio that picks one of several values (usually fixture databases) by
 *  label, so one story covers every state instead of one story per state:
 *
 *    const day = pick("วัน", { เปิดวัน: demoDb, ปิดวันแล้ว: dayClosedDb });
 *    argTypes: { db: day.argType }, args: { db: day.initial }
 *
 *  Storybook maps the label to the value before render and decorators see it, so an
 *  arg named `db` also feeds the mocked latestDatabase(). */
export function pick<T>(name: string, options: Record<string, T>) {
  const labels = Object.keys(options);
  return {
    argType: {
      name,
      options: labels,
      mapping: options,
      control: "radio" as const,
    },
    // ponytail: the arg holds the label until Storybook maps it; typed as T for render.
    initial: labels[0] as unknown as T,
  };
}
