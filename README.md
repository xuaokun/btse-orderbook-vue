# BTSE Order Book

A real-time BTCPFC order book built with Vue 3 and TypeScript. The application
maintains a synchronized local order book from BTSE snapshot and incremental
WebSocket messages, while displaying the best eight buy and sell levels.

## Live Demo

[View the deployed application on Vercel](https://btse-orderbook-vue.vercel.app/)

## Features

- Maintains the complete 50-level snapshot locally
- Applies incremental order book updates in sequence
- Re-subscribes for a new snapshot when a sequence gap is detected
- Recovers from a crossed order book without reconnecting the WebSocket
- Classifies OSS protocol errors to avoid unnecessary retry loops
- Surfaces loading, reconnection, re-synchronization, and terminal error states
- Displays the best eight buy and sell quotes
- Calculates cumulative quote totals and depth percentages
- Formats numeric values with thousands separators
- Shows last-price direction with up, down, and unchanged styles
- Highlights newly added price levels
- Highlights quote size increases and decreases
- Reconnects closed WebSockets with exponential backoff
- Supports responsive layouts down to a 320 px minimum width

## Tech Stack

- Vue 3
- TypeScript
- Vite
- Vitest
- Less
- Font Awesome

## Requirements

- Node.js 24
- npm

If you use nvm:

```bash
nvm use 24
```

## Getting Started

```bash
npm install
npm run dev
```

Vite will print the local development URL in the terminal.

## Tests

Run the unit test suite:

```bash
npm test
```

The tests cover:

- Snapshot replacement
- Delta additions, updates, and deletions
- Sequence validation
- Crossed order book detection
- Re-subscription and reconnect behavior
- Retryable and non-retryable OSS protocol errors
- User-facing order book status selection
- Visible quote selection and cumulative totals
- Last-price parsing and direction
- Quote animation detection, revisions, and cleanup
- Number formatting

## Production Build

```bash
npm run build
npm run preview
```

## WebSocket APIs

### Order Book

- Endpoint: `wss://ws.btse.com/ws/oss/futures`
- Topic: `update:BTCPFC`
- Documentation:
  [Orderbook incremental updates](https://btsecom.github.io/docs/futures/en/#orderbook-incremental-updates)

The first order book message is a 50-level snapshot. Later messages are
incremental deltas.

For every delta:

1. Verify that `prevSeqNum` matches the last accepted `seqNum`.
2. Apply the delta to a candidate copy of the local order book.
3. Reject the candidate if the best bid is greater than or equal to the best
   ask.
4. Commit the candidate atomically only after all validation succeeds.

If sequence validation fails or the candidate is crossed, the application
unsubscribes and re-subscribes on the existing open socket to request a new
snapshot. A full WebSocket reconnect is used only when in-place
re-subscription is unavailable or the connection closes.

### Last Price

- Endpoint: `wss://ws.btse.com/ws/futures`
- Topic: `tradeHistoryApi:BTCPFC`
- Documentation:
  [Public trade fills](https://btsecom.github.io/docs/futures/en/#public-trade-fills)

The first trade in each message is used as the current last price and compared
with the previous last price to determine its direction.

## Order Book Calculations

The full local order book is sorted before selecting the visible levels:

- Sell quotes: select the eight lowest prices, accumulate size from lowest to
  highest, then reverse the rows for display.
- Buy quotes: select the eight highest prices and accumulate size from highest
  to lowest.

Each side calculates its depth percentage independently:

```text
current visible cumulative size / total visible size of the same side
```

The percentage bar is rendered inside the Total column.

## Highlight Rules

- A price not present before the accepted delta flashes across the full row.
  Buy rows flash green and sell rows flash red.
- An existing quote whose size increases flashes green in the Size cell.
- An existing quote whose size decreases flashes red in the Size cell.
- Deleted quotes and snapshot initialization do not animate.

Animation events use a monotonically increasing revision so consecutive
updates to the same price can restart the CSS animation. Animation state is
cleared during disconnection, re-synchronization, and snapshot recovery.

## Project Structure

```text
src/
├── components/    # Order book UI
├── composables/   # Order book, last-price, and animation state
├── domain/        # Pure order book and calculation rules
├── services/      # WebSocket adapters and message validation
└── types/         # Shared TypeScript models
```
