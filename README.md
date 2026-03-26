# Polymarket Copytrading Bot
[TypeScript](https://www.typescriptlang.org/) [Node](https://nodejs.org/) [License: ISC](https://opensource.org/licenses/ISC) [Build](package.json) [Polymarket](https://polymarket.com/)

> The top wallets on Polymarket aren't smarter than you. They're just faster. Now you can be too.

---

## The Story

I have a bad habit of checking leaderboards.

Most people look at them once, feel vaguely bad, and close the tab. I started actually reading them. And what I noticed was strange: the same five or six wallets kept sitting at the top of completely unrelated markets. Bitcoin price calls. US election outcomes. Premier League results. Interest rate bets. Week after week, same names.

At some point you stop calling it luck.

So I did something that felt ridiculous: I stopped trading entirely for a few weeks and just watched those wallets. No code. No positions. Just obsessive wallet-stalking like a financial creep.

Here's what I found. These accounts were not oracles. They weren't sitting on insider information. They just had three things I didn't:

- **Speed.** They were in before the narrative formed.
- **Discipline.** They sized correctly and didn't chase.
- **Systems.** They weren't clicking buttons manually at 2am.

That last one stuck with me.

I tried building my own signal engine first. Custom logic, arbitrage plays, my own thesis. It worked for a couple months. Decent returns, nothing to write home about. Then it stopped working. Quietly, slowly, just grinding into losses until I killed it and stared at the logs wondering where the edge went.

That's when the obvious question hit me like a freight train:

**Why am I building my own edge when someone else already has one?**

So I burned the arbitrage bot and built this instead. It finds the wallets already beating the market and mirrors their trades at your size, across every category on Polymarket, while you do literally anything else.

You don't need to be the best trader on the platform. You need to know who is.

---

## Is This For You?

Pull up your last five trades on Polymarket.

Now look up those same markets on the leaderboard and see where the top wallets entered.

Did you beat them? Did you even come close?

Probably not. And here's the thing: that's not a knowledge problem. You don't need more research. The top wallets are not necessarily smarter than you. They are faster, more systematic, and they don't second-guess entries at the last second. That's a tooling problem. This bot is the tool.

It runs 24/7. It doesn't get tired. It doesn't hesitate. And it definitely doesn't close a winning position early because it got nervous.

---

## How It Works

You can't read minds. You can read wallets.

The bot opens a live WebSocket connection to Polymarket's order book and tracks the target wallets you configure through the CLOB API. When one of them moves, the signal comes in fast and gets evaluated before anything is placed.

### Covers every market, not just crypto

The wallets worth following aren't just trading BTC. They're across every category on the site.

This bot covers **crypto** (BTC, SOL, ETH, XRP and more), **politics**, **sports**, **world events**, and **economics**. Set `COPYTRADE_MARKETS` to a comma-separated list of slugs. Five markets or fifty, your call.

### Reacts in real time

`websocketOrderbook` holds a persistent connection to Polymarket's CLOB market channel and keeps best bid and ask updated by token ID, continuously.

When a tracked wallet moves, you get the signal before it's old news. No polling lag, no stale prices.

### Scales to your account, not theirs

A whale putting in $5,000 on a market is not the same bet for you and your $800 account.

The bot sizes positions relative to your balance. `COPYTRADE_SHARES` sets how many shares per trade. `COPYTRADE_MAX_BUY_COUNTS_PER_SIDE` limits how many times it buys per side so you don't accidentally concentrate everything into one signal.

### Has a brain, not just a trigger

Not every signal deserves an order.

`pricePredictor` grades every incoming signal before anything touches the CLOB. Only `BUY_UP` or `BUY_DOWN` with confidence above the threshold goes through. Everything else returns `HOLD` and the bot does nothing. That filter alone eliminated 68 bad trades in the backtest below.

`COPYTRADE_PRICE_BUFFER` adds cushion against price drift at execution time. `BOT_MIN_USDC_BALANCE` puts a floor under your balance so the bot never trades on fumes.

---

## Proof of Work

Live wallet this ran on: [polymarket.com/@distinct-baguette](https://polymarket.com/@distinct-baguette)

### Backtest: 177 markets, 2 days, $100 per entry

```
markets_count:     177
markets_replayed:  177
total_entries:     108
total_risk_sells:  66
skipped_low_conf:  68
total_pnl:         +1938.00
stats:             win_rate=23.73%  avg_win=+46.14  max_dd=0.00
```

```
daily_stats:
  date         markets  up  down    pnl       win_rate   total_cost
  2026-03-23     93     81   12   +1070.00   24.73%      3900.00
  2026-03-24     84     58   26    +868.00   22.62%      2580.00

overall:
  total_cost:          6480.00
  avg_cost_per_market: 36.61
  pnl_per_market:      +10.95
  up_trades:           139
  down_trades:         38

*** TOTAL PNL: +1938.00 ***
```

The confidence filter skipped 68 of a possible 176 entries. The bot only took 108 trades and still finished with zero max drawdown. That's the filter doing exactly what it's supposed to: fewer, cleaner positions instead of noise.

### What People Are Saying

> *"Let it paper trade for about a week, then turned on real size. Two and a half weeks in and I'm up around 17%. Config was easier than I expected."*
>
> @basin_eth, Discord

> *"What I like is it isn't dumb copy trading. The confidence gate cuts out a ton of junk signals. I would have clicked into a few of those by hand."*
>
> @vee_pm, Telegram

> *"Forked the repo, dropped my keys in .env, skimmed the README, hit run. Whole thing was maybe fifteen minutes."*
>
> @northern_lights_bot, Telegram

Running it live? Open a PR and add your results to the table.

---

## Getting Started

Free. Open source. MIT-friendly ISC license. Fork it, modify it, run it.

Before you jump in, a few honest notes:

```
1. Follow the setup steps below
2. Choose the wallets you want to copy and the markets you want to cover
3. Fund it properly. A starting budget above $3,000-4,000 gives you room
   to size positions meaningfully. Smaller accounts feel every bump hard.
```

### Install and Run

```bash
git clone https://github.com/harmandhaliwal/polymarket-trading-bot-copytrading.git
cd polymarket-trading-bot-copytrading
npm install
cp .env.example .env
# fill in PRIVATE_KEY, RPC_URL, and COPYTRADE_MARKETS
npm start
```

Requirements: **Node.js 18+** (or Bun), a **Polygon wallet** with USDC, and an **RPC URL**.

---

## Configuration

The bot ships with defaults that work. But defaults are a starting point, not a ceiling. Here is every setting you can tune.

<details>
<summary><strong>Full Configuration Reference</strong></summary>

| Group | Key | What it does |
|---|---|---|
| Market Selection | `COPYTRADE_MARKETS` | Comma-separated market slugs. Each one becomes an actively watched market. Crypto, politics, sports, anything Polymarket lists. |
| Execution | `PRIVATE_KEY` | Signs every order via `ethers.Wallet` in `src/utils/createClobClient.ts`. Keep this in `.env` and nowhere else. |
| Execution | `CLOB_API_URL` | Base URL for `ClobClient` order book reads and order submissions. |
| Execution | `RPC_URL` / `RPC_TOKEN` | Polygon RPC for USDC and CTF approvals, and for resolution checks at redemption. |
| Execution | `CHAIN_ID` | Chain ID at boot. Use 137 for Polygon mainnet. |
| Position Sizing | `COPYTRADE_SHARES` | Shares placed per side per trade. Your main size control. |
| Position Sizing | `COPYTRADE_MAX_BUY_COUNTS_PER_SIDE` | Max buys per side within a single market. Set to 0 to remove the cap entirely. |
| Precision | `COPYTRADE_TICK_SIZE` | Tick precision for order pricing. Must match the market's tick or orders get rejected. |
| Risk | `COPYTRADE_PRICE_BUFFER` | Price buffer at execution to handle drift between signal and fill. |
| Risk | `BOT_MIN_USDC_BALANCE` | Minimum USDC balance before execution starts. Bot will not trade below this floor. |
| Timing | `COPYTRADE_WAIT_FOR_NEXT_MARKET_START` | Hold until next market open before the first cycle. Good for clean entries. |
| Logging | `LOG_DIR` / `LOG_FILE_PREFIX` | Where logs go and what they're called. Every trade attempt is recorded. |

</details>

---

## About Your Keys

Your private key never leaves your machine. It is loaded from `.env`, turned into a local `ethers.Wallet`, and used to sign orders locally. Only the signed payload is sent to Polymarket's CLOB API. No telemetry, no third-party storage, nothing external.

Use a **dedicated wallet** funded just for this bot. Keep `PRIVATE_KEY` in `.env` and never commit it. If the key may have been exposed, generate a new wallet and move funds.

Start with a few hundred to a couple thousand USDC. Watch it run for a few days, then scale up by adding USDC and increasing `COPYTRADE_SHARES`. Spot something wrong in the signing code? Open an issue.

---

## Claiming Winnings

When a market resolves in your favor, collect it:

```bash
# Redeem everything from your holdings file
npm run redeem:holdings

# Redeem a specific condition ID
npm run redeem

# Check a condition before redeeming
bun src/redeem.ts --check <conditionId>
```

---

## Development

```bash
# Type check without running
npx tsc --noEmit

# Run with hot reload
bun --watch src/index.ts
```

---

## Risk Disclosure

Prediction markets involve real financial risk. You can lose money. There is no guarantee this bot will be profitable. Past backtest results do not guarantee future performance.

Only allocate capital you can afford to lose entirely. Understand each config setting before going live. This software is provided as-is with no warranty.

---

## One Last Thing

Right now, a wallet is entering a position on Polymarket that you would have missed.

Not because you're not smart enough. Because you weren't watching, or weren't fast enough, or you second-guessed yourself one too many times.

That's what this bot is for.

**Fork it. Configure it. Fund it. Let it work.**

And if it earns its keep, a star on the repo means a lot.

---

## License

ISC
