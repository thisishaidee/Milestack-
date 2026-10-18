# MileStack

Milestone-based programmable escrow on Stacks.

MileStack lets a client fund a project once. The `milestack-escrow` contract holds USDCx, stores each milestone contributor and amount, and pays that stored contributor when the client approves. Unpaid remaining funds can be refunded to the client.

FlowVault is not the MileStack escrow layer.

## Product flow

1. Connect a Stacks Testnet wallet.
2. Create a project and define milestones (amount + contributor wallet).
3. Fund once with `create-and-fund` — USDCx moves into `milestack-escrow`.
4. Mark a milestone completed in the UI, then approve it.
5. `approve-and-pay` sends the stored amount to the stored contributor.
6. Optionally `cancel-remaining` refunds unpaid funds to the client.

The contract is the source of truth for balances, contributors, amounts, and status. localStorage only keeps draft metadata (name, titles, local UUID, on-chain project id).

## Deployed testnet contract

- Escrow: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.milestack-escrow`
- Token: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx`
- Asset: `usdcx-token` (`ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx::usdcx-token`)
- Decimals: 6

Deploy tx: `0x006aa7ae3cb2c4326e01ebe91285fb0f44bad8090f1efff1e18f7fbbcb5e8a0d`

## Getting Testnet USDCx

There is no Stacks faucet that mints USDCx. Obtain it by bridging Circle testnet USDC from Ethereum Sepolia through Circle xReserve.

Official docs: https://docs.stacks.co/more-guides/bridging-usdcx  
Official bridge UI: https://bridge.stacks.co  
Contracts: https://docs.stacks.co/learn/bridging/usdcx/contracts

For the 30 + 40 + 30 demo you need **at least 100 USDCx**, plus a little extra if you want a buffer. Testnet peg-in minimum is **1 USDC**.

### 1. Get testnet STX (fees)

Stacks transactions need Testnet STX. USDCx transfers do not pay the network fee.

- Hiro Platform faucet: https://platform.hiro.so/faucet
- Explorer sandbox: https://explorer.hiro.so/sandbox/faucet?chain=testnet

Switch Leather / Xverse to **Stacks Testnet** first. Addresses start with `ST`.

### 2. Get Sepolia ETH and Circle testnet USDC

1. Create or use an Ethereum wallet on **Sepolia**.
2. Get Sepolia ETH for gas: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
3. Get testnet USDC from Circle: https://faucet.circle.com/  
   Choose **Ethereum Sepolia** and the same EVM address.

Sepolia USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

### 3. Bridge USDC → Stacks Testnet USDCx

Preferred: [bridge.stacks.co](https://bridge.stacks.co)

1. Connect the Sepolia wallet (USDC side) and the Stacks Testnet wallet (USDCx destination).
2. From: USDC on Ethereum (use the testnet/Sepolia path the widget exposes).
3. To: USDCx on Stacks.
4. Destination must be your MileStack client address (`ST...`).
5. Bridge at least 100 USDC if you want the full 30/40/30 fund in one shot.
6. Wait ~15 minutes. Stacks attestation mints USDCx into the Stacks wallet.

xReserve (Sepolia): `0x008888878f94C0d87defdf0B07f46B93C1934442`

Do not use a mock token. Do not use mainnet USDCx (`SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx`).

### 4. Verify the USDCx balance

Hiro API (replace `ST...` with your client address):

```bash
curl -sS "https://api.testnet.hiro.so/extended/v1/address/ST.../balances"
```

Look for:

`ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx::usdcx-token`

Balance is in base units. `100000000` = 100 USDCx.

Explorer:

- Address page, Testnet: https://explorer.hiro.so/?chain=testnet
- Token: https://explorer.hiro.so/token/ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx?chain=testnet

Confirm the wallet you connect in MileStack is the same `ST...` that received the mint.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`:

```
NEXT_PUBLIC_STACKS_NETWORK=testnet
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
NEXT_PUBLIC_ESCROW_CONTRACT_NAME=milestack-escrow
```

## End-to-end acceptance test

Client creates:

- M1 = 30 USDCx → Contributor 1
- M2 = 40 USDCx → Contributor 2
- M3 = 30 USDCx → Contributor 3

Client funds once: 100 USDCx → `milestack-escrow`

Then:

- Approve M1 → Contributor 1 receives 30, remaining = 70
- Approve M2 → Contributor 2 receives 40, remaining = 30
- Cancel remaining → client receives 30, M3 = CANCELLED, M1/M2 stay PAID

## Stack

- Next.js App Router + TypeScript + Tailwind CSS
- `@stacks/connect` for wallet auth and signed calls
- MileStack `milestack-escrow` Clarity contract on Stacks Testnet
- Real USDCx (`usdcx-token`), not a mock

## License

MIT

Built by Haidee
