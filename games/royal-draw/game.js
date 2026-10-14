(() => {
  const CARDS = {
    miss: [{ rank: "7", suit: "spade", tone: "black" }, { rank: "4", suit: "diamond", tone: "red" }, { rank: "J", suit: "spade", tone: "black" }],
    pair: [{ rank: "K", suit: "heart", tone: "red" }, { rank: "K", suit: "diamond", tone: "red" }, { rank: "9", suit: "spade", tone: "black" }],
    "two-pair": [{ rank: "A", suit: "spade", tone: "black" }, { rank: "A", suit: "heart", tone: "red" }, { rank: "K", suit: "diamond", tone: "gold" }],
    crown: [{ rank: "Q", suit: "heart", tone: "red" }, { rank: "K", suit: "heart", tone: "red" }, { rank: "A", suit: "heart", tone: "gold" }],
    vault: [{ rank: "A", suit: "diamond", tone: "jackpot" }, { rank: "K", suit: "diamond", tone: "jackpot" }, { rank: "Q", suit: "diamond", tone: "jackpot" }]
  };
  const MESSAGES = { miss: "The table keeps this hand.", pair: "A royal pair is on the table.", "two-pair": "Two pairs. The court approves.", crown: "THE CROWN IS YOURS", vault: "ROYAL VAULT UNLOCKED" };
  let audio;
  const tone = (kind) => { if (!audio) return; const now = audio.currentTime; const osc = audio.createOscillator(); const gain = audio.createGain(); osc.type = kind === "win" ? "triangle" : "sine"; osc.frequency.setValueAtTime(kind === "win" ? 440 : 210, now); osc.frequency.exponentialRampToValueAtTime(kind === "win" ? 880 : 120, now + .12); gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.07, now + .015); gain.gain.exponentialRampToValueAtTime(.0001, now + .22); osc.connect(gain).connect(audio.destination); osc.start(now); osc.stop(now + .23); };
  const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));
  const dollar = (amount) => `$${Number(amount || 0).toLocaleString("en-US")}`;

  (async () => {
    const session = await Gamish.connect(); const balance = document.getElementById("balance"); const result = document.getElementById("result"); const win = document.getElementById("win"); const play = document.getElementById("play"); const cards = document.getElementById("cards"); const cardEls = [...cards.querySelectorAll(".card")]; const betRow = document.getElementById("bets"); const { bets, outcomes } = session.math; let bet = bets[0];
    const wallet = (value) => { balance.textContent = dollar(value.totalCredits); }; wallet(session.wallet); Gamish.onWallet(wallet);
    bets.forEach((amount) => { const button = document.createElement("button"); button.type = "button"; button.textContent = dollar(amount); button.classList.toggle("on", amount === bet); button.addEventListener("click", () => { if (!play.disabled) { bet = amount; [...betRow.children].forEach((item) => item.classList.toggle("on", item === button)); tone("tap"); } }); betRow.append(button); });
    const paint = (outcome) => { const set = CARDS[outcome] || CARDS.miss; cardEls.forEach((card, index) => { const value = set[index]; card.className = `card slot-${["one", "two", "three"][index]} ${value.tone}`; card.querySelector(".rank").textContent = value.rank; card.querySelector(".corner").textContent = value.rank; card.querySelector(".suit").className = `suit ${value.suit}`; }); };
    play.addEventListener("click", async () => { play.disabled = true; win.textContent = ""; result.textContent = "The dealer is drawing..."; if (!audio) audio = new AudioContext(); if (audio.state === "suspended") await audio.resume(); cards.classList.remove("revealing"); cards.classList.add("dealing"); tone("tap"); try { const roundPromise = Gamish.play({ bet }); await sleep(650); const round = await roundPromise; cards.classList.remove("dealing"); paint(round.outcome); cards.classList.add("revealing"); const found = outcomes.find((item) => item.id === round.outcome); const isWin = round.payout > 0; cardEls.forEach((card) => card.classList.toggle("winner", isWin)); await sleep(480); result.textContent = MESSAGES[round.outcome] || "The draw is complete."; win.textContent = isWin ? `WIN ${dollar(round.payout)}  ${found?.multiplier ?? round.multiplier}X` : "NO WIN"; if (isWin) tone("win"); Gamish.track("round_shown", { outcome: round.outcome }); } catch (error) { cards.classList.remove("dealing"); result.textContent = error.code === "insufficient_credits" ? "Not enough balance for this draw." : "The draw could not be completed."; win.textContent = ""; } finally { await sleep(180); play.disabled = false; } });
  })();
})();
