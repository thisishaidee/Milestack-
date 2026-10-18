export const STACKS_NETWORK = "testnet" as const;

export const TESTNET_ADDRESS_PREFIX = "ST";

export const USDCX_TOKEN_CONTRACT_ADDRESS =
  "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
export const USDCX_TOKEN_CONTRACT_NAME = "usdcx";
/** SIP-010 fungible asset name inside the USDCx contract (`define-fungible-token`). */
export const USDCX_TOKEN_ASSET_NAME = "usdcx-token";

export const STACKS_API_URL = "https://api.testnet.hiro.so";

/**
 * MileStack escrow contract (Stacks Testnet).
 * Address is required via env after deploy. Empty means writes are disabled.
 */
export const ESCROW_CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ?? ""
).trim();
export const ESCROW_CONTRACT_NAME = (
  process.env.NEXT_PUBLIC_ESCROW_CONTRACT_NAME ?? "milestack-escrow"
).trim();

export const MAX_MILESTONES = 20;

export const ESCROW_ERRORS: Record<number, string> = {
  2101: "Add at least one milestone before funding.",
  2102: "Every milestone amount must be greater than zero.",
  2103: "A contributor wallet cannot be the same as the client wallet.",
  2104: "The USDCx transfer failed. Check the token balance and try again.",
  2106: "That project or milestone was not found on-chain.",
  2107: "Only the project client can do this.",
  2108: "This project has already been cancelled.",
  2109: "Wrong token. MileStack escrow only accepts the configured USDCx.",
  2110: "This milestone is not pending, so it cannot be paid.",
  2111: "The escrow does not have enough remaining funds for this payout.",
};


/** Leftover FlowVault identifiers. Not used by the MileStack escrow path. */
export const FLOWVAULT_CONTRACT_ADDRESS =
  "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD";
export const FLOWVAULT_CONTRACT_NAME = "flowvault-v2";
