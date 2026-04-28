/**
 * @file FundOrgModal.tsx
 * @description Modal allowing users to fund an organization's budget.
 *
 * On mount the modal checks the connected wallet's native XLM balance via
 * Horizon and passes the result to <FaucetBanner> so the appropriate helper
 * guidance is shown without cluttering the happy-path UI.
 *
 * Transaction flow (fully client-side — no backend involvement):
 *   1. buildFundOrgTransaction  → produces unsigned XDR
 *   2. Freighter.signTransaction → user approves in the extension
 *   3. submitSignedTransaction  → broadcasts to Soroban RPC & polls ledger
 */

"use client";

import { useEffect, useState } from "react";
import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";
import {
  buildFundOrgTransaction,
  submitSignedTransaction,
  readAccountXlmBalance,
} from "@/lib/sorobanClient";
import { FaucetBanner, type BalanceStatus } from "@/components/FaucetBanner";
import { GlassPanel } from "@/components/GlassPanel";

// ── Props ─────────────────────────────────────────────────────────────────────

interface FundOrgModalProps {
  orgId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FundOrgModal({ orgId, onClose, onSuccess }: FundOrgModalProps) {
  const { isConnected, publicKey, signTransaction } = useUnifiedWallet();

  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Balance detection for the smart FaucetBanner
  const [balanceStatus, setBalanceStatus] = useState<BalanceStatus>("loading");

  // ── Detect wallet balance on mount ────────────────────────────────────────
  useEffect(() => {
    if (!publicKey) {
      // No wallet connected — skip the check; the submit button already guards this.
      setBalanceStatus("sufficient");
      return;
    }

    let cancelled = false;

    readAccountXlmBalance(publicKey).then((balance) => {
      if (cancelled) return;
      if (balance === null) {
        setBalanceStatus("unfunded");  // Horizon 404 — account never activated
      } else if (balance === 0) {
        setBalanceStatus("empty");     // Account exists but has no XLM
      } else {
        setBalanceStatus("sufficient");
      }
    });

    return () => { cancelled = true; };
  }, [publicKey]);

  // ── Submit handler ────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !publicKey) {
      setError("Please connect Freighter first.");
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const stroops = BigInt(Math.floor(numAmount * 10_000_000));

      // Step 1 — build & simulate the unsigned transaction XDR
      const unsignedXdr = await buildFundOrgTransaction(orgId, publicKey, stroops);

      // Step 2 — ask Freighter to sign it (user approves in the extension popup)
      const signedXdr = await signTransaction(unsignedXdr);

      // Step 3 — broadcast to Soroban RPC and wait for ledger confirmation
      await submitSignedTransaction(signedXdr);

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Funding failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fund-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-stellar-blue/80 p-4 backdrop-blur-md"
      // Allow clicking the backdrop to close (unless a tx is in flight)
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose(); }}
    >
      <GlassPanel className="relative w-full max-w-md overflow-hidden p-8 shadow-2xl backdrop-blur-xl border-white/10 bg-white/5">
        {/* Background glow orbs */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-stellar-purple/20 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-stellar-teal/20 blur-[80px]" />

        <div className="relative">
          {/* ── Header ── */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2
                id="fund-modal-title"
                className="text-2xl font-bold tracking-tight text-white"
              >
                Fund Organization
              </h2>
              <p className="mt-1 text-sm text-white/50">
                Deposit XLM into{" "}
                <span className="font-mono text-stellar-purple">{orgId}</span>
                &apos;s budget.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close modal"
              className="rounded-full bg-white/5 p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-stellar-purple disabled:pointer-events-none"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Smart Faucet Banner ── */}
          {/* Prominently shown for unfunded/empty wallets; collapses to a tooltip when funded */}
          <FaucetBanner balanceStatus={balanceStatus} />

          {/* ── Amount Input Form ── */}
          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label
                htmlFor="fund-amount"
                className="mb-2 block text-sm font-medium text-white/70"
              >
                Amount (XLM)
              </label>
              <div className="relative">
                <input
                  id="fund-amount"
                  type="number"
                  step="any"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={isSubmitting}
                  aria-describedby={error ? "fund-error" : undefined}
                  className="w-full rounded-xl border border-white/[0.12] bg-black/20 py-3 pl-9 pr-16 font-mono text-lg text-white placeholder-white/25 outline-none transition-all focus:border-stellar-teal/60 focus:bg-black/30 focus:ring-1 focus:ring-stellar-teal/30 disabled:opacity-50"
                  required
                />
                {/* Currency prefix */}
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-white/35">
                  ✦
                </span>
                {/* Currency suffix badge */}
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white/70">
                  XLM
                </div>
              </div>
            </div>

            {/* ── Error message ── */}
            {error && (
              <div
                id="fund-error"
                role="alert"
                className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
              >
                {error}
              </div>
            )}

            {/* ── Submit button ── */}
            <button
              type="submit"
              id="fund-confirm-btn"
              disabled={
                !amount ||
                isSubmitting ||
                !isConnected ||
                balanceStatus === "unfunded" ||
                balanceStatus === "empty"
              }
              className="w-full rounded-xl bg-gradient-to-r from-stellar-purple to-stellar-teal px-4 py-3.5 text-center font-bold text-white shadow-lg shadow-stellar-purple/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-stellar-purple/40 disabled:pointer-events-none disabled:opacity-40"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-5 w-5 animate-spin text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Processing on Testnet...
                </span>
              ) : !isConnected ? (
                "Please connect Freighter"
              ) : balanceStatus === "unfunded" || balanceStatus === "empty" ? (
                "Fund your wallet first ↑"
              ) : (
                "Confirm Funding"
              )}
            </button>

            {/* ── Fee note ── */}
            <p className="mt-3 text-center text-[10px] text-white/25">
              A small Stellar network fee (&lt; 0.01 XLM) will be deducted from your wallet.
            </p>
          </form>
        </div>
      </GlassPanel>
    </div>
  );
}
