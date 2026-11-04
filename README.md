# MileStack

MileStack is a milestone-based escrow app being rebuilt for Stacks Testnet.

## Fresh rebuild status

This branch is isolated from `main`. It does not reuse the previous FlowVault integration or the previous escrow deployment.

- Network: Stacks Testnet
- Wallet: Xverse through Stacks Connect
- Network fee asset: testnet STX
- Escrow asset: USDCx
- USDCx contract: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx`
- USDCx asset name: `usdcx-token`
- Token precision: 6 decimals, to be confirmed against the live token contract during integration.

**The fresh MileStack escrow contract has not been deployed.** Do not configure the app with the old contract address. The contract address must remain unset until the new contract compiles, passes tests, and is deployed and verified on Testnet.

## Intended workflow

1. Connect a Stacks Testnet wallet.
2. Create a project and define contributor addresses and milestone amounts.
3. Review and sign one USDCx funding transaction.
4. Approve completed milestones to pay their stored contributors.
5. Refund only the unpaid remainder when cancelling a project.

The Clarity contract is intended to be the source of truth for escrow balances, recipients, amounts, and milestone status. Local storage is for draft and display metadata only.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Keep `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS` empty until the fresh contract has been deployed and verified.

## Required verification before deployment

- Clarinet project check and contract tests.
- TypeScript typecheck and production build.
- Wallet connect and disconnect on Stacks Testnet.
- Funding with the exact USDCx amount.
- Correct one-time milestone payout to each stored contributor.
- Unauthorized payout and refund rejection.
- Refund of only the unpaid remainder.
- Read state again after refresh and compare it with chain state.

## Security notes

- Do not use mainnet wallets or assets for this test flow.
- Never enter a seed phrase or private key into MileStack.
- Transactions must be explicitly approved in the connected wallet.
- A submitted transaction is not a confirmed transaction.
- Existing deployed contracts and any assets held by them are outside this rebuild and are not changed by this branch.
