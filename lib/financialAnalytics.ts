export type AnalyticsDirection = "sent" | "received";

export type AnalyticsTransaction = {
  date: string;
  time?: string;
  description: string;
  amount: number;
  party: string;
  direction: AnalyticsDirection;
  balance?: number;
  accountNumber?: string;
  bank?: string;
};

export type MonthlyAnalytics = {
  key: string;
  label: string;
  received: number;
  sent: number;
  net: number;
  incomingCount: number;
  outgoingCount: number;
  uniqueSenders: number;
  uniqueRecipients: number;
  openingBalance?: number;
  closingBalance?: number;
};

export type PartyAnalytics = {
  name: string;
  accountNumber?: string;
  bank?: string;
  totalReceived: number;
  totalSent: number;
  receivedCount: number;
  sentCount: number;
  averageReceived: number;
  averageSent: number;
  largestReceived: number;
  largestSent: number;
  firstTransaction: string;
  lastTransaction: string;
  months: string[];
  transactions: AnalyticsTransaction[];
};

export type CategoryAnalytics = {
  category: string;
  amount: number;
  percentage: number;
  count: number;
};

export type MerchantAnalytics = {
  merchant: string;
  totalSpent: number;
  count: number;
  averageTransaction: number;
  largestTransaction: number;
  firstTransaction: string;
  lastTransaction: string;
  monthly: Record<string, number>;
};

export type RecurringAnalytics = {
  description: string;
  amount: number;
  frequency: "weekly" | "monthly" | "quarterly" | "irregular";
  occurrences: number;
  averageAmount: number;
  firstOccurrence: string;
  mostRecentOccurrence: string;
  monthlyCost?: number;
  annualEstimatedCost?: number;
  confidence: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toDate(value: string): Date {
  const m = value.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (!m) return new Date(value);
  const month = MONTHS.findIndex(x => x.toLowerCase() === m[2].slice(0, 3).toLowerCase());
  return new Date(Number(m[3]), Math.max(0, month), Number(m[1]));
}

export function monthKey(date: string): string {
  const d = toDate(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
}

function average(values: number[]) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

export const CATEGORY_RULES: Record<string, RegExp> = {
  Food: /restaurant|food|eat|meal|kfc|chicken|pizza|suya|canteen|market|grocery|supermarket/i,
  Transport: /uber|bolt|taxi|transport|bus|car|ride|danfo|lagos ride|indriver/i,
  Fuel: /fuel|filling station|petrol|diesel|oil and gas/i,
  Shopping: /shop|shopping|mall|store|boutique|jiji|jumia|konga/i,
  Rent: /rent|landlord|housing|accommodation/i,
  Utilities: /utility|water bill|waste|sanitation/i,
  Electricity: /electric|ekedc|ikedc|eedc|aedc|ibedc|jed|bedc|nepa|power/i,
  Internet: /internet|wifi|spectranet|smile|fiber|fibre|starlink/i,
  Airtime: /airtime|recharge|mtn|airtel|glo|9mobile|etisalat/i,
  Data: /data bundle|data plan|internet data/i,
  Healthcare: /hospital|clinic|pharmacy|medical|health|doctor|medicine|drug/i,
  Education: /school|tuition|education|university|college|exam|course|training/i,
  Entertainment: /movie|cinema|netflix|spotify|showmax|entertainment|game/i,
  Subscriptions: /subscription|membership|renewal|premium/i,
  Travel: /flight|airline|hotel|booking|travel|visa/i,
  "Bank charges": /charge|fee|commission|stamp duty|vat|bank fee/i,
  Taxes: /tax|firs|lirs|levy/i,
  "Loan repayment": /loan|repayment|borrow/i,
  Investments: /investment|invest|fund|stocks|shares|mutual/i,
  "Cash withdrawals": /withdrawal|cash out|atm/i,
  Transfers: /transfer to|sent to|bank transfer/i,
};

export function categorize(transaction: AnalyticsTransaction): string {
  for (const [category, rule] of Object.entries(CATEGORY_RULES)) if (rule.test(transaction.description)) return category;
  return "Other";
}

export function normalizeMerchant(description: string, party: string): string {
  const source = `${party} ${description}`;
  const patterns: [RegExp, string][] = [
    [/\buber\b/i, "Uber"], [/\bbolt\b/i, "Bolt"], [/\bnetflix\b/i, "Netflix"],
    [/\bspotify\b/i, "Spotify"], [/\bjumia\b/i, "Jumia"], [/\bkonga\b/i, "Konga"],
    [/\bmtn\b/i, "MTN"], [/\bairtel\b/i, "Airtel"], [/\bglo\b/i, "Glo"], [/\b9mobile|etisalat\b/i, "9mobile"],
  ];
  for (const [rule, name] of patterns) if (rule.test(source)) return name;
  return party.trim() || description.split(/\s+/).slice(0, 4).join(" ");
}

export function financialOverview(tx: AnalyticsTransaction[]) {
  const incoming = tx.filter(t => t.direction === "received");
  const outgoing = tx.filter(t => t.direction === "sent");
  const balances = tx.map(t => t.balance).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  const ordered = [...tx].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
  return {
    totalReceived: incoming.reduce((s, t) => s + t.amount, 0),
    totalSpent: outgoing.reduce((s, t) => s + t.amount, 0),
    netCashFlow: incoming.reduce((s, t) => s + t.amount, 0) - outgoing.reduce((s, t) => s + t.amount, 0),
    openingBalance: ordered.find(t => typeof t.balance === "number")?.balance,
    closingBalance: [...ordered].reverse().find(t => typeof t.balance === "number")?.balance,
    highestBalance: balances.length ? Math.max(...balances) : undefined,
    lowestBalance: balances.length ? Math.min(...balances) : undefined,
    totalTransactions: tx.length,
  };
}

export function monthlyAnalysis(tx: AnalyticsTransaction[]): MonthlyAnalytics[] {
  const groups = new Map<string, AnalyticsTransaction[]>();
  for (const t of tx) { const key = monthKey(t.date); groups.set(key, [...(groups.get(key) || []), t]); }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, rows]) => {
    const incoming = rows.filter(t => t.direction === "received");
    const outgoing = rows.filter(t => t.direction === "sent");
    const ordered = [...rows].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
    const balances = ordered.filter(t => typeof t.balance === "number");
    return {
      key, label: monthLabel(key), received: incoming.reduce((s, t) => s + t.amount, 0),
      sent: outgoing.reduce((s, t) => s + t.amount, 0), net: rows.reduce((s, t) => s + (t.direction === "received" ? t.amount : -t.amount), 0),
      incomingCount: incoming.length, outgoingCount: outgoing.length,
      uniqueSenders: new Set(incoming.map(t => normalize(t.party))).size,
      uniqueRecipients: new Set(outgoing.map(t => normalize(t.party))).size,
      openingBalance: balances[0]?.balance, closingBalance: balances[balances.length - 1]?.balance,
    };
  });
}

export function partyAnalysis(tx: AnalyticsTransaction[]): PartyAnalytics[] {
  const groups = new Map<string, AnalyticsTransaction[]>();
  for (const t of tx) { const key = normalize(t.party); groups.set(key, [...(groups.get(key) || []), t]); }
  return [...groups.entries()].map(([key, rows]) => {
    const received = rows.filter(t => t.direction === "received").map(t => t.amount);
    const sent = rows.filter(t => t.direction === "sent").map(t => t.amount);
    const ordered = [...rows].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
    return {
      name: rows.find(t => t.party)?.party || key, accountNumber: rows.find(t => t.accountNumber)?.accountNumber, bank: rows.find(t => t.bank)?.bank,
      totalReceived: received.reduce((a, b) => a + b, 0), totalSent: sent.reduce((a, b) => a + b, 0), receivedCount: received.length, sentCount: sent.length,
      averageReceived: average(received), averageSent: average(sent), largestReceived: received.length ? Math.max(...received) : 0, largestSent: sent.length ? Math.max(...sent) : 0,
      firstTransaction: ordered[0]?.date || "", lastTransaction: ordered[ordered.length - 1]?.date || "",
      months: [...new Set(ordered.map(t => monthKey(t.date)))], transactions: ordered,
    };
  }).sort((a, b) => (b.totalReceived + b.totalSent) - (a.totalReceived + a.totalSent));
}

export function incomeAnalysis(tx: AnalyticsTransaction[]) {
  const incoming = tx.filter(t => t.direction === "received");
  const amounts = incoming.map(t => t.amount);
  const byMonth = monthlyAnalysis(tx).map(m => ({ month: m.label, amount: m.received }));
  const parties = partyAnalysis(incoming).sort((a, b) => b.totalReceived - a.totalReceived);
  const recurring = detectRecurring(incoming);
  return { totalIncome: amounts.reduce((a, b) => a + b, 0), byMonth, topSources: parties.slice(0, 10), largestIncoming: amounts.length ? Math.max(...amounts) : 0, averageIncoming: average(amounts), incomingTransactions: incoming.length, recurringIncome: recurring };
}

