import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Summary, Transaction } from "./types";

type RGB = [number, number, number];
const INK: RGB = [28, 27, 24];
const GREEN: RGB = [31, 81, 50];
const MUTED: RGB = [140, 136, 124];
const LINE: RGB = [214, 208, 193];
const INC: RGB = [44, 110, 73];
const EXP: RGB = [162, 59, 46];

/** Currency code form (e.g. "INR 1,200.00") — avoids missing glyphs like ₹ in PDF fonts. */
function money(minor: number, currency: string): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function accountText(t: Transaction): string {
  if (t.type === "transfer") return `${t.fromAccount?.name ?? "?"} -> ${t.toAccount?.name ?? "?"}`;
  if (t.type === "income") return t.toAccount?.name ?? "?";
  return t.fromAccount?.name ?? "?";
}

export interface ReportOptions {
  user: { name: string; currency: string };
  summary: Summary;
  transactions: Transaction[];
  periodLabel: string;
}

export function buildReportDoc(opts: ReportOptions): jsPDF {
  const { user, summary, transactions, periodLabel } = opts;
  const cur = user.currency || "INR";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 42;
  const generatedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  // ---- Masthead ----
  let y = 58;
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...INK);
  doc.text("FinCheck", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("FINANCIAL REPORT", M, y + 16);

  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(user.name || "Account holder", pageW - M, y - 10, { align: "right" });
  doc.setTextColor(...MUTED);
  doc.text(`Period: ${periodLabel}`, pageW - M, y + 4, { align: "right" });
  doc.text(`Generated ${generatedAt}`, pageW - M, y + 16, { align: "right" });

  y += 30;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(1.5);
  doc.line(M, y, pageW - M, y);
  y += 30;

  // ---- Summary metrics ----
  const net = summary.income - summary.expense;
  const metrics: { label: string; value: string; color: RGB }[] = [
    { label: "NET WORTH", value: money(summary.netWorth, cur), color: INK },
    { label: "INCOME", value: money(summary.income, cur), color: INC },
    { label: "EXPENSES", value: money(summary.expense, cur), color: EXP },
    { label: "NET FLOW", value: money(net, cur), color: net >= 0 ? INC : EXP },
  ];
  const colW = (pageW - 2 * M) / metrics.length;
  metrics.forEach((m, i) => {
    const x = M + i * colW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(m.label, x, y);
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...m.color);
    doc.text(m.value, x, y + 16);
  });
  y += 40;

  const headStyles = { font: "helvetica", fontStyle: "bold" as const, fontSize: 8.5, textColor: INK, lineColor: LINE, lineWidth: { bottom: 1 } };
  const baseBody = { font: "helvetica", fontSize: 9.5, textColor: INK, cellPadding: { top: 6, bottom: 6, left: 2, right: 2 }, lineColor: [233, 228, 216] as RGB, lineWidth: { bottom: 0.5 } };

  function sectionTitle(text: string) {
    if (y > pageH - 120) {
      doc.addPage();
      y = 58;
    }
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(text, M, y);
    y += 8;
  }

  // ---- Accounts ----
  const accts = summary.accounts.filter((a) => !a.archived);
  sectionTitle("Accounts");
  autoTable(doc, {
    startY: y + 4,
    margin: { left: M, right: M },
    theme: "plain",
    head: [["Account", "Type", "Balance"]],
    body: accts.map((a) => [a.name, cap(a.type), money(a.balance, cur)]),
    foot: [["Net worth", "", money(summary.netWorth, cur)]],
    headStyles,
    bodyStyles: baseBody,
    footStyles: { font: "times", fontStyle: "bold", fontSize: 10, textColor: INK, lineColor: LINE, lineWidth: { top: 1 } },
    columnStyles: { 2: { halign: "right", font: "times" } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 28;

  // ---- Spending by category ----
  if (summary.expense > 0 && summary.byCategory.length) {
    sectionTitle(`Spending by category — ${periodLabel}`);
    autoTable(doc, {
      startY: y + 4,
      margin: { left: M, right: M },
      theme: "plain",
      head: [["Category", "Amount", "Share"]],
      body: summary.byCategory.map((c) => [
        c.name,
        money(c.amount, cur),
        `${Math.round((c.amount / summary.expense) * 100)}%`,
      ]),
      headStyles,
      bodyStyles: baseBody,
      columnStyles: { 1: { halign: "right", font: "times" }, 2: { halign: "right", textColor: MUTED } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 28;
  }

  // ---- Transactions ----
  sectionTitle(`Transactions — ${periodLabel}`);
  autoTable(doc, {
    startY: y + 4,
    margin: { left: M, right: M },
    theme: "plain",
    head: [["Date", "Description", "Account", "Category", "Amount"]],
    body: transactions.length
      ? transactions.map((t) => [
          fmtDate(t.date),
          t.note || t.category?.name || cap(t.type),
          accountText(t),
          t.type === "transfer" ? "Transfer" : t.category?.name ?? "-",
          `${t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}${money(t.amount, cur)}`,
        ])
      : [["", "No transactions in this period.", "", "", ""]],
    headStyles,
    bodyStyles: { ...baseBody, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 64, textColor: MUTED },
      4: { halign: "right", font: "times", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4 && transactions.length) {
        const t = transactions[data.row.index];
        if (t?.type === "income") data.cell.styles.textColor = INC;
        else if (t?.type === "expense") data.cell.styles.textColor = EXP;
      }
    },
  });

  // ---- Footer (page numbers) on every page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`FinCheck · ${user.name || ""}`, M, pageH - 24);
    doc.text(`Page ${i} of ${pages}`, pageW - M, pageH - 24, { align: "right" });
  }

  return doc;
}

export function generateReport(opts: ReportOptions): void {
  buildReportDoc(opts).save(`fincheck-report-${new Date().toISOString().slice(0, 7)}.pdf`);
}
