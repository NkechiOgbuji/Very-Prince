/**
 * @file PayoutCard.tsx
 * @description Card component displaying a maintainer's claimable balance
 * and a button to trigger the `claim_payout` contract function via Freighter.
 *
 * This component is intentionally read-focused — the actual claim invocation
 * is a planned contribution milestone (see CONTRIBUTING.md). The scaffold
 * demonstrates the data flow pattern without requiring a funded account.
 */

"use client";

import { useState } from "react";
import type { MaintainerBalance } from "@/lib/contractTypes";

// ── Props ───────────────────────────────────────────────────────────────────

interface PayoutCardProps {
  balance: MaintainerBalance;
  /** Called when the user confirms a claim. Receives the maintainer address. */
  onClaim?: (address: string) => Promise<void>;
  /** True while a claim transaction is in flight. */
  isClaiming?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * PayoutCard — displays a single maintainer's claimable balance.
 *
 * @example
 * <PayoutCard
 *   balance={{ address: "G...", stroops: 5000000n, xlm: "0.5000000" }}
 *   onClaim={handleClaim}
 * />
 */
export function PayoutCard({
  balance,
  onClaim,
  isClaiming = false,
}: PayoutCardProps) {
  const hasBalance = balance.stroops > BigInt(0);
  const [claimed, setClaimed] = useState(false);

  const handleClaim = async () => {
    if (!onClaim || !hasBalance) return;
    await onClaim(balance.address);
    setClaimed(true);
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        balance.isPending 
          ? "border-stellar-purple/50 bg-stellar-purple/5 animate-pulse" 
          : "border-white/[0.08] bg-white/[0.04] hover:border-stellar-purple/30 hover:bg-white/[0.06]"
      } p-6 backdrop-blur-sm`}
      role="article"
      aria-label={`Payout card for ${balance.address}${balance.isPending ? " (Pending)" : ""}`}
    >
      {/* Subtle gradient glow on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-stellar-purple/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-white/40">
            Maintainer
          </p>
          <p className="mt-1 break-all font-mono text-sm text-white/80">
            {balance.address}
          </p>
        </div>
        {/* Status badge */}
        {balance.isPending ? (
          <span className="shrink-0 rounded-full border border-stellar-purple/30 bg-stellar-purple/10 px-2 py-0.5 text-xs font-medium text-stellar-purple">
            Pending...
          </span>
        ) : hasBalance ? (
          <span className="shrink-0 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
            Claimable
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-white/30">
            No balance
          </span>
        )}
      </div>

      {/* Balance display */}
      <div className="mb-6 rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <p className="text-xs font-medium text-white/40">Claimable Balance</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-white">
            {balance.xlm}
          </span>
          <span className="text-sm font-medium text-stellar-teal">XLM</span>
        </div>
        <p className="mt-1 font-mono text-xs text-white/30">
          {balance.stroops.toString()} stroops
        </p>
      </div>

      {/* Claim button */}
      {claimed ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2.5">
          <CheckIcon />
          <span className="text-sm font-medium text-green-400">Claim submitted!</span>
        </div>
      ) : (
        <button
          id={`claim-btn-${balance.address.slice(-6)}`}
          onClick={() => void handleClaim()}
          disabled={!hasBalance || isClaiming || !onClaim}
          className="w-full rounded-lg bg-gradient-to-r from-stellar-purple to-stellar-teal px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-stellar-purple/20 transition-all duration-200 hover:brightness-110 hover:shadow-stellar-purple/35 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          aria-label={`Claim ${balance.xlm} XLM`}
        >
          {isClaiming ? "Submitting..." : "Claim Payout"}
        </button>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
