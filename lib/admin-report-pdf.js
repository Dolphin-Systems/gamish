import PDFDocument from "pdfkit";

const COLORS = {
  ink: "#111111",
  muted: "#66706A",
  line: "#DDE4DF",
  green: "#00C853",
  greenSoft: "#E9FBEF",
  white: "#FFFFFF",
};

const money = (cents) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
}).format(Number(cents || 0) / 100);

function pageHeader(doc, title, subtitle) {
  doc.fillColor(COLORS.green).roundedRect(44, 36, 52, 52, 16).fill();
  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(22).text("G", 44, 50, { width: 52, align: "center" });
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(22).text(title, 112, 40);
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9).text(subtitle, 112, 69);
  doc.moveTo(44, 104).lineTo(568, 104).strokeColor(COLORS.line).lineWidth(1).stroke();
  doc.y = 124;
}

function sectionTitle(doc, title) {
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(13).text(title, 44, doc.y);
  doc.y += 13;
}

function summaryCard(doc, x, y, width, label, value) {
  doc.roundedRect(x, y, width, 70, 14).fill(COLORS.greenSoft);
  doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(8).text(label.toUpperCase(), x + 14, y + 14, { width: width - 28 });
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(17).text(value, x + 14, y + 36, { width: width - 28 });
}

function ensureSpace(doc, height, title, subtitle) {
  if (doc.y + height <= 735) return;
  doc.addPage();
  pageHeader(doc, title, subtitle);
}

function tableHeader(doc, columns, y) {
  doc.roundedRect(44, y, 524, 24, 7).fill(COLORS.ink);
  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(7.5);
  for (const column of columns) doc.text(column.label, column.x, y + 8, { width: column.width, align: column.align || "left" });
  doc.y = y + 29;
}

function tableRow(doc, columns, values, shade = false) {
  const y = doc.y;
  if (shade) doc.rect(44, y - 3, 524, 22).fill("#F6F8F7");
  doc.fillColor(COLORS.ink).font("Helvetica").fontSize(7.5);
  columns.forEach((column, index) => doc.text(String(values[index] ?? ""), column.x, y + 3, { width: column.width, align: column.align || "left", ellipsis: true }));
  doc.moveTo(44, y + 19).lineTo(568, y + 19).strokeColor(COLORS.line).lineWidth(0.5).stroke();
  doc.y = y + 23;
}

export async function renderAdminReportPdf(report) {
  const doc = new PDFDocument({ size: "LETTER", margin: 44, bufferPages: true, info: { Title: "Gamish777 Admin Report", Author: "Gamish777" } });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const complete = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const generated = new Date(report.generatedAt).toLocaleString("en-US", { timeZone: report.timezone });
  const subtitle = `${report.days}-day report | ${report.timezone} | Generated ${generated}`;
  pageHeader(doc, "Gamish777 Admin Report", subtitle);

  const cardWidth = 164;
  summaryCard(doc, 44, 124, cardWidth, "Cash in", money(report.summary.periodCashInCents));
  summaryCard(doc, 224, 124, cardWidth, "Cash out", money(report.summary.periodCashOutCents));
  summaryCard(doc, 404, 124, cardWidth, "Game net", money(report.summary.periodGameNet));
  doc.y = 216;
  summaryCard(doc, 44, 216, cardWidth, "Active players", report.summary.activePlayers);
  summaryCard(doc, 224, 216, cardWidth, "Frozen players", report.summary.frozenPlayers);
  summaryCard(doc, 404, 216, cardWidth, "Bonus available", money(report.bonusPool.available));
  doc.y = 312;

  sectionTitle(doc, "Daily activity");
  const dailyColumns = [
    { label: "DATE", x: 52, width: 78 },
    { label: "CASH IN", x: 136, width: 76, align: "right" },
    { label: "CASH OUT", x: 218, width: 76, align: "right" },
    { label: "WAGERED", x: 300, width: 76, align: "right" },
    { label: "WON", x: 382, width: 76, align: "right" },
    { label: "GAME NET", x: 464, width: 94, align: "right" },
  ];
  tableHeader(doc, dailyColumns, doc.y);
  if (!report.daily.length) tableRow(doc, dailyColumns, ["No activity"]);
  report.daily.forEach((row, index) => {
    ensureSpace(doc, 30, "Daily activity", subtitle);
    if (doc.y < 160) tableHeader(doc, dailyColumns, doc.y);
    tableRow(doc, dailyColumns, [
      new Date(row.date).toLocaleDateString("en-US", { timeZone: "UTC" }),
      money(row.cashInCents), money(row.cashOutCents), money(row.wagered), money(row.won), money(row.gameNet),
    ], index % 2 === 1);
  });

  ensureSpace(doc, 110, "Player lifetime totals", subtitle);
  doc.y += 16;
  sectionTitle(doc, "Player lifetime totals");
  const playerColumns = [
    { label: "PLAYER", x: 52, width: 118 },
    { label: "STATUS", x: 176, width: 68 },
    { label: "AVAILABLE", x: 250, width: 92, align: "right" },
    { label: "CASH IN", x: 348, width: 92, align: "right" },
    { label: "CASH OUT", x: 446, width: 112, align: "right" },
  ];
  tableHeader(doc, playerColumns, doc.y);
  if (!report.players.length) tableRow(doc, playerColumns, ["No players"]);
  report.players.forEach((player, index) => {
    ensureSpace(doc, 30, "Player lifetime totals", subtitle);
    if (doc.y < 160) tableHeader(doc, playerColumns, doc.y);
    tableRow(doc, playerColumns, [player.loginId, player.status, money(player.totalCredits), money(player.paidInCents), money(player.paidOutCents)], index % 2 === 1);
  });

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(7.5).text(
      `Gamish777 internal virtual-balance report | Page ${index + 1} of ${range.count}`,
      44, 720, { width: 524, align: "center", lineBreak: false },
    );
  }
  doc.end();
  return complete;
}
