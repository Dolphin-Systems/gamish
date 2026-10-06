// A complete minimal game. Everything visual is yours to redesign; keep the three SDK calls:
// Gamish.connect(), Gamish.play({ bet }), and showing the wallet it returns.
(async () => {
  const session = await Gamish.connect(); // { game, player, wallet, math, preview }
  const { bets, outcomes } = session.math;
  const balance = document.getElementById("balance");
  const result = document.getElementById("result");
  const play = document.getElementById("play");
  let bet = bets[0];

  const credits = (wallet) => `${wallet.totalCredits.toLocaleString("en-US")} credits`;
  const showWallet = (wallet) => { balance.textContent = credits(wallet); };
  showWallet(session.wallet);
  Gamish.onWallet(showWallet);

  const betRow = document.getElementById("bets");
  bets.forEach((amount) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gamish-frame";
    button.textContent = amount;
    button.addEventListener("click", () => {
      bet = amount;
      betRow.querySelectorAll("button").forEach((item) => item.classList.toggle("on", item === button));
    });
    if (amount === bet) button.classList.add("on");
    betRow.append(button);
  });

  // Labels for each outcome id in math.json: the server returns one of these ids.
  const LABELS = { miss: "No win this time", win: "Winner!", "big-win": "BIG WIN!" };

  play.addEventListener("click", async () => {
    play.disabled = true;
    result.textContent = "…";
    try {
      const round = await Gamish.play({ bet }); // the server decides; we only show it
      const best = outcomes.find((item) => item.id === round.outcome);
      result.textContent = round.payout > 0
        ? `${LABELS[round.outcome] ?? "Win"} +${round.payout} (${best.multiplier}×)`
        : LABELS[round.outcome] ?? "No win";
      Gamish.track("round_shown", { outcome: round.outcome });
    } catch (error) {
      result.textContent = error.code === "insufficient_credits" ? "Not enough credits" : error.message;
    } finally {
      play.disabled = false;
    }
  });
})();
