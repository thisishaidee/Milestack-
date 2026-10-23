"use client";

import { request } from "@stacks/connect";
import {
  Cl,
  Pc,
  fetchCallReadOnlyFunction,
  cvToJSON,
} from "@stacks/transactions";
import { getUserAddress } from "@/lib/stacks";
import {
  STACKS_NETWORK,
  STACKS_API_URL,
  USDCX_TOKEN_CONTRACT_ADDRESS,
  USDCX_TOKEN_CONTRACT_NAME,
  USDCX_TOKEN_ASSET_NAME,
  ESCROW_CONTRACT_ADDRESS,
  ESCROW_CONTRACT_NAME,
  ESCROW_ERRORS,
  TESTNET_ADDRESS_PREFIX,
  MAX_MILESTONES,
} from "@/lib/constants";
import { toBaseUnits, fromBaseUnits } from "@/lib/units";
import type { Project } from "@/types/project";
import type { Milestone, OnChainMilestoneStatus } from "@/types/milestone";

export class EscrowError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
    public code?: number
  ) {
    super(message);
    this.name = "EscrowError";
  }
}

export type TxPhase =
  | "ready"
  | "waiting-wallet"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed";


/**
 * Next usable nonce for `address`, accounting for the mempool.
 *
 * Primary: Hiro /extended/v1/address/{addr}/nonces -> possible_next_nonce.
 * Fallback (endpoint missing or erroring): /v2/accounts confirmed nonce plus the
 * count of this address's pending mempool transactions, so a pending tx is never
 * ignored even if the extended endpoint is unavailable.
 */
export async function getNextNonce(address: string): Promise<number> {
  const addr = encodeURIComponent(address);
  try {
    const res = await fetch(`${STACKS_API_URL}/extended/v1/address/${addr}/nonces`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { possible_next_nonce?: number | string };
      const nonce = Number(data.possible_next_nonce);
      if (Number.isInteger(nonce) && nonce >= 0) return nonce;
    }
  } catch {
    // fall through to the confirmed-nonce fallback
  }

  const [accountRes, mempoolRes] = await Promise.all([
    fetch(`${STACKS_API_URL}/v2/accounts/${addr}?proof=0`, { cache: "no-store" }),
    fetch(`${STACKS_API_URL}/extended/v1/address/${addr}/mempool?limit=1`, {
      cache: "no-store",
    }),
  ]);
  if (!accountRes.ok) {
    throw new EscrowError(`Failed to fetch nonce for ${address} (${accountRes.status}).`);
  }
  const account = (await accountRes.json()) as { nonce?: number | string };
  const confirmed = Number(account.nonce);
  if (!Number.isInteger(confirmed) || confirmed < 0) {
    throw new EscrowError("The node returned an invalid nonce.");
  }
  let pending = 0;
  if (mempoolRes.ok) {
    const mempool = (await mempoolRes.json()) as { total?: number };
    pending = Number.isInteger(mempool.total) ? Number(mempool.total) : 0;
  }
  return confirmed + pending;
}

export interface OnChainProject {
  id: number;
  client: string;
  token: string;
  total: bigint;
  remaining: bigint;
  milestoneCount: number;
  cancelled: boolean;
  createdAtBlock: number;
}

export interface OnChainMilestone {
  index: number;
  contributor: string;
  amount: bigint;
  status: OnChainMilestoneStatus;
}

const STATUS_BY_CODE: Record<number, OnChainMilestoneStatus> = {
  0: "pending",
  1: "paid",
  2: "cancelled",
};

function requireEscrowContract(): { address: string; name: string; id: `${string}.${string}` } {
  if (!ESCROW_CONTRACT_ADDRESS) {
    throw new EscrowError(
      "MileStack escrow is not configured. Set NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS after deploying milestack-escrow."
    );
  }
  return {
    address: ESCROW_CONTRACT_ADDRESS,
    name: ESCROW_CONTRACT_NAME,
    id: `${ESCROW_CONTRACT_ADDRESS}.${ESCROW_CONTRACT_NAME}`,
  };
}

function requireConnectedAddress(): string {
  const address = getUserAddress();
  if (!address) {
    throw new EscrowError(
      "Connect a Stacks Testnet wallet before using escrow."
    );
  }
  return address;
}

async function assertCallerIsProjectClient(
  onChainId: number,
  sender: string
): Promise<OnChainProject> {
  const project = await getOnChainProject(onChainId);
  if (!project) {
    throw new EscrowError(ESCROW_ERRORS[2106], undefined, 2106);
  }
  if (project.client !== sender) {
    throw new EscrowError(ESCROW_ERRORS[2107], undefined, 2107);
  }
  return project;
}

export function isTestnetPrincipal(address: string): boolean {
  return address.trim().startsWith(TESTNET_ADDRESS_PREFIX) && address.length > 3;
}

