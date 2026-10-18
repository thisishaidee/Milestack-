"use client";

import { useState } from "react";
import type { Project } from "@/types/project";
import type { Milestone } from "@/types/milestone";

interface ProjectFormProps {
  onCreate: (project: Project) => void;
}

interface FormErrors {
  name?: string;
  totalBudget?: string;
  clientWallet?: string;
  milestoneCount?: string;
}

export default function ProjectForm({
  onCreate,
}: ProjectFormProps) {
  const [name, setName] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [clientWallet, setClientWallet] = useState("");
  const [milestoneCount, setMilestoneCount] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!name.trim()) {
      nextErrors.name = "Project name is required.";
    }

    const budget = Number(totalBudget);

    if (!totalBudget.trim()) {
      nextErrors.totalBudget = "Total budget is required.";
    } else if (Number.isNaN(budget) || budget <= 0) {
      nextErrors.totalBudget =
        "Total budget must be greater than 0.";
    }

    if (!clientWallet.trim()) {
      nextErrors.clientWallet = "Client wallet is required.";
    }

    const milestones = Number(milestoneCount);

    if (!milestoneCount.trim()) {
      nextErrors.milestoneCount =
        "Number of milestones is required.";
    } else if (
      !Number.isInteger(milestones) ||
      milestones <= 0 ||
      milestones > 20
    ) {
      nextErrors.milestoneCount =
        "Number of milestones must be between 1 and 20.";
    }

    return nextErrors;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const placeholderMilestones: Milestone[] = Array.from(
      { length: Number(milestoneCount) },
      () => ({
        id: crypto.randomUUID(),
        title: "",
        amount: 0,
        contributorWallet: "",
        status: "pending",
      })
    );

    const project: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      totalBudget: Number(totalBudget),
      clientWallet: clientWallet.trim(),
      milestones: placeholderMilestones,
      vaultBalance: 0,
      releasedBalance: 0,
      createdAt: new Date().toISOString(),
    };

    onCreate(project);

    setName("");
    setTotalBudget("");
    setClientWallet("");
    setMilestoneCount("");
    setErrors({});
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl space-y-6"
    >
      <div>
        <label
          htmlFor="name"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Project Name
        </label>

        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Website Redesign"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-blue-500"
        />

        {errors.name && (
          <p className="mt-2 text-sm text-red-400">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="totalBudget"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Total Budget
        </label>

        <input
          id="totalBudget"
          type="number"
          value={totalBudget}
          onChange={(e) => setTotalBudget(e.target.value)}
          placeholder="5000"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-blue-500"
        />

        {errors.totalBudget && (
          <p className="mt-2 text-sm text-red-400">
            {errors.totalBudget}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="clientWallet"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Client Wallet
        </label>

        <input
          id="clientWallet"
          type="text"
          value={clientWallet}
          onChange={(e) => setClientWallet(e.target.value)}
          placeholder="ST..."
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-blue-500"
        />

        {errors.clientWallet && (
          <p className="mt-2 text-sm text-red-400">
            {errors.clientWallet}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="milestoneCount"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Number of Milestones
        </label>

        <input
          id="milestoneCount"
          type="number"
          value={milestoneCount}
          onChange={(e) => setMilestoneCount(e.target.value)}
          placeholder="3"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-blue-500"
        />

        {errors.milestoneCount && (
          <p className="mt-2 text-sm text-red-400">
            {errors.milestoneCount}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-blue-600 py-3 text-base font-semibold transition hover:bg-blue-500"
      >
        Create Project
      </button>
    </form>
  );
}
