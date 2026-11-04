# MileStack Fresh Stacks Testnet Rebuild

## Scope

This branch is a clean rebuild of the MileStack application and escrow flow. The existing `main` branch, live deployment, and previously deployed contracts are not changed by this work.

The old FlowVault integration is not part of the new architecture. Existing on-chain assets and contract state are not deleted or assumed recoverable through the new app.

## Network and assets

- Network: Stacks Testnet.
- Wallet: Xverse through Stacks Connect.
- Fee asset: testnet STX.
- Escrow asset: Circle USDCx on Stacks Testnet.
- USDCx contract: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx`.
- Token asset name: `usdcx-token`.
- Token precision: 6 decimals; validate from the deployed token contract rather than assuming it in transaction logic.

## New product flow

1. Connect a Stacks Testnet wallet.
2. Create a project draft and define milestones, each with a contributor Stacks Testnet principal and positive USDCx amount.
3. Review and explicitly sign one funding transaction.
4. The new escrow contract records the client, token, milestone recipients and amounts, and total funded balance.
5. The client approves a completed milestone; the contract transfers the stored amount to its stored recipient.
6. The client may refund only the unpaid balance. Paid milestones remain paid.
7. The UI reads contract state as the source of truth. Local storage may hold draft/display metadata only.

## Security and correctness invariants

- Only the recorded client can approve milestones or cancel/refund a project.
- The contract must reject zero amounts, invalid milestone counts, duplicate/invalid state transitions, and insufficient funding.
- A milestone can be paid at most once.
- Refunds cannot withdraw amounts already paid or exceed the remaining balance.
- Token transfers use the exact USDCx contract and asset identifier.
- No private key, seed phrase, or wallet secret is stored by MileStack.
- All wallet transactions are user-approved through Xverse.
- A submitted transaction is not treated as successful until the Stacks API confirms success.
- Any contract deployment address is unset until a fresh contract is deployed and verified on Testnet.

## Acceptance tests

- Wallet connect and disconnect work on mobile.
- Project creation validates all milestone recipients and amounts before requesting a wallet signature.
- Funding transfers the exact total to the escrow contract and persists the on-chain project ID.
- Each approved milestone pays the correct contributor and exact amount once.
- Unauthorized payout and refund attempts fail.
- Refund returns only the unpaid remainder and does not change paid milestone records.
- UI refresh reconstructs balances and milestone statuses from contract reads.
- Error, pending, rejected, and confirmed transaction states are clearly distinguished.
- Typecheck, lint, contract tests, and production build pass before review.

## Rebuild sequence

1. Replace the old application surface with a minimal clean Stacks Testnet app shell.
2. Implement and test the new Clarity escrow contract independently.
3. Integrate Xverse wallet connection and read-only contract state.
4. Add funding, milestone payout, and refund transactions.
5. Run the complete Testnet acceptance flow before requesting review or deployment.

## Explicitly out of scope

- FlowVault SDK or FlowVault routing.
- Mainnet deployment or mainnet funds.
- Automatic migration of old contract state.
- Any claim that deleting application code removes or recovers on-chain assets.