function tokenPrincipalCv() {
  return Cl.contractPrincipal(
    USDCX_TOKEN_CONTRACT_ADDRESS,
    USDCX_TOKEN_CONTRACT_NAME
  );
}

function tokenAssetId(): `${string}.${string}` {
  return `${USDCX_TOKEN_CONTRACT_ADDRESS}.${USDCX_TOKEN_CONTRACT_NAME}`;
}

function tokenPostCondition(sender: string, amount: bigint) {
  return Pc.principal(sender).willSendEq(amount).ft(tokenAssetId(), USDCX_TOKEN_ASSET_NAME);
}

function jsonValue(cv: unknown): any {
  return cvToJSON(cv as never);
}

function unwrapOk(json: any): any {
  if (json?.success === false) {
    const code = Number(json?.value?.value ?? json?.value);
    throw new EscrowError(
      ESCROW_ERRORS[code] ?? `Escrow call failed (${code || "unknown"}).`,
      undefined,
      Number.isFinite(code) ? code : undefined
    );
  }
  return json?.value ?? json;
}

function readUint(field: any): bigint {
  const raw = field?.value ?? field;
  if (raw && typeof raw === "object" && raw.value != null) {
    return BigInt(raw.value);
  }
  return BigInt(raw ?? 0);
}

function readPrincipal(field: any): string {
  if (field == null) return "";
  if (typeof field === "string") return field;
  const raw = field.value ?? field;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const address = raw.address ?? raw.value;
    if (typeof address === "string" && raw.contractName) {
      return `${address}.${raw.contractName}`;
    }
    if (typeof address === "string") return address;
  }
  return String(raw ?? "");
}

function readBool(field: any): boolean {
  if (typeof field === "boolean") return field;
  if (typeof field?.value === "boolean") return field.value;
  return false;
}

function unwrapOptionalTuple(json: any): any | null {
  if (!json || json.type === "none" || json.value === null || json.value === undefined) {
    return null;
  }
  const inner = json.type === "some" ? json.value : json.value ?? json;
  const tuple = inner?.type === "tuple" ? inner.value : inner?.value ?? inner;
  if (!tuple || typeof tuple !== "object") return null;
  return tuple;
}

let cachedDecimals: number | null = null;

export async function getUsdcxDecimals(): Promise<number> {
  if (cachedDecimals !== null) return cachedDecimals;

  const sender = getUserAddress() ?? USDCX_TOKEN_CONTRACT_ADDRESS;
  const result = await fetchCallReadOnlyFunction({
    contractAddress: USDCX_TOKEN_CONTRACT_ADDRESS,
    contractName: USDCX_TOKEN_CONTRACT_NAME,
    functionName: "get-decimals",
    functionArgs: [],
    network: STACKS_NETWORK,
    senderAddress: sender,
  });

  const json = jsonValue(result);
  const inner = json?.value?.value ?? json?.value ?? json;
  const decimals = Number(inner);
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new EscrowError("Could not read USDCx decimals from the token contract.");
  }
  cachedDecimals = decimals;
  return decimals;
}

export async function getNextId(): Promise<number> {
  const escrow = requireEscrowContract();
  const sender = getUserAddress() ?? escrow.address;
  const result = await fetchCallReadOnlyFunction({
    contractAddress: escrow.address,
    contractName: escrow.name,
    functionName: "get-next-id",
    functionArgs: [],
    network: STACKS_NETWORK,
    senderAddress: sender,
  });
  const json = jsonValue(result);
  const value = json?.type === "uint" ? json.value : json?.value ?? json;
  return Number(typeof value === "object" ? value.value ?? value : value);
}

export async function getOnChainProject(id: number): Promise<OnChainProject | null> {
  const escrow = requireEscrowContract();
  const sender = getUserAddress() ?? escrow.address;
  const result = await fetchCallReadOnlyFunction({
    contractAddress: escrow.address,
    contractName: escrow.name,
    functionName: "get-project",
    functionArgs: [Cl.uint(id)],
    network: STACKS_NETWORK,
    senderAddress: sender,
  });

  const json = jsonValue(result);
  const tuple = unwrapOptionalTuple(json);
  if (!tuple || tuple.client === undefined) return null;

  return {
    id,
    client: readPrincipal(tuple.client),
    token: readPrincipal(tuple.token),
    total: readUint(tuple.total),
    remaining: readUint(tuple.remaining),
    milestoneCount: Number(readUint(tuple["milestone-count"])),
    cancelled: readBool(tuple.cancelled),
    createdAtBlock: Number(readUint(tuple["created-at-block"])),
  };
}

