// Wrapper around @stacks/connect for wallet auth (Stacks Testnet only).
//
// @stacks/connect's modern API (connect / disconnect / isConnected /
// getLocalStorage) replaces the older UserSession/AppConfig flow. There is
// no separate "session object" to hold onto — the connected wallet's
// addresses are cached in local storage and read back out via
// getLocalStorage(). We wrap that here behind a small, typed, MileStack-
// specific session shape so the rest of the app doesn't depend on the
// @stacks/connect API surface directly.

"use client";

import { useEffect, useState } from "react";
import {
  connect,
  disconnect,
  isConnected,
  getLocalStorage,
} from "@stacks/connect";
import { TESTNET_ADDRESS_PREFIX } from "@/lib/constants";

type WalletListener = (address: string | null) => void;
const walletListeners = new Set<WalletListener>();

function emitWalletChange(address: string | null) {
  walletListeners.forEach((listener) => listener(address));
}

/**
 * Minimal "user session" MileStack cares about: the connected
 * Stacks Testnet address (and, if available, the linked BTC address).
 */
export interface StacksUserSession {
  stxAddress: string;
  btcAddress?: string;
}

/** Thrown for any wallet connection / network failure. */
export class StacksConnectError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "StacksConnectError";
  }
}

/**
 * Reads the current wallet session out of @stacks/connect's local storage
 * cache. Returns null if no wallet is connected yet.
 */
function readSession(): StacksUserSession | null {
  const data = getLocalStorage();
  const stxAddress = data?.addresses?.stx?.[0]?.address;

  if (!stxAddress) {
    return null;
  }

  const btcAddress = data?.addresses?.btc?.[0]?.address;

  return { stxAddress, btcAddress };
}

function isTestnetAddress(address: string): boolean {
  return address.startsWith(TESTNET_ADDRESS_PREFIX);
}

/**
 * Opens the wallet connection modal, then returns the resulting user
 * session. Enforces Testnet-only usage: if the connected wallet returns a
 * mainnet address, the session is torn down and an error is thrown.
 */
export async function connectWallet(): Promise<StacksUserSession> {
  try {
    await connect();
  } catch (error) {
    throw new StacksConnectError(
      "Wallet connection was cancelled or failed. Please try again.",
      error
    );
  }

  const session = readSession();

  if (!session) {
    throw new StacksConnectError(
      "Wallet connected, but no Stacks address was returned."
    );
  }

  if (!isTestnetAddress(session.stxAddress)) {
    disconnectWallet();
    throw new StacksConnectError(
      "MileStack only supports Stacks Testnet. Switch your wallet to Testnet and reconnect."
    );
  }

  emitWalletChange(session.stxAddress);
  return session;
}

/**
 * Returns the currently connected Testnet STX address, or null if no
 * wallet is connected. Never throws — connection-state checks should be
 * safe to call from render paths.
 */
export function getUserAddress(): string | null {
  try {
    if (!isConnected()) {
      return null;
    }

    return readSession()?.stxAddress ?? null;
  } catch (error) {
    console.error("[stacks] Failed to read connected address:", error);
    return null;
  }
}

/**
 * Clears the local wallet session. Safe to call even if no wallet is
 * currently connected.
 */
export function disconnectWallet(): void {
  try {
    disconnect();
  } catch (error) {
    console.error("[stacks] Failed to disconnect wallet:", error);
  }
  emitWalletChange(null);
}

export function subscribeWallet(listener: WalletListener): () => void {
  walletListeners.add(listener);
  return () => {
    walletListeners.delete(listener);
  };
}

/** Current connected Testnet address; updates on connect, disconnect, or switch. */
export function useWalletAddress(): string | null {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = getUserAddress();
      setAddress((prev) => (prev === next ? prev : next));
    };

    sync();
    const unsubscribe = subscribeWallet(sync);
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    const timer = window.setInterval(sync, 1500);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
      window.clearInterval(timer);
    };
  }, []);

  return address;
}
