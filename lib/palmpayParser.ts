import type { AnalyticsTransaction } from "./financialAnalytics";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const toAmount = (s: string) => Number(s.replace(/[₦,\s+]/g, ""));

// PalmPay statement rows in the supplied sample use MM/DD/YYYY + time and
// signed amounts in the transaction-detail column. The parser deliberately
// lives separately from the existing OPay parser so OPay behavior is untouched.
const rowStart = /\b(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\b/gi;
const signedAmount = /([+-])\s*(?:₦\s*)?(\d[\d,]*(?:\.\d{1,2})?)/g;

function directionFromDetail(detail: string, sign?: string): "received" | "sent" | null {
  if (/^(?:received|refund|disbursement|interbank transfer|cashback|interest)/i.test(detail)) return "received";
  if (/^(?:send|payment|top up|electricity|auto deduct|cashbox auto save|repayment|withdrawal)/i.test(detail)) return "sent";
  if (sign === "+") return "received";
  if (sign === "-") return "sent";
  return null;
}

export function parsePalmPayTransactions(text: string): AnalyticsTransaction[] {
  const normalized = text
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const starts = [...normalized.matchAll(rowStart)];
  const out: AnalyticsTransaction[] = [];

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index ?? 0;
    const end = i + 1 < starts.length ? starts[i + 1].index ?? normalized.length : normalized.length;
    const block = normalized.slice(start, end).trim();
    const head = block.match(rowStart);
    if (!head) continue;

    const hm = head[0].match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (!hm) continue;

    const body = clean(block.slice(head[0].length));
    if (!body || /^(?:transaction date|transaction detail|money in|money out|transaction id)$/i.test(body)) continue;

    const amounts = [...body.matchAll(signedAmount)];
    if (!amounts.length) continue;

    // The sample has the transaction amount embedded in the detail as +N/-N.
    // Prefer the first signed amount; ignore a possible unsigned transaction ID.
    const amountMatch = amounts[0];
    const amountValue = toAmount(amountMatch[2]);
    if (!Number.isFinite(amountValue) || amountValue <= 0) continue;

    const sign = amountMatch[1];
    const detail = clean(body.slice(0, amountMatch.index ?? body.length));
    const direction = directionFromDetail(detail, sign);
    if (!direction) continue;

    // Keep the transaction description intact while using the meaningful
    // counterparty/service as the party shown in People and related analytics.
    let party = detail
      .replace(/^received\s+from\s+/i, "")
      .replace(/^send\s+to\s+/i, "")
      .replace(/^disbursement[-\s]*/i, "")
      .trim();
    if (!party) party = direction === "received" ? "Unknown sender" : "Unknown recipient";

    out.push({
      date: hm[1],
      time: hm[2],
      description: detail,
      amount: amountValue,
      party,
      direction,
    });
  }

  return [...new Map(out.map((t) => [
    `${t.date}|${t.time}|${t.direction}|${t.party}|${t.amount}`,
    t,
  ])).values()];
}
