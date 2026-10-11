(() => {
  const PLAYBOOK = {
    bust: { title: "Dealer wins", detail: "Your hand went over 21.", player: [["9", "♥"], ["7", "♠"], ["8", "♦"]], dealer: [["K", "♣"], ["Q", "♦"]], playerTotal: "24", dealerTotal: "20" },
    push: { title: "Push", detail: "Even hands — your wager is returned.", player: [["10", "♥"], ["Q", "♠"]], dealer: [["K", "♦"], ["J", "♣"]], playerTotal: "20", dealerTotal: "20" },
    win: { title: "You win", detail: "A clean hand beats the dealer.", player: [["Q", "♥"], ["J", "♦"]], dealer: [["10", "♣"], ["8", "♠"]], playerTotal: "20", dealerTotal: "18" },
    blackjack: { title: "Blackjack", detail: "Twenty-one on the deal.", player: [["A", "♠"], ["K", "♥"]], dealer: [["Q", "♣"], ["10", "♦"]], playerTotal: "21", dealerTotal: "20" },
    royal: { title: "Royal Blackjack", detail: "An immaculate 21.", player: [["A", "♥"], ["K", "♦"]], dealer: [["J", "♣"], ["10", "♠"]], playerTotal: "21", dealerTotal: "20" }
  };

  const money = (value) => `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const isRed = (suit) => suit === "♥" || suit === "♦";
  let audio;
  const sound = (frequency, duration, type = "sine", volume = 0.035) => {
    try {
      audio ??= new AudioContext();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(); oscillator.stop(audio.currentTime + duration);
    } catch { /* Audio is an optional enhancement. */ }
  };
  const createCard = ([rank, suit], index, hidden = false) => {
    const card = document.createElement("div");
    card.className = `card${hidden ? " back" : ""}${isRed(suit) ? " red" : ""}`;
    card.style.setProperty("--order", index);
    card.style.setProperty("--angle", `${(index - 1) * 4}deg`);
    card.innerHTML = `<span class="corner top">${rank}<small>${suit}</small></span><span class="pip">${rank === "A" ? suit : ""}</span><span class="face">${["J", "Q", "K"].includes(rank) ? rank : ""}</span><span class="corner bottom">${rank}<small>${suit}</small></span>`;
    return card;
  };
  const render = (node, cards, hidden = false) => node.replaceChildren(...cards.map((card, index) => createCard(card, index, hidden && index === 1)));

  (async () => {
    const session = await Gamish.connect();
    const balance = document.getElementById("balance"); const selectedBet = document.getElementById("selectedBet");
    const deal = document.getElementById("deal"); const bets = document.getElementById("bets"); const table = document.querySelector(".table");
    const dealerCards = document.getElementById("dealerCards"); const playerCards = document.getElementById("playerCards");
    const dealerTotal = document.getElementById("dealerTotal"); const playerTotal = document.getElementById("playerTotal");
    const kicker = document.getElementById("outcomeKicker"); const title = document.getElementById("outcomeTitle"); const detail = document.getElementById("outcomeDetail"); const outcome = document.getElementById("outcome");
    const rules = document.getElementById("rules"); const rulesToggle = document.getElementById("rulesToggle"); const rulesClose = document.getElementById("rulesClose");
    let bet = session.math.bets[0]; let busy = false;
    const setWallet = (wallet) => { balance.textContent = money(wallet.totalCredits); };
    setWallet(session.wallet); Gamish.onWallet(setWallet);

    session.math.bets.forEach((amount) => {
      const button = document.createElement("button"); button.type = "button"; button.textContent = money(amount); button.classList.toggle("selected", amount === bet);
      button.addEventListener("click", () => { if (busy) return; bet = amount; selectedBet.textContent = money(bet); bets.querySelectorAll("button").forEach((item) => item.classList.toggle("selected", item === button)); sound(520, 0.04, "triangle", 0.02); });
      bets.append(button);
    });
    selectedBet.textContent = money(bet);
    const setRules = (open) => { rules.hidden = !open; rulesToggle.setAttribute("aria-expanded", String(open)); };
    rulesToggle.addEventListener("click", () => setRules(rules.hidden)); rulesClose.addEventListener("click", () => setRules(false));

    const showRound = async (round) => {
      const scene = PLAYBOOK[round.outcome] || PLAYBOOK.bust;
      table.classList.add("dealing"); outcome.className = "outcome"; kicker.textContent = "CARDS ON THE TABLE"; title.textContent = "Dealing…"; detail.textContent = "The dealer reveals the hand."; dealerTotal.textContent = "—"; playerTotal.textContent = "—";
      render(dealerCards, scene.dealer, true); render(playerCards, scene.player); sound(230, 0.055, "square", 0.03);
      await sleep(480); sound(310, 0.055, "square", 0.03); await sleep(340);
      render(dealerCards, scene.dealer); dealerTotal.textContent = scene.dealerTotal; playerTotal.textContent = scene.playerTotal;
      const positive = round.payout > 0; outcome.classList.add(positive ? "win" : "loss"); kicker.textContent = positive ? `${round.multiplier}× PAYOUT` : "THE DEAL IS OVER"; title.textContent = scene.title; detail.textContent = positive ? `${scene.detail} You receive ${money(round.payout)}.` : scene.detail;
      if (positive) { table.classList.add("win-flash"); sound(round.multiplier >= 2.5 ? 880 : 660, 0.17, "triangle", 0.05); window.setTimeout(() => table.classList.remove("win-flash"), 700); } else sound(135, 0.16, "sawtooth", 0.032);
      table.classList.remove("dealing"); Gamish.track("round_shown", { outcome: round.outcome, multiplier: round.multiplier });
    };
    deal.addEventListener("click", async () => {
      if (busy) return; busy = true; deal.disabled = true; bets.querySelectorAll("button").forEach((button) => { button.disabled = true; }); outcome.className = "outcome"; kicker.textContent = "SHUFFLING"; title.textContent = "Dealing the next hand…"; detail.textContent = "Please wait for the secure result."; sound(190, 0.07, "square", 0.025);
      try { const round = await Gamish.play({ bet }); await showRound(round); }
      catch (error) { outcome.className = "outcome loss"; kicker.textContent = "UNABLE TO DEAL"; title.textContent = error?.code === "insufficient_credits" ? "Insufficient balance" : "Please try again"; detail.textContent = error?.code === "insufficient_credits" ? "Choose a smaller bet or add funds." : (error?.message || "The round could not be completed."); }
      finally { busy = false; deal.disabled = false; bets.querySelectorAll("button").forEach((button) => { button.disabled = false; }); }
    });
  })().catch((error) => { const node = document.getElementById("outcomeTitle"); if (node) node.textContent = error?.message || "Unable to load Blackjack."; });
})();
