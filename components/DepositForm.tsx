"use client";

import { useState } from "react";
import type { Project } from "@/types/project";
import { useWalletAddress } from "@/lib/stacks";
import {
  createAndFund,
  EscrowError,
  isTestnetPrincipal,
  messageForEscrowError,
  type TxPhase,
} from "@/lib/escrow";
import { ESCROW_CONTRACT_ADDRESS, MAX_MILESTONES } from "@/lib/constants";

interface DepositFormProps {
  project: Project;
  onFunded: (payload: { onChainId: number; txid: string }) => void;
}

function validateMilestones(project: Project): string | null {
  if (project.milestones.length === 0) {
    return "This project has no milestones to fund.";
  }
  if (project.milestones.length > MAX_MILESTONES) {
    return `A project can have at most ${MAX_MILESTONES} milestones.`;
  }

  for (const milestone of project.milestones) {
    if (!milestone.title.trim()) {
      return "Every milestone needs a title before funding.";
    }
    if (!(Number(milestone.amount) > 0)) {
      return "Every milestone amount must be greater than 0.";
    }
    if (!isTestnetPrincipal(milestone.contributorWallet)) {
      return "Every contributor wallet must be a Stacks Testnet address starting with ST.";
    }
    if (milestone.contributorWallet.trim() === project.clientWallet.trim()) {
      return "A contributor wallet cannot be the same as the client wallet.";
    }
  }

  const sum = project.milestones.reduce(
    (total, milestone) => total + (Number(milestone.amount) || 0),
    0
  );
  if (sum !== project.totalBudget) {
    return `Milestone amounts total ${sum.toLocaleString()}, which does not match the project budget of ${project.totalBudget.toLocaleString()}.`;
  }

  return null;
}

function labelForPhase(phase: TxPhase, alreadyFunded: boolean): string {
  if (alreadyFunded) return "Funded on-chain";
  switch (phase) {
    case "waiting-wallet":
      return "Waiting for wallet…";
    case "submitted":
      return "Submitted…";
    case "confirming":
      return "Confirming on-chain…";
    case "confirmed":
      return "Escrow funded";
    default:
      return "Fund MileStack escrow";
  }
}

export default function DepositForm({ project, onFunded }: DepositFormProps) {
  const walletAddress = useWalletAddress();
  const [phase, setPhase] = useState<TxPhase>("ready");
  const [txid, setTxid] = useState<string | null>(project.depositTxid ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const milestonesError = validateMilestones(project);
  const alreadyFunded = typeof project.onChainId === "number";
  const walletMismatch =
    Boolean(walletAddress) && walletAddress !== project.clientWallet.trim();
  const busy = phase === "waiting-wallet" || phase === "submitted" || phase === "confirming";
  const isDisabled =
    alreadyFunded ||
    busy ||
    !walletAddress ||
    Boolean(milestonesError) ||
    walletMismatch ||
    !ESCROW_CONTRACT_ADDRESS;

  async function handleDeposit() {
    if (alreadyFunded) return;

    setErrorMessage(null);
    setTxid(null);

    try {
      const result = await createAndFund(project, (next, detail) => {
        setPhase(next);
        if (detail && next !== "waiting-wallet") setTxid(detail);
      });
      setTxid(result.txid);
      setPhase("confirmed");
      onFunded(result);
    } catch (error) {
      setPhase("failed");
      setErrorMessage(
        error instanceof EscrowError ? error.message : messageForEscrowError(error)
      );
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-vault-panel p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/60">Total to escrow</span>
        <span className="text-lg font-semibold">
          {project.totalBudget.toLocaleString()} USDCx
        </span>
      </div>

      <p className="text-xs text-white/50">
        Funding deposits the full milestone schedule into the MileStack escrow
        contract once. The contract stores each contributor and amount.
      </p>

      <button
        type="button"
        onClick={handleDeposit}
        disabled={isDisabled}
        className="w-full rounded-md bg-vault-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {labelForPhase(phase, alreadyFunded)}
      </button>

      {!ESCROW_CONTRACT_ADDRESS && (
        <p className="text-xs text-yellow-400">
          Set NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS after deploying milestack-escrow.
        </p>
      )}

      {!walletAddress && (
        <p className="text-xs text-white/50">
          Connect the client Testnet wallet to fund escrow.
        </p>
      )}

      {walletMismatch && (
        <p className="text-xs text-yellow-400">
          Connected wallet does not match the project client.
        </p>
      )}

      {walletAddress && milestonesError && (
        <p className="text-xs text-yellow-400">{milestonesError}</p>
      )}

      {txid && <p className="break-all text-xs text-white/50">Tx: {txid}</p>}

      {alreadyFunded && (
        <p className="text-xs text-emerald-300">
          On-chain project #{project.onChainId}
        </p>
      )}

      {errorMessage && (
        <div className="rounded-md border border-red-400/20 bg-red-400/10 p-3">
          <p className="text-xs text-red-300">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