export function expenseAnalysis(tx: AnalyticsTransaction[]) {
  const outgoing = tx.filter(t => t.direction === "sent");
  const amounts = outgoing.map(t => t.amount);
  const byMonth = monthlyAnalysis(tx).map(m => ({ month: m.label, amount: m.sent }));
  const parties = partyAnalysis(outgoing).sort((a, b) => b.totalSent - a.totalSent);
  return { totalExpenses: amounts.reduce((a, b) => a + b, 0), byMonth, largestExpenses: [...outgoing].sort((a, b) => b.amount - a.amount).slice(0, 10), averageExpense: average(amounts), outgoingTransactions: outgoing.length, topRecipients: parties.slice(0, 10), topMerchants: merchantAnalysis(outgoing).slice(0, 10) };
}

export function spendingCategories(tx: AnalyticsTransaction[]): CategoryAnalytics[] {
  const outgoing = tx.filter(t => t.direction === "sent");
  const total = outgoing.reduce((s, t) => s + t.amount, 0);
  const map = new Map<string, { amount: number; count: number }>();
  for (const t of outgoing) { const category = categorize(t); const old = map.get(category) || { amount: 0, count: 0 }; old.amount += t.amount; old.count++; map.set(category, old); }
  return [...map.entries()].map(([category, v]) => ({ category, amount: v.amount, count: v.count, percentage: total ? (v.amount / total) * 100 : 0 })).sort((a, b) => b.amount - a.amount);
}

export function merchantAnalysis(tx: AnalyticsTransaction[]): MerchantAnalytics[] {
  const outgoing = tx.filter(t => t.direction === "sent");
  const map = new Map<string, AnalyticsTransaction[]>();
  for (const t of outgoing) { const key = normalizeMerchant(t.description, t.party); map.set(key, [...(map.get(key) || []), t]); }
  return [...map.entries()].map(([merchant, rows]) => {
    const ordered = [...rows].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
    return { merchant, totalSpent: rows.reduce((s, t) => s + t.amount, 0), count: rows.length, averageTransaction: average(rows.map(t => t.amount)), largestTransaction: Math.max(...rows.map(t => t.amount)), firstTransaction: ordered[0].date, lastTransaction: ordered[ordered.length - 1].date, monthly: Object.fromEntries(monthlyAnalysis(rows).map(m => [m.key, m.sent])) };
  }).sort((a, b) => b.totalSpent - a.totalSpent);
}

export function detectRecurring(tx: AnalyticsTransaction[]): RecurringAnalytics[] {
  const groups = new Map<string, AnalyticsTransaction[]>();
  for (const t of tx) { const key = normalize(`${t.party} ${t.description}`); if (key.length < 3) continue; groups.set(key, [...(groups.get(key) || []), t]); }
  const results: RecurringAnalytics[] = [];
  for (const [description, rows] of groups) {
    if (rows.length < 3) continue;
    const ordered = [...rows].sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
    const gaps = ordered.slice(1).map((t, i) => Math.round((toDate(t.date).getTime() - toDate(ordered[i].date).getTime()) / 86400000));
    const avgGap = average(gaps);
    let frequency: RecurringAnalytics["frequency"] = "irregular";
    if (avgGap >= 5 && avgGap <= 9) frequency = "weekly";
    else if (avgGap >= 25 && avgGap <= 35) frequency = "monthly";
    else if (avgGap >= 75 && avgGap <= 110) frequency = "quarterly";
    if (frequency === "irregular") continue;
    const amounts = rows.map(t => t.amount);
    const avgAmount = average(amounts);
    const monthlyCost = frequency === "monthly" ? avgAmount : frequency === "weekly" ? avgAmount * 52 / 12 : avgAmount / 3;
    results.push({ description, amount: avgAmount, frequency, occurrences: rows.length, averageAmount: avgAmount, firstOccurrence: ordered[0].date, mostRecentOccurrence: ordered[ordered.length - 1].date, monthlyCost, annualEstimatedCost: monthlyCost * 12, confidence: Math.min(0.99, 0.55 + rows.length * 0.06) });
  }
  return results.sort((a, b) => b.occurrences - a.occurrences || b.amount - a.amount);
}

export function buildFinancialAnalytics(tx: AnalyticsTransaction[]) {
  return { overview: financialOverview(tx), monthly: monthlyAnalysis(tx), income: incomeAnalysis(tx), parties: partyAnalysis(tx), expenses: expenseAnalysis(tx), categories: spendingCategories(tx), merchants: merchantAnalysis(tx.filter(t => t.direction === "sent")), recurring: detectRecurring(tx) };
}
