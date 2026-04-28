"use client";

import { useState } from "react";
import { useFreighter } from "@/hooks/useFreighter";
import {
  buildFundOrgTransaction,
  submitSignedTransaction,
} from "@/lib/sorobanClient";

export function useFundOrg() {
  const { isConnected, publicKey, signTransaction } = useFreighter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fundOrg = async (orgId: string, amount: number) => {
    if (!isConnected || !publicKey) {
      throw new Error("Please connect Freighter first.");
    }

    if (isNaN(amount) || amount <= 0) {
      throw new Error("Please enter a valid positive amount.");
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const stroops = BigInt(Math.floor(amount * 10_000_000));

      // Step 1 — build & simulate the unsigned transaction XDR
      const unsignedXdr = await buildFundOrgTransaction(orgId, publicKey, stroops);

      // Step 2 — ask Freighter to sign it (user approves in the extension popup)
      const signedXdr = await signTransaction(unsignedXdr);

      // Step 3 — broadcast to Soroban RPC and wait for ledger confirmation
      await submitSignedTransaction(signedXdr);

      setIsSubmitting(false);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Funding failed. Please try again.";
      setError(errorMessage);
      setIsSubmitting(false);
      throw new Error(errorMessage);
    }
  };

  return {
    fundOrg,
    isSubmitting,
    error,
  };
}