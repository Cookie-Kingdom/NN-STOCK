export const fmt = (x: number) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    // Float residue like -0.0000001 rounds to zero; never print it as "-0.00".
    signDisplay: "negative",
  }).format(x);

export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
