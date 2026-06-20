import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Summary, Transaction, Split } from "./types";

type RGB = [number, number, number];
const INK: RGB = [28, 27, 24];
const GREEN: RGB = [31, 81, 50];
const MUTED: RGB = [140, 136, 124];
const LINE: RGB = [214, 208, 193];
const INC: RGB = [44, 110, 73];
const EXP: RGB = [162, 59, 46];

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

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "..." : s;
}

// FIX 1: Replace Unicode → (U+2192) with ASCII " -> "
// jsPDF's built-in Helvetica/Times fonts use WinAnsi (CP1252) encoding
// which does not include U+2192, causing it to render as "!" or a box.
function accountText(t: Transaction): string {
  if (t.type === "transfer" || t.type === "saving")
    return `${t.fromAccount?.name ?? "?"} -> ${t.toAccount?.name ?? "?"}`;
  if (t.type === "income" || t.type === "reimbursement")
    return t.toAccount?.name ?? "?";
  return t.fromAccount?.name ?? "?";
}

export interface ReportOptions {
  user: { name: string; currency: string; monthlyBudget?: number | null };
  summary: Summary;
  transactions: Transaction[];
  splits: Split[];
  periodLabel: string;
}

export function buildReportDoc(opts: ReportOptions): jsPDF {
  const { user, summary, transactions, splits, periodLabel } = opts;
  const cur = user.currency || "INR";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 42;
  const generatedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  let y = 58;

  // FIX 2: sectionTitle now gives 22pt clearance below the heading baseline
  // (was 14pt, which left only ~1pt visual gap after the 13pt cap height)
  function sectionTitle(text: string) {
    if (y > pageH - 120) {
      doc.addPage();
      y = 58;
    }
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(text, M, y);
    y += 22; // was 14 — increased to give breathing room below heading
  }

  function checkPageBreak(needed: number) {
    if (y + needed > pageH - 60) {
      doc.addPage();
      y = 58;
    }
  }

  // ---- Masthead ----
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...INK);
  doc.text("FinCheck", M, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("FINANCIAL REPORT", M, y + 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(user.name || "Account holder", pageW - M, y - 10, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Period: ${periodLabel}`, pageW - M, y + 4, { align: "right" });
  doc.text(`Generated ${generatedAt}`, pageW - M, y + 16, { align: "right" });

  y += 32;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(1.5);
  doc.line(M, y, pageW - M, y);
  y += 28;

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
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(m.label, x, y);

    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...m.color);
    doc.text(m.value, x, y + 18);
  });
  y += 46;

  const headStyles = { font: "helvetica", fontStyle: "bold" as const, fontSize: 8.5, textColor: MUTED, lineColor: LINE, lineWidth: { bottom: 1 } };
  const baseBody = { font: "helvetica", fontSize: 9.5, textColor: INK, cellPadding: { top: 6, bottom: 6, left: 2, right: 2 }, lineColor: [240, 237, 229] as RGB, lineWidth: { bottom: 0.5 } };

  // ---- Budget Health ----
  if (user.monthlyBudget) {
    checkPageBreak(80);
    sectionTitle("Budget Health");

    const fromDate = new Date(summary.range.from);
    const toDate = new Date(summary.range.to);
    const now = new Date();

    const totalDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
    let currentDay = totalDays;
    if (now >= fromDate && now <= toDate) {
      currentDay = Math.round((now.getTime() - fromDate.getTime()) / 86400000) + 1;
    }
    const daysElapsed = currentDay;
    const expectedSpend = (user.monthlyBudget / totalDays) * daysElapsed;
    const isOverPace = summary.expense > expectedSpend;
    const paceDiff = Math.abs(summary.expense - expectedSpend);

    // FIX 3: Use splitTextToSize so long budget sentences wrap instead of
    // running off the right edge of the page.
    const availW = pageW - 2 * M;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const budgetLine = `Monthly Budget: ${money(user.monthlyBudget, cur)}`;
    doc.text(budgetLine, M, y);
    y += 14;

    const paceLine = isOverPace
      ? `Over pace by ${money(paceDiff, cur)}. Projected full-month spend: ${money(Math.round((summary.expense / daysElapsed) * totalDays), cur)}.`
      : `Under pace by ${money(paceDiff, cur)}. Doing great!`;

    doc.setTextColor(isOverPace ? EXP[0] : INC[0], isOverPace ? EXP[1] : INC[1], isOverPace ? EXP[2] : INC[2]);
    const paceLines = doc.splitTextToSize(paceLine, availW);
    doc.text(paceLines, M, y);
    y += paceLines.length * 13 + 22; // 13pt line-height + 22pt bottom padding
  }

  // ---- Accounts ----
  const accts = summary.accounts.filter((a) => !a.archived && a.type !== "savings");
  sectionTitle("Accounts");
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "plain",
    head: [["Account", "Type", "Balance"]],
    body: accts.map((a) => [a.name, cap(a.type), money(a.balance, cur)]),
    foot: [[{ content: "Total (excluding savings)", colSpan: 2 }, money(accts.reduce((sum, a) => sum + a.balance, 0), cur)]],
    headStyles,
    bodyStyles: baseBody,
    footStyles: { font: "helvetica", fontStyle: "bold", fontSize: 9.5, textColor: INK, lineColor: LINE, lineWidth: { top: 1 } },
    columnStyles: { 2: { halign: "right", font: "times", fontStyle: "bold" } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 36;

  // ---- Savings Goals ----
  const goals = summary.accounts.filter((a) => !a.archived && a.type === "savings" && (a.goalTarget || 0) > 0);
  if (goals.length > 0) {
    checkPageBreak(100);
    sectionTitle("Savings Goals");
    y += 2;

    goals.forEach(goal => {
      checkPageBreak(40);
      const target = goal.goalTarget || 1;
      const progress = Math.min(100, Math.max(0, (goal.balance / target) * 100));

      const labelY = y;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(goal.name, M, labelY);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(`${Math.round(progress)}%`, M + 140, labelY);

      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(`${money(goal.balance, cur)} of ${money(target, cur)}`, pageW - M, labelY, { align: "right" });

      y += 8;

      const barX = M;
      const barMaxW = pageW - 2 * M;
      doc.setFillColor(...LINE);
      doc.roundedRect(barX, y, barMaxW, 6, 2, 2, "F");

      const w = Math.max(2, (progress / 100) * barMaxW);
      doc.setFillColor(...GREEN);
      doc.roundedRect(barX, y, w, 6, 2, 2, "F");

      y += 26;
    });

    y += 10;
  }

  // ---- Spending by category (horizontal bar chart) ----
  if (summary.expense > 0 && summary.byCategory.length) {
    checkPageBreak(120);
    sectionTitle(`Spending by Category`);
    y += 2;
    const cats = summary.byCategory.slice(0, 8);
    const maxAmt = Math.max(...cats.map((c) => c.amount));

    // FIX 4: Increase right reservation from 70pt to 110pt so the percentage
    // label and the amount value no longer overlap.
    // Layout (A4 = 595pt, M = 42):
    //   [42..152]  category name  (110pt)
    //   [152..443] bar            (291pt)
    //   [449..553] "45%"  label   (starts 6pt after bar end)
    //   [..553]    amount         (right-aligned, ~80pt wide)
    const barX = M + 110;                        // 152
    const barMaxW = pageW - M - barX - 110;      // 291  (was 70 → 110)
    const pctX = barX + barMaxW + 6;             // 449

    cats.forEach((c) => {
      checkPageBreak(24);
      const pct = Math.round((c.amount / summary.expense) * 100);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(truncate(c.name, 18), M, y + 7);

      // track
      doc.setFillColor(...LINE);
      doc.roundedRect(barX, y, barMaxW, 7, 2, 2, "F");

      // fill
      const w = Math.max(2, (c.amount / maxAmt) * barMaxW);
      doc.setFillColor(...GREEN);
      doc.roundedRect(barX, y, w, 7, 2, 2, "F");

      // percentage — now sits in its own clear 104pt column
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`${pct}%`, pctX, y + 7);

      // amount right-aligned
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(money(c.amount, cur), pageW - M, y + 7, { align: "right" });

      y += 22;
    });
    y += 14;
  }

  // ---- Top 5 Expenses ----
  const expenses = transactions.filter(t => t.type === "expense").sort((a, b) => b.amount - a.amount).slice(0, 5);
  if (expenses.length > 0) {
    checkPageBreak(120);
    sectionTitle("Top 5 Expenses");
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      theme: "plain",
      head: [["Date", "Description", "Category", "Amount"]],
      body: expenses.map((t) => [
        fmtDate(t.date),
        truncate(t.note || "-", 35),
        t.category?.name ?? "-",
        money(t.amount, cur),
      ]),
      headStyles,
      bodyStyles: { ...baseBody, fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 64, textColor: MUTED },
        3: { halign: "right", font: "times", fontStyle: "bold", textColor: EXP },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 36;
  }

  // ---- Splits Appendix ----
  if (splits.length > 0) {
    checkPageBreak(120);
    sectionTitle(`Group Splits — ${periodLabel}`);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      theme: "plain",
      head: [["Date", "Note", "Total", "Your Share", "Settled", "Status"]],
      body: splits.map((s) => [
        fmtDate(s.createdAt),
        truncate(s.splitNote || "Untitled Split", 25),
        money(s.totalAmount, cur),
        money(s.myShare, cur),
        money(s.settledAmount, cur),
        s.settled ? "Settled" : "Pending",
      ]),
      headStyles,
      bodyStyles: { ...baseBody, fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 60, textColor: MUTED },
        2: { halign: "right", font: "times", fontStyle: "bold" },
        3: { halign: "right", font: "times", fontStyle: "bold" },
        4: { halign: "right", font: "times", fontStyle: "bold" },
        5: { halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          const s = splits[data.row.index];
          if (s?.settled) data.cell.styles.textColor = INC;
          else data.cell.styles.textColor = EXP;
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 36;
  }

  // ---- Transaction Ledger ----
  checkPageBreak(100);
  sectionTitle(`Transaction Ledger — ${periodLabel}`);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "plain",
    head: [["Date", "Description", "Account", "Category", "Amount"]],
    body: transactions.length
      ? transactions.map((t) => [
          fmtDate(t.date),
          truncate(t.note || t.category?.name || cap(t.type), 30),
          accountText(t),
          t.type === "transfer" || t.type === "saving" ? cap(t.type) : (t.category?.name ?? "-"),
          `${(t.type === "income" || t.type === "reimbursement") ? "+" : t.type === "expense" ? "-" : ""}${money(t.amount, cur)}`,
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
        if (t?.type === "income" || t?.type === "reimbursement") data.cell.styles.textColor = INC;
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