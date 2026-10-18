"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getOnChainMilestones,
  getOnChainProject,
  getUsdcxDecimals,
  messageForEscrowError,
  type OnChainProject,
} from "@/lib/escrow";
import { formatDisplayAmount } from "@/lib/units";
import { ESCROW_CONTRACT_ADDRESS } from "@/lib/constants";

interface VaultStatusProps {
  onChainId?: number;
}

export default function VaultStatus({ onChainId }: VaultStatusProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<OnChainProject | null>(null);
  const [paid, setPaid] = useState<bigint>(0n);
  const [decimals, setDecimals] = useState(6);

  const refresh = useCallback(async () => {
    if (typeof onChainId !== "number") {
      setProject(null);
      return;
    }
    if (!ESCROW_CONTRACT_ADDRESS) {
      setError("Escrow contract address is not configured.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const dec = await getUsdcxDecimals();
      setDecimals(dec);
      const chain = await getOnChainProject(onChainId);
      if (!chain) {
        setProject(null);
        setError("No on-chain escrow project found for this id.");
        return;
      }
      const rows = await getOnChainMilestones(onChainId, chain.milestoneCount);
      const paidSum = rows
        .filter((row) => row.status === "paid")
        .reduce((sum, row) => sum + row.amount, 0n);
      setPaid(paidSum);
      setProject(chain);
    } catch (err) {
      setError(messageForEscrowError(err));
    } finally {
      setLoading(false);
    }
  }, [onChainId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (typeof onChainId !== "number") {
    return (
      <p className="text-sm text-white/50">
        Fund this project to see on-chain escrow balances.
      </p>
    );
  }

  const cards = project
    ? [
        { label: "Total funded", value: formatDisplayAmount(project.total, decimals) },
        { label: "Remaining", value: formatDisplayAmount(project.remaining, decimals) },
        { label: "Paid out", value: formatDisplayAmount(paid, decimals) },
        { label: "Status", value: project.cancelled ? "Cancelled" : "Active" },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-white/80">Escrow status</h2>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/5 disabled:opacity-40"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      {project && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-lg border border-white/10 bg-vault-panel p-4">
              <p className="text-xs text-white/50">{card.label}</p>
              <p className="mt-1 text-xl font-semibold">{card.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
