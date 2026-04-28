/**
 * @file useAuth.ts
 * @description Custom hook for authentication functionality
 * Provides a convenient interface for the SIWS authentication flow
 */

import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';

export function useAuthWithWallet() {
  const { signIn, signOut, isAuthenticated, user, isLoading, error } = useAuth();
  const { isConnected, publicKey: walletPublicKey } = useWallet();

  /**
   * Sign in with Stellar - ensures wallet is connected first
   */
  const signInWithStellar = useCallback(async () => {
    if (!isConnected) {
      throw new Error('Please connect your wallet first.');
    }
    
    await signIn();
  }, [isConnected, signIn]);

  /**
   * Sign out and disconnect wallet
   */
  const signOutWithCleanup = useCallback(() => {
    signOut();
  }, [signOut]);

  /**
   * Check if the authenticated user matches the connected wallet
   */
  const isWalletMatched = useCallback(() => {
    if (!isAuthenticated || !user || !walletPublicKey) {
      return false;
    }
    return user.publicKey === walletPublicKey;
  }, [isAuthenticated, user, walletPublicKey]);

  return {
    // Auth state
    isAuthenticated,
    user,
    isLoading,
    error,
    
    // Wallet state
    isWalletConnected: isConnected,
    walletPublicKey,
    
    // Combined state
    isReady: isAuthenticated && isConnected && isWalletMatched(),
    
    // Actions
    signIn: signInWithStellar,
    signOut: signOutWithCleanup,
    
    // Helpers
    isWalletMatched: isWalletMatched(),
  };
}
