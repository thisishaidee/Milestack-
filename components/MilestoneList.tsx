"use client";

import { useEffect, useMemo, useState } from "react";
import type { Project } from "@/types/project";
import type { Milestone } from "@/types/milestone";
import MilestoneItem, { type MilestoneFieldErrors } from "@/components/MilestoneItem";

interface MilestoneListProps {
  project: Project;
  onUpdate: (project: Project) => void;
  onRefreshChain?: () => Promise<void>;
}

type ErrorMap = Record<string, MilestoneFieldErrors>;

export default function MilestoneList({ project, onUpdate, onRefreshChain }: MilestoneListProps) {
  const [milestones, setMilestones] = useState<Milestone[]>(project.milestones);
  const [fieldErrors, setFieldErrors] = useState<ErrorMap>({});
  const [totalError, setTotalError] = useState<string | undefined>();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setMilestones(project.milestones);
  }, [project.milestones]);

  const funded = typeof project.onChainId === "number";
  const runningTotal = useMemo(
    () => milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0),
    [milestones]
  );
  const remaining = project.totalBudget - runningTotal;

  function handleMilestoneChange(id: string, updates: Partial<Milestone>) {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates, id: m.id } : m))
    );
    setSavedAt(null);
  }

  async function handlePaid(milestoneId: string, txHash: string) {
    const next = milestones.map((m) =>
      m.id === milestoneId ? { ...m, status: "paid" as const, payoutTxid: txHash } : m
    );
    setMilestones(next);
    onUpdate({ ...project, milestones: next });
    await onRefreshChain?.();
  }

  function validate(): boolean {
    const nextFieldErrors: ErrorMap = {};
    milestones.forEach((m) => {
      const errors: MilestoneFieldErrors = {};
      if (!m.title.trim()) errors.title = "Title is required.";
      if (!(Number(m.amount) > 0)) errors.amount = "Amount must be greater than 0.";
      if (!m.contributorWallet.trim()) errors.contributorWallet = "Contributor wallet is required.";
      if (Object.keys(errors).length > 0) nextFieldErrors[m.id] = errors;
    });
    setFieldErrors(nextFieldErrors);
    const sum = milestones.reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const sumMatches = sum === project.totalBudget;
    setTotalError(
      sumMatches
        ? undefined
        : `Milestone amounts total ${sum.toLocaleString()}, but the project budget is ${project.totalBudget.toLocaleString()}.`
    );
    return Object.keys(nextFieldErrors).length === 0 && sumMatches;
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (funded) return;
    if (!validate()) {
      setSavedAt(null);
      return;
    }
    onUpdate({ ...project, milestones });
    setSavedAt(Date.now());
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-3">
        {milestones.map((milestone, index) => (
          <MilestoneItem
            key={milestone.id}
            milestone={milestone}
            index={index}
            errors={fieldErrors[milestone.id]}
            locked={funded}
            funded={funded}
            onChainId={project.onChainId}
            clientAddress={project.clientWallet}
            onChange={handleMilestoneChange}
            onPaid={handlePaid}
          />
        ))}
      </div>

      <div className="rounded-lg border border-white/10 bg-vault-panel p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Running total</span>
          <span className="font-medium">{runningTotal.toLocaleString()}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-white/60">Project budget</span>
          <span className="font-medium">{project.totalBudget.toLocaleString()}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-white/60">Remaining to allocate</span>
          <span className={`font-medium ${remaining === 0 ? "text-emerald-400" : remaining < 0 ? "text-red-400" : "text-white"}`}>
            {remaining.toLocaleString()}
          </span>
        </div>
        {totalError && <p className="mt-3 text-xs text-red-400">{totalError}</p>}
      </div>

      {!funded && (
        <button
          type="submit"
          className="w-full rounded-md bg-vault-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Save Milestones
        </button>
      )}

      {savedAt && (
        <p className="text-center text-xs text-emerald-400">Milestones saved locally. Fund escrow to freeze them on-chain.</p>
      )}
    </form>
  );
}
