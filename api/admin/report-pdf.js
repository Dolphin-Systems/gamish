import { getSessionPlayer } from "../../lib/auth.js";
import { renderAdminReportPdf } from "../../lib/admin-report-pdf.js";
import { handleApiError, requireMethod } from "../../lib/http.js";
import { getAdminReport } from "../../lib/reports.js";

export default async function handler(req, res) {
  try {
    requireMethod(req, "GET");
    await getSessionPlayer(req, { role: "admin" });
    const requestedDays = Number(req.query?.days || 30);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const report = await getAdminReport({ days });
    const pdf = await renderAdminReportPdf(report);
    const date = new Date().toISOString().slice(0, 10);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="gamish777-report-${date}.pdf"`);
    res.setHeader("Content-Length", String(pdf.length));
    res.setHeader("Cache-Control", "no-store");
    res.end(pdf);
  } catch (error) {
    return handleApiError(res, error);
  }
}
