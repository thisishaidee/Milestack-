"use client";

import { request } from "@stacks/connect";
import {
  Cl,
  Pc,
  fetchCallReadOnlyFunction,
  cvToJSON,
  postConditionToHex,
} from "@stacks/transactions";
import { getUserAddress, isTestnetAddress } from "@/lib/stacks";
import {
  STACKS_NETWORK,
  STACKS_API_URL,
  USDCX_TOKEN_CONTRACT_ADDRESS,
  USDCX_TOKEN_CONTRACT_NAME,
  USDCX_TOKEN_ASSET_NAME,
  ESCROW_CONTRACT_ADDRESS,
  ESCROW_CONTRACT_NAME,
  ESCROW_ERRORS,
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
  return isTestnetAddress(address);
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

// Xverse expects serialized post-conditions (hex strings), not SDK Pc objects.
// Keep the same explicit transfer limits while making the wallet payload compatible.
function tokenPostCondition(sender: string, amount: bigint): string {
  return postConditionToHex(
    Pc.principal(sender).willSendEq(amount).ft(tokenAssetId(), USDCX_TOKEN_ASSET_NAME)
  );
}

function jsonValue(cv: unknown): any {
  return cvToJSON(cv as never);
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

export async function getClientProjectCount(client: string): Promise<number> {
  const escrow = requireEscrowContract();
  const result = await fetchCallReadOnlyFunction({
    contractAddress: escrow.address,
    contractName: escrow.name,
    functionName: "get-client-project-count",
    functionArgs: [Cl.principal(client)],
    network: STACKS_NETWORK,
    senderAddress: client,
  });
  return Number(readUint(jsonValue(result)));
}

export async function getClientProjectIds(
  client: string,
  startIndex = 0,
  limit = 20
): Promise<{ total: number; ids: number[] }> {
  if (!Number.isInteger(startIndex) || startIndex < 0) {
    throw new EscrowError("Project recovery start index must be a non-negative integer.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new EscrowError("Project recovery page size must be between 1 and 20.");
  }

  const total = await getClientProjectCount(client);
  const end = Math.min(total, startIndex + limit);
  const ids: number[] = [];

  for (let index = startIndex; index < end; index += 5) {
    const batchEnd = Math.min(end, index + 5);
    const batch = await Promise.all(
      Array.from({ length: batchEnd - index }, async (_, offset) => {
        const escrow = requireEscrowContract();
        const result = await fetchCallReadOnlyFunction({
          contractAddress: escrow.address,
          contractName: escrow.name,
          functionName: "get-client-project-id",
          functionArgs: [Cl.principal(client), Cl.uint(index + offset)],
          network: STACKS_NETWORK,
          senderAddress: client,
        });
        const json = jsonValue(result);
        if (!json || json.type === "none") return null;
        const inner = json.type === "some" ? json.value : json;
        const id = Number(readUint(inner));
        return Number.isSafeInteger(id) && id > 0 ? id : null;
      })
    );
    ids.push(...batch.filter((id): id is number => id !== null));
  }

  return { total, ids };
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
  const batchSize = 5;

  // Read in small parallel batches. A fully sequential loop makes a
  // 20-milestone project wait on 20 separate RPC round trips, while
  // launching all 20 at once can trigger provider rate limits.
  for (let start = 0; start < count; start += batchSize) {
    const end = Math.min(start + batchSize, count);
    const batch = await Promise.all(
      Array.from({ length: end - start }, (_, offset) =>
        getOnChainMilestone(id, start + offset)
      )
    );
    rows.push(...batch.filter((row): row is OnChainMilestone => row !== null));
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

  let budget: bigint;
  try {
    budget = toBaseUnits(project.totalBudget, decimals);
  } catch {
    throw new EscrowError("The project budget must be a valid USDCx amount with no more than 6 decimal places.");
  }
  if (total !== budget) {
    throw new EscrowError("Milestone amounts must add up exactly to the project budget before funding.");
  }

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

  let txid: string;
  try {
    const response = await request("stx_callContract", {
      contract: escrow.id,
      functionName: "create-and-fund",
      functionArgs,
      network: STACKS_NETWORK,
      postConditions,
      postConditionMode: "deny",
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

  let txid: string;
  try {
    const response = await request("stx_callContract", {
      contract: escrow.id,
      functionName: "approve-and-pay",
      functionArgs: [Cl.uint(onChainId), Cl.uint(index), tokenPrincipalCv()],
      network: STACKS_NETWORK,
      postConditions,
      postConditionMode: "deny",
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

  let txid: string;
  try {
    const response = await request("stx_callContract", {
      contract: escrow.id,
      functionName: "cancel-remaining",
      functionArgs: [Cl.uint(onChainId), tokenPrincipalCv()],
      network: STACKS_NETWORK,
      postConditions,
      postConditionMode: "deny",
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
  const milestones: Milestone[] = Array.from(
    { length: chain.milestoneCount },
    (_, index) => {
      const localMilestone =
        local.milestones.find((milestone, localIndex) =>
          (milestone.onChainIndex ?? localIndex) === index
        ) ?? {
          id: `chain-${chain.id}-${index}`,
          title: `Milestone ${index + 1}`,
          amount: 0,
          contributorWallet: "",
          status: "pending" as const,
        };
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
    }
  );

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
  const detail =
    error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
  console.error("[escrow] read/write failed:", error);
  if (error instanceof Error && error.stack) console.error(error.stack);
  return `Escrow read failed: ${detail || "unknown error"}`;
}