export async function getOnChainMilestone(
  id: number,
  index: number
): Promise<OnChainMilestone | null> {
  const escrow = requireEscrowContract();
  const sender = getUserAddress() ?? escrow.address;
  const result = await fetchCallReadOnlyFunction({
    contractAddress: escrow.address,
    contractName: escrow.name,
    functionName: "get-milestone",
    functionArgs: [Cl.uint(id), Cl.uint(index)],
    network: STACKS_NETWORK,
    senderAddress: sender,
  });

  const json = jsonValue(result);
  const tuple = unwrapOptionalTuple(json);
  if (!tuple || tuple.contributor === undefined) return null;

  const statusCode = Number(readUint(tuple.status));
  return {
    index,
    contributor: readPrincipal(tuple.contributor),
    amount: readUint(tuple.amount),
    status: STATUS_BY_CODE[statusCode] ?? "pending",
  };
}

export async function getOnChainMilestones(
  id: number,
  count: number
): Promise<OnChainMilestone[]> {
  const rows: OnChainMilestone[] = [];
  for (let i = 0; i < count; i++) {
    const row = await getOnChainMilestone(id, i);
    if (row) rows.push(row);
  }
  return rows;
}

async function waitForTx(txid: string): Promise<{ status: string; repr?: string }> {
  const url = `${STACKS_API_URL}/extended/v1/tx/${txid}`;
  const started = Date.now();
  const timeoutMs = 180_000;

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const status = String(data?.tx_status ?? "");
        if (status === "success") {
          return { status, repr: data?.tx_result?.repr };
        }
        if (status.startsWith("abort") || status === "rejected") {
          const repr = String(data?.tx_result?.repr ?? "");
          const match = repr.match(/u(\d+)/);
          const code = match ? Number(match[1]) : undefined;
          throw new EscrowError(
            (code !== undefined && ESCROW_ERRORS[code]) ||
              "The escrow transaction was rejected on-chain.",
            data,
            code
          );
        }
      }
    } catch (error) {
      if (error instanceof EscrowError) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new EscrowError(
    "Timed out waiting for the transaction to confirm. Check the explorer and refresh."
  );
}

function parseOkUint(repr?: string): number | null {
  if (!repr) return null;
  const match = repr.match(/\(ok u(\d+)\)/i);
  return match ? Number(match[1]) : null;
}

function validateDraft(project: Project) {
  if (project.milestones.length === 0) {
    throw new EscrowError(ESCROW_ERRORS[2101]);
  }
  if (project.milestones.length > MAX_MILESTONES) {
    throw new EscrowError(`A project can have at most ${MAX_MILESTONES} milestones.`);
  }
  for (const milestone of project.milestones) {
    if (!(Number(milestone.amount) > 0)) {
      throw new EscrowError(ESCROW_ERRORS[2102]);
    }
    if (!isTestnetPrincipal(milestone.contributorWallet)) {
      throw new EscrowError(
        "Every contributor wallet must be a Stacks Testnet address starting with ST."
      );
    }
  }
}

export async function createAndFund(
  project: Project,
  onPhase?: (phase: TxPhase, detail?: string) => void
): Promise<{ onChainId: number; txid: string }> {
  const escrow = requireEscrowContract();
  const sender = requireConnectedAddress();
  validateDraft(project);

  const client = project.clientWallet.trim();
  if (sender !== client) {
    throw new EscrowError(
      "The connected wallet must be the project client to fund escrow."
    );
  }

  for (const milestone of project.milestones) {
    if (milestone.contributorWallet.trim() === client) {
      throw new EscrowError(ESCROW_ERRORS[2103]);
    }
  }

  const decimals = await getUsdcxDecimals();
  const entries = project.milestones.map((milestone) => ({
    contributor: milestone.contributorWallet.trim(),
    amount: toBaseUnits(milestone.amount, decimals),
  }));
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0n);

  onPhase?.("waiting-wallet");
  const expectedId = await getNextId();

  const functionArgs = [
    tokenPrincipalCv(),
    Cl.list(
      entries.map((entry) =>
        Cl.tuple({
          contributor: Cl.principal(entry.contributor),
          amount: Cl.uint(entry.amount),
        })
      )
    ),
  ];

  const postConditions = [tokenPostCondition(sender, total)];
  const nonce = await getNextNonce(sender);

  let txid: string;
  try {
    const response = await request("stx_callContract", {
      contract: escrow.id,
      functionName: "create-and-fund",
      functionArgs,
      network: STACKS_NETWORK,
      postConditions,
      postConditionMode: "deny",
      nonce,
    });
    txid = (response as { txid?: string })?.txid ?? "";
  } catch (error) {
    if (error instanceof EscrowError) throw error;
    throw new EscrowError("Wallet rejected or failed to submit the funding transaction.", error);
  }

  if (!txid) {
    throw new EscrowError("The wallet did not return a transaction id.");
  }

  onPhase?.("submitted", txid);
  onPhase?.("confirming", txid);
  const confirmed = await waitForTx(txid);

  const parsedId = parseOkUint(confirmed.repr);
  const onChainId = parsedId ?? expectedId;
  const onChain = await getOnChainProject(onChainId);
  if (!onChain || onChain.client !== sender) {
    throw new EscrowError(
      "Funding confirmed, but the on-chain project id could not be verified. Refresh and check the explorer."
    );
  }

  onPhase?.("confirmed", txid);
  return { onChainId, txid };
}

