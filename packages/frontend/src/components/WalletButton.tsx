/**
 * @file WalletButton.tsx
 * @description Freighter wallet connect/disconnect button component.
 *
 * Displays one of three states:
 *  1. "Install Freighter" — when the extension is not detected.
 *  2. "Connect Wallet"   — when Freighter is installed but not connected.
 *  3. Truncated address  — when connected (click to disconnect).
 */

"use client";

import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Truncate a Stellar public key to G...XXXX format for display. */
function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * WalletButton — renders the appropriate CTA based on Freighter state.
 *
 * @example
 * <WalletButton />
 */
export function WalletButton() {
  const { isInitialized, isInstalled, isConnected, publicKey, isLoading, connect, disconnect, error } =
    useUnifiedWallet();

  // Show a neutral placeholder while we detect Freighter.
  if (!isInitialized) {
    return (
      <div className="h-10 w-40 animate-pulse rounded-lg bg-stellar-purple/20" />
    );
  }

  // Freighter not installed → link to extension store.
  if (!isInstalled) {
    return (
      <a
        href="https://freighter.app"
        target="_blank"
        rel="noopener noreferrer"
        id="install-freighter-btn"
        className="group flex items-center gap-2 rounded-lg border border-stellar-purple/40 bg-stellar-purple/10 px-4 py-2 text-sm font-medium text-stellar-purple transition-all duration-200 hover:border-stellar-purple/80 hover:bg-stellar-purple/20"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 shadow-[0_0_6px_2px_rgba(250,204,21,0.4)]" />
        Install Freighter
      </a>
    );
  }

  // Connected state.
  if (isConnected && publicKey) {
    return (
      <div className="flex items-center gap-3">
        {/* Address badge */}
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.4)]" />
          <span className="font-mono text-sm text-green-300">
            {truncateAddress(publicKey)}
          </span>
        </div>
        {/* Disconnect */}
        <button
          id="disconnect-wallet-btn"
          onClick={disconnect}
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 transition-all duration-200 hover:border-red-500/60 hover:bg-red-500/20"
          aria-label="Disconnect wallet"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Connect prompt.
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        id="connect-wallet-btn"
        onClick={() => void connect()}
        disabled={isLoading}
        className="relative flex items-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-stellar-purple to-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-stellar-purple/25 transition-all duration-200 hover:shadow-stellar-purple/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Connect Freighter wallet"
      >
        {isLoading ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Connecting...
          </>
        ) : (
          <>
            <WalletIcon />
            Connect Wallet
          </>
        )}
      </button>
      {error && (
        <p className="max-w-xs text-right text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

function WalletIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 12h5v4h-5a2 2 0 010-4z" />
    </svg>
  );
}
