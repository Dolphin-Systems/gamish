import { getSessionPlayer } from "../../lib/auth.js";
import { controlRoom, saveGameSettings } from "../../lib/game-control.js";
import { addCapital, getHouse, houseLedger, setStartingBank, takeProfit } from "../../lib/house.js";
import { handleApiError, HttpError, json, readJson, requireBrowserAction, requireMethod } from "../../lib/http.js";
import { getAdminReport } from "../../lib/reports.js";

const nerdState = async () => {
  const house = await getHouse();
  return { house, ledger: await houseLedger(15), games: await controlRoom(house.balanceCents) };
};

// Reports, and the Nerd page's game math and house bank controls (GET ?view=nerd, POST),
// sharing one function to stay within the deployment's function limit.
export default async function handler(req, res) {
  try {
    requireMethod(req, ["GET", "POST"]);
    const admin = await getSessionPlayer(req, { role: "admin" });
    if (req.method === "GET") {
      if (req.query?.view === "nerd") return json(res, 200, await nerdState());
      const requestedDays = Number(req.query?.days || 30);
      const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
      return json(res, 200, await getAdminReport({ days }));
    }
    requireBrowserAction(req);
    const body = await readJson(req, 8_000);
    const cents = Number(body.amountCents);
    switch (body.action) {
      case "game_settings":
        await saveGameSettings(String(body.gameId || ""), body, admin.id);
        break;
      case "house_start":
        await setStartingBank(cents, admin.id);
        break;
      case "house_capital":
        await addCapital(cents, admin.id);
        break;
      case "house_withdraw":
        await takeProfit(cents, admin.id);
        break;
      default:
        throw new HttpError(400, "Unknown action", "invalid_action");
    }
    return json(res, 200, await nerdState());
  } catch (error) {
    return handleApiError(res, error);
  }
}