export async function approveAndPay(
  onChainId: number,
  index: number,
  onPhase?: (phase: TxPhase, detail?: string) => void
): Promise<{ txid: string }> {
  const escrow = requireEscrowContract();
  const sender = requireConnectedAddress();
  await assertCallerIsProjectClient(onChainId, sender);

  const milestone = await getOnChainMilestone(onChainId, index);
  if (!milestone) {
    throw new EscrowError(ESCROW_ERRORS[2106], undefined, 2106);
  }
  if (milestone.status !== "pending") {
    throw new EscrowError(ESCROW_ERRORS[2110], undefined, 2110);
  }

  onPhase?.("waiting-wallet");

  const postConditions = [tokenPostCondition(escrow.id, milestone.amount)];
  const nonce = await getNextNonce(sender);

  let txid: string;
  try {
    const response = await request("stx_callContract", {
      contract: escrow.id,
      functionName: "approve-and-pay",
      functionArgs: [Cl.uint(onChainId), Cl.uint(index), tokenPrincipalCv()],
      network: STACKS_NETWORK,
      postConditions,
      postConditionMode: "deny",
      nonce,
    });
    txid = (response as { txid?: string })?.txid ?? "";
  } catch (error) {
    if (error instanceof EscrowError) throw error;
    throw new EscrowError("Wallet rejected or failed to submit the payout transaction.", error);
  }

  if (!txid) {
    throw new EscrowError("The wallet did not return a transaction id.");
  }

  onPhase?.("submitted", txid);
  onPhase?.("confirming", txid);
  await waitForTx(txid);
  onPhase?.("confirmed", txid);
  return { txid };
}

export async function cancelRemaining(
  onChainId: number,
  onPhase?: (phase: TxPhase, detail?: string) => void
): Promise<{ txid: string }> {
  const escrow = requireEscrowContract();
  const sender = requireConnectedAddress();
  const project = await assertCallerIsProjectClient(onChainId, sender);
  if (project.cancelled) {
    throw new EscrowError(ESCROW_ERRORS[2108], undefined, 2108);
  }

  onPhase?.("waiting-wallet");

  const postConditions =
    project.remaining > 0n ? [tokenPostCondition(escrow.id, project.remaining)] : [];
  const nonce = await getNextNonce(sender);

  let txid: string;
  try {
    const response = await request("stx_callContract", {
      contract: escrow.id,
      functionName: "cancel-remaining",
      functionArgs: [Cl.uint(onChainId), tokenPrincipalCv()],
      network: STACKS_NETWORK,
      postConditions,
      postConditionMode: "deny",
      nonce,
    });
    txid = (response as { txid?: string })?.txid ?? "";
  } catch (error) {
    if (error instanceof EscrowError) throw error;
    throw new EscrowError("Wallet rejected or failed to submit the refund transaction.", error);
  }

  if (!txid) {
    throw new EscrowError("The wallet did not return a transaction id.");
  }

  onPhase?.("submitted", txid);
  onPhase?.("confirming", txid);
  await waitForTx(txid);
  onPhase?.("confirmed", txid);
  return { txid };
}

export function mergeChainIntoProject(
  local: Project,
  chain: OnChainProject,
  chainMilestones: OnChainMilestone[],
  decimals: number
): Project {
  const milestones: Milestone[] = local.milestones.map((localMilestone, index) => {
    const chainRow = chainMilestones.find((row) => row.index === index);
    if (!chainRow) {
      return { ...localMilestone, onChainIndex: index };
    }

    const chainStatus =
      chainRow.status === "paid"
        ? "paid"
        : chainRow.status === "cancelled"
        ? "cancelled"
        : localMilestone.status === "completed"
        ? "completed"
        : "pending";

    return {
      ...localMilestone,
      onChainIndex: index,
      contributorWallet: chainRow.contributor,
      amount: Number(fromBaseUnits(chainRow.amount, decimals)),
      status: chainStatus,
    };
  });

  return {
    ...local,
    onChainId: chain.id,
    clientWallet: chain.client,
    totalBudget: Number(fromBaseUnits(chain.total, decimals)),
    cancelled: chain.cancelled,
    milestones,
  };
}

export function messageForEscrowError(error: unknown): string {
  if (error instanceof EscrowError) return error.message;
  return "Something went wrong talking to the MileStack escrow contract.";
}
