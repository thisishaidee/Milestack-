"use client";

import { useState } from "react";
import type { Milestone } from "@/types/milestone";
import {
  approveAndPay,
  EscrowError,
  messageForEscrowError,
  type TxPhase,
} from "@/lib/escrow";
import { useWalletAddress } from "@/lib/stacks";

interface ReleasePayoutButtonProps {
  milestone: Milestone;
  onChainId?: number;
  clientAddress?: string;
  funded: boolean;
  onPaid: (txid: string) => void;
}

type ReleaseStatus = TxPhase;

function label(status: ReleaseStatus, milestone: Milestone): string {
  if (milestone.status === "paid" || milestone.status === "released") return "Paid";
  if (milestone.status === "cancelled") return "Cancelled";
  switch (status) {
    case "waiting-wallet":
      return "Waiting for wallet…";
    case "submitted":
      return "Submitted…";
    case "confirming":
      return "Confirming…";
    case "confirmed":
      return "Paid";
    default:
      return "Approve & pay";
  }
}

export default function ReleasePayoutButton({
  milestone,
  onChainId,
  clientAddress,
  funded,
  onPaid,
}: ReleasePayoutButtonProps) {
  const walletAddress = useWalletAddress();
  const [status, setStatus] = useState<ReleaseStatus>("ready");
  const [txHash, setTxHash] = useState<string | null>(milestone.payoutTxid ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const alreadyPaid = milestone.status === "paid" || milestone.status === "released";
  const cancelled = milestone.status === "cancelled";
  const isCompleted = milestone.status === "completed" || alreadyPaid;
  const index = milestone.onChainIndex;
  const busy = status === "waiting-wallet" || status === "submitted" || status === "confirming";
  const isClient =
    Boolean(walletAddress) &&
    Boolean(clientAddress) &&
    walletAddress === clientAddress.trim();
  const isDisabled =
    !funded ||
    typeof onChainId !== "number" ||
    typeof index !== "number" ||
    !isCompleted ||
    alreadyPaid ||
    cancelled ||
    busy ||
    !isClient;

  async function handleRelease() {
    if (typeof onChainId !== "number" || typeof index !== "number") return;

    setErrorMessage(null);
    setTxHash(null);

    try {
      const result = await approveAndPay(onChainId, index, (next, detail) => {
        setStatus(next);
        if (detail) setTxHash(detail);
      });
      setTxHash(result.txid);
      setStatus("confirmed");
      onPaid(result.txid);
    } catch (error) {
      setStatus("failed");
      setErrorMessage(
        error instanceof EscrowError ? error.message : messageForEscrowError(error)
      );
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleRelease}
        disabled={isDisabled}
        className="rounded-md bg-vault-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {label(status, milestone)}
      </button>

      {!funded && (
        <p className="text-[11px] text-white/40">Fund escrow before paying a milestone.</p>
      )}

      {funded && !isClient && !alreadyPaid && !cancelled && (
        <p className="text-[11px] text-white/40">
          Connect the project client wallet to approve payout.
        </p>
      )}

      {funded && isClient && !isCompleted && !alreadyPaid && !cancelled && (
        <p className="text-[11px] text-white/40">
          Mark this milestone completed to approve payout.
        </p>
      )}

      {txHash && <p className="max-w-xs break-all text-[11px] text-white/50">Tx: {txHash}</p>}

      {status === "error" || errorMessage ? (
        <div className="max-w-xs rounded-md border border-red-400/20 bg-red-400/10 px-2 py-1 text-right">
          <p className="text-[11px] text-red-300">{errorMessage}</p>
        </div>
      ) : null}
    </div>
  );
}
