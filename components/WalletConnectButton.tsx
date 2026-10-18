"use client";

import { useState } from "react";
import {
  connectWallet,
  disconnectWallet,
  useWalletAddress,
  StacksConnectError,
} from "@/lib/stacks";

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

export default function WalletConnectButton() {
  const address = useWalletAddress();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setIsConnecting(true);
    setError(null);

    try {
      await connectWallet();
    } catch (err) {
      const message =
        err instanceof StacksConnectError
          ? err.message
          : "Something went wrong connecting your wallet.";
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  }

  function handleDisconnect() {
    disconnectWallet();
    setError(null);
  }

  if (address) {
    return (
      <div className="flex items-center gap-3">
        <span className="rounded-md border border-white/10 bg-vault-panel px-3 py-1.5 text-sm text-white/80">
          {truncateAddress(address)}
        </span>
        <button
          onClick={handleDisconnect}
          className="rounded-md border border-white/20 px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/5"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="rounded-md bg-vault-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
