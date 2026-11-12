export function makeFormatters(lang) {
  const locale = lang === "ru" ? "ru-RU" : "en-US";
  const nf = (digits) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const formats = {};
  const cache = {};
  const number = (digits) => cache[digits] || (cache[digits] = nf(digits));
  formats.pct = (value, digits = 1) => (Number.isFinite(value) ? number(digits).format(value * 100) + "%" : "n/a");
  formats.ratio = (value) => (Number.isFinite(value) ? number(2).format(value) + "×" : "n/a");
  formats.usd = (value) => (Number.isFinite(value) ? "$" + number(2).format(value) : "n/a");
  formats.usd3 = (value) => (Number.isFinite(value) ? "$" + number(3).format(value) : "n/a");
  formats.usd4 = (value) => (Number.isFinite(value) ? "$" + number(4).format(value) : "n/a");
  formats.int = (value) => number(0).format(value);
  formats.p = (value) => {
    if (!Number.isFinite(value)) return "n/a";
    if (value < 0.001) return value.toExponential(1).replace(".", lang === "ru" ? "," : ".").replace("e-", "e−");
    return number(3).format(value);
  };
  return formats;
}

export async function loadData() {
  if (window.__SHOWCASE_DATA__) return window.__SHOWCASE_DATA__;
  const response = await fetch("data.json");
  if (!response.ok) throw new Error("data.json: " + response.status);
  return response.json();
}
