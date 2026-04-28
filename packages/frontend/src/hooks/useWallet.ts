/**
 * @file useWallet.ts
 * @description Hook for managing Freighter wallet connection.
 */

import { useState, useEffect } from 'react';

export function useWallet() {
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if wallet is already connected on mount
    checkConnection();

    // Listen for wallet events
    const handleWalletChange = () => {
      checkConnection();
    };

    // Add event listeners if Freighter is available
    if (window.freighter) {
      window.freighter.on('accountChanged', handleWalletChange);
      window.freighter.on('connected', handleWalletChange);
      window.freighter.on('disconnected', handleWalletChange);
    }

    return () => {
      // Cleanup event listeners
      if (window.freighter) {
        window.freighter.off?.('accountChanged', handleWalletChange);
        window.freighter.off?.('connected', handleWalletChange);
        window.freighter.off?.('disconnected', handleWalletChange);
      }
    };
  }, []);

  const checkConnection = async () => {
    try {
      if (window.freighter) {
        const isConnected = await window.freighter.isConnected();
        setIsConnected(isConnected);

        if (isConnected) {
          const { address } = await window.freighter.getPublicKey();
          setPublicKey(address);
        } else {
          setPublicKey(null);
        }
      } else {
        setIsConnected(false);
        setPublicKey(null);
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
      setIsConnected(false);
      setPublicKey(null);
    } finally {
      setIsLoading(false);
    }
  };

  const connect = async () => {
    try {
      if (!window.freighter) {
        throw new Error('Freighter wallet is not installed');
      }

      await window.freighter.connect();
      await checkConnection();
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw error;
    }
  };

  const disconnect = async () => {
    try {
      if (window.freighter) {
        await window.freighter.disconnect();
      }
      setIsConnected(false);
      setPublicKey(null);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      throw error;
    }
  };

  return {
    isConnected,
    publicKey,
    isLoading,
    connect,
    disconnect,
    checkConnection,
  };
}
