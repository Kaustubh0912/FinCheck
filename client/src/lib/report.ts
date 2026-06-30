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

// jsPDF's built-in Helvetica/Times fonts use WinAnsi (CP1252) encoding
// which does not include U+2192, so use ASCII " -> " instead.
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

  // sectionTitle: renders heading and advances y by 28pt total
  // (13pt font + 15pt clearance below baseline before next content)
  function sectionTitle(text: string) {
    if (y > pageH - 120) {
      doc.addPage();
      y = 58;
    }
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(text, M, y);
    // FIX 1: Unified spacing — was 22, now 28 so content never crowds the heading.
    y += 28;
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
  const closingBalance = summary.netWorth;
  const net = closingBalance - summary.openingBalance;
  const metrics: { label: string; value: string; color: RGB }[] = [
    { label: "OPENING", value: money(summary.openingBalance, cur), color: INK },
    { label: "INCOME", value: money(summary.income, cur), color: INC },
    { label: "EXPENSES", value: money(summary.expense, cur), color: EXP },
    { label: "OTHER", value: money(summary.investment, cur), color: MUTED },
    { label: "NET FLOW", value: money(net, cur), color: net >= 0 ? INC : EXP },
    { label: "CLOSING", value: money(closingBalance, cur), color: INK },
  ];
  const colW = (pageW - 2 * M) / 3;
  metrics.forEach((m, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = M + col * colW;
    const currentY = y + (row * 36);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(m.label, x, currentY);

    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...m.color);
    doc.text(m.value, x, currentY + 16);
  });
  // FIX 2: was 72, bumped to 80 so the 2nd row of metrics (INVESTED/NET/CLOSING)
  // has enough clearance before the next section.
  y += 80;

  const headStyles = {
    font: "helvetica",
    fontStyle: "bold" as const,
    fontSize: 8.5,
    textColor: MUTED,
    lineColor: LINE,
    lineWidth: { bottom: 1 },
  };
  const baseBody = {
    font: "helvetica",
    fontSize: 9.5,
    textColor: INK,
    // FIX 3: Increased vertical cell padding from 6 to 7 for better row breathing room.
    cellPadding: { top: 7, bottom: 7, left: 2, right: 2 },
    lineColor: [240, 237, 229] as RGB,
    lineWidth: { bottom: 0.5 },
  };

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

    const availW = pageW - 2 * M;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const budgetLine = `Monthly Budget: ${money(user.monthlyBudget, cur)}`;
    doc.text(budgetLine, M, y);
    y += 16; // FIX 4: was 14 — a touch more gap between the two budget lines

    const paceLine = isOverPace
      ? `Over pace by ${money(paceDiff, cur)}. Projected full-month spend: ${money(Math.round((summary.expense / daysElapsed) * totalDays), cur)}.`
      : `Under pace by ${money(paceDiff, cur)}. Doing great!`;

    doc.setTextColor(isOverPace ? EXP[0] : INC[0], isOverPace ? EXP[1] : INC[1], isOverPace ? EXP[2] : INC[2]);
    const paceLines = doc.splitTextToSize(paceLine, availW);
    doc.text(paceLines, M, y);
    // FIX 5: was paceLines.length * 13 + 22 — use 14pt line height (matches 9.5pt font
    // cap height + descenders) and 26pt bottom padding for a more generous section gap.
    y += paceLines.length * 14 + 26;
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
    foot: [
      [
        // FIX 6: colspan on the label cell only goes to col 1 (not 2) so the
        // Balance column keeps its right-alignment on the footer total.
        { content: "Total (excluding savings)", colSpan: 2 },
        money(accts.reduce((sum, a) => sum + a.balance, 0), cur),
      ],
    ],
    headStyles,
    bodyStyles: baseBody,
    footStyles: {
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 9.5,
      textColor: INK,
      lineColor: LINE,
      lineWidth: { top: 1 },
    },
    columnStyles: {
      // FIX 7: Balance column right-aligned in both body and footer.
      2: { halign: "right", font: "times", fontStyle: "bold" },
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 36;

  // ---- Savings Goals ----
  const goals = summary.accounts.filter((a) => !a.archived && a.type === "savings" && (a.goalTarget || 0) > 0);
  if (goals.length > 0) {
    checkPageBreak(100);
    sectionTitle("Savings Goals");
    // FIX 8: Removed the stray `y += 2` that was here — sectionTitle already
    // lands y at the right starting point for content.

    goals.forEach((goal) => {
      checkPageBreak(48);
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

      // FIX 9: Increased gap between label and bar from 8 to 10pt so the bar
      // doesn't visually merge with the text baseline.
      y += 10;

      const barX = M;
      const barMaxW = pageW - 2 * M;
      doc.setFillColor(...LINE);
      doc.roundedRect(barX, y, barMaxW, 6, 2, 2, "F");

      const w = Math.max(2, (progress / 100) * barMaxW);
      doc.setFillColor(...GREEN);
      doc.roundedRect(barX, y, w, 6, 2, 2, "F");

      // FIX 10: was 26 — increased to 30pt per goal row so multiple goals
      // have comfortable vertical separation.
      y += 30;
    });

    y += 10;
  }

  // ---- Spending by category (horizontal bar chart) ----
  if (summary.expense > 0 && summary.byCategory.length) {
    checkPageBreak(120);
    sectionTitle("Spending by Category");
    // FIX 11: Removed stray `y += 2` — sectionTitle already advances y by 28.

    const cats = summary.byCategory.slice(0, 8);
    const maxAmt = Math.max(...cats.map((c) => c.amount));

    // Layout (A4 = 595pt, M = 42):
    //   [42..152]  category name  (110pt)
    //   [152..443] bar            (291pt)
    //   [449..510] "45%"  label   (starts 6pt after bar end, 61pt wide)
    //   [..553]    amount         (right-aligned into remaining ~43pt)
    const barX = M + 110;                   // 152
    const barMaxW = pageW - M - barX - 110; // 291
    const pctX = barX + barMaxW + 6;        // 449

    cats.forEach((c) => {
      checkPageBreak(26);
      const pct = Math.round((c.amount / summary.expense) * 100);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      // FIX 12: Vertically centre the label against the 7pt-tall bar (bar sits
      // at `y`, label baseline at `y + 7` matches cap-height midpoint of bar).
      doc.text(truncate(c.name, 18), M, y + 7);

      // track
      doc.setFillColor(...LINE);
      doc.roundedRect(barX, y, barMaxW, 7, 2, 2, "F");

      // fill
      const w = Math.max(2, (c.amount / maxAmt) * barMaxW);
      doc.setFillColor(...GREEN);
      doc.roundedRect(barX, y, w, 7, 2, 2, "F");

      // percentage
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`${pct}%`, pctX, y + 7);

      // amount right-aligned
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(money(c.amount, cur), pageW - M, y + 7, { align: "right" });

      // FIX 13: was 22 — increased to 24pt per category row for slightly more
      // breathing room between bars.
      y += 24;
    });
    y += 14;
  }

  // ---- Investments (Excluded from budget) ----
  const investments = transactions.filter(
    (t) => t.excludeFromBudget && (t.type === "expense" || t.type === "saving")
  );
  if (investments.length > 0) {
    checkPageBreak(120);
    sectionTitle("Other Expenditures (Excluded from Budget)");
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      theme: "plain",
      head: [["Date", "Description", "Account", "Category", "Amount"]],
      body: investments.map((t) => [
        fmtDate(t.date),
        truncate(t.note || t.category?.name || cap(t.type), 30),
        accountText(t),
        t.type === "transfer" || t.type === "saving" ? cap(t.type) : (t.category?.name ?? "-"),
        money(t.amount, cur),
      ]),
      // FIX A: colSpan: 4 means the label spans cols 0–3 and the amount lands
      // in col 4 — correct. But autoTable ignores columnStyles on footer cells,
      // so the right-align must be forced via didParseCell instead (see below).
      foot: [[{ content: "Total Investments", colSpan: 4 }, money(summary.investment, cur)]],
      headStyles,
      bodyStyles: { ...baseBody, fontSize: 9 },
      footStyles: {
        font: "helvetica",
        fontStyle: "bold",
        fontSize: 9.5,
        textColor: INK,
        lineColor: LINE,
        lineWidth: { top: 1 },
      },
      columnStyles: {
        0: { cellWidth: 64, textColor: MUTED },
        4: { halign: "right", font: "times", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        // FIX B: Right-align the Amount header label so it sits above the values.
        if (data.section === "head" && data.column.index === 4) {
          data.cell.styles.halign = "right";
        }
        // FIX C: Description column — investments are neutral (neither income
        // nor expense in spirit), so render in INK not EXP red.
        if (data.section === "body" && data.column.index === 1) {
          data.cell.styles.textColor = INK;
        }
        // FIX D: Footer amount cell — columnStyles doesn't apply to foot rows
        // in jsPDF-autotable, so force right-align + Times Bold here.
        if (data.section === "foot" && data.column.index === 1) {
          data.cell.styles.halign = "right";
          data.cell.styles.font = "times";
        }
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
        // FIX 15: All three monetary columns (Total / Your Share / Settled) are
        // now consistently right-aligned, matching the reference screenshot.
        2: { halign: "right", font: "times", fontStyle: "bold" },
        3: { halign: "right", font: "times", fontStyle: "bold" },
        4: { halign: "right", font: "times", fontStyle: "bold" },
        // FIX 16: Status column right-aligned to match reference screenshot.
        5: { halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          const s = splits[data.row.index];
          if (s?.settled) data.cell.styles.textColor = INC;
          else data.cell.styles.textColor = EXP;
        }
        // FIX 17: Mirror the right-align on header cells for monetary columns
        // so header labels sit above their values correctly.
        if (data.section === "head" && [2, 3, 4, 5].includes(data.column.index)) {
          data.cell.styles.halign = "right";
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
          (t.excludeFromBudget ? "[INV] " : "") +
            truncate(t.note || t.category?.name || cap(t.type), t.excludeFromBudget ? 24 : 30),
          accountText(t),
          t.type === "transfer" || t.type === "saving" ? cap(t.type) : (t.category?.name ?? "-"),
          // FIX 18: Transfers now also show no sign (neutral), consistent with
          // how they're colour-coded (no INC/EXP color applied below either).
          `${t.type === "income" || t.type === "reimbursement" ? "+" : t.type === "expense" ? "-" : ""}${money(t.amount, cur)}`,
        ])
      : [["", "No transactions in this period.", "", "", ""]],
    headStyles,
    bodyStyles: { ...baseBody, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 64, textColor: MUTED },
      // FIX 19: Amount column right-aligned in the ledger too.
      4: { halign: "right", font: "times", fontStyle: "bold" },
    },
    // FIX 20: Mirror right-align on Amount header cell.
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index === 4) {
        data.cell.styles.halign = "right";
      }
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