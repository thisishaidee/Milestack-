"use client";

import { useState } from "react";
import {
  cancelRemaining,
  EscrowError,
  messageForEscrowError,
  type TxPhase,
} from "@/lib/escrow";
import { useWalletAddress } from "@/lib/stacks";

interface CancelRemainingButtonProps {
  onChainId: number;
  clientAddress: string;
  remainingLabel: string;
  disabled?: boolean;
  onCancelled: (txid: string) => void;
}

function labelForPhase(phase: TxPhase): string {
  switch (phase) {
    case "waiting-wallet":
      return "Waiting for wallet…";
    case "submitted":
      return "Transaction submitted…";
    case "confirming":
      return "Confirming on-chain…";
    case "confirmed":
      return "Refunded remaining funds";
    default:
      return "Refund remaining unpaid funds";
  }
}

export default function CancelRemainingButton({
  onChainId,
  clientAddress,
  remainingLabel,
  disabled,
  onCancelled,
}: CancelRemainingButtonProps) {
  const walletAddress = useWalletAddress();
  const [phase, setPhase] = useState<TxPhase>("ready");
  const [txid, setTxid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "waiting-wallet" || phase === "submitted" || phase === "confirming";
  const isClient = Boolean(walletAddress) && walletAddress === clientAddress.trim();

  async function handleClick() {
    const confirmed = window.confirm(
      `Refund the remaining unpaid balance (${remainingLabel} USDCx) to the client? Paid milestones stay paid.`
    );
    if (!confirmed) return;

    setError(null);
    setTxid(null);
    try {
      const result = await cancelRemaining(onChainId, (next, detail) => {
        setPhase(next);
        if (detail && (next === "submitted" || next === "confirming" || next === "confirmed")) {
          setTxid(detail);
        }
      });
      setTxid(result.txid);
      setPhase("confirmed");
      onCancelled(result.txid);
    } catch (err) {
      setPhase("failed");
      setError(err instanceof EscrowError ? err.message : messageForEscrowError(err));
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || busy || phase === "confirmed" || !isClient}
        className="w-full rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {labelForPhase(phase)}
      </button>
      <p className="text-xs text-white/45">
        This refunds the project remaining balance. It does not claw back paid milestones.
      </p>
      {!isClient && (
        <p className="text-xs text-yellow-400">
          Connect the project client wallet to refund remaining funds.
        </p>
      )}
      {txid && (
        <p className="break-all text-xs text-white/50">Tx: {txid}</p>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
