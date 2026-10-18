import type { Milestone } from "@/types/milestone";

export interface Project {
  id: string;
  name: string;
  totalBudget: number;
  clientWallet: string;
  milestones: Milestone[];
  createdAt: string;
  onChainId?: number;
  depositTxid?: string;
  cancelTxid?: string;
  cancelled?: boolean;
  vaultBalance?: number;
  releasedBalance?: number;
}
