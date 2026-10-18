export type OnChainMilestoneStatus = "pending" | "paid" | "cancelled";

export type MilestoneStatus =
  | "pending"
  | "completed"
  | "paid"
  | "released"
  | "cancelled";

export interface Milestone {
  id: string;
  title: string;
  amount: number;
  contributorWallet: string;
  status: MilestoneStatus;
  onChainIndex?: number;
  payoutTxid?: string;
}
