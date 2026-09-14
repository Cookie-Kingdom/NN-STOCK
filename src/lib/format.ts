export const fmt = (x: number) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(x);

export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
