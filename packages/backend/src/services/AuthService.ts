/**
 * @file AuthService.ts
 * @description Authentication service for Sign-In With Stellar (SIWS) implementation.
 *
 * This service handles the generation and storage of cryptographic nonces for
 * secure wallet-based authentication using the challenge-response pattern.
 */

import { randomBytes } from "crypto";
import { safeSet, safeGet } from "./cache.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NonceResponse {
  message: string;
  nonce: string;
  expiresAt: number;
}

export interface StoredNonce {
  nonce: string;
  publicKey: string;
  expiresAt: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class AuthService {
  private readonly NONCE_LENGTH = 32; // bytes
  private readonly NONCE_TTL_SECONDS = 5 * 60; // 5 minutes
  private readonly DOMAIN = "tradeflow.app";

  /**
   * Generate a cryptographically secure random nonce.
   * 
   * @returns A hex-encoded random string
   */
  private generateSecureNonce(): string {
    return randomBytes(this.NONCE_LENGTH).toString("hex");
  }

  /**
   * Format the SIWS (Sign-In With Stellar) message according to Web3 standards.
   * 
   * @param publicKey - The user's Stellar public key
   * @param nonce - The generated nonce
   * @returns Formatted SIWS message string
   */
  private formatSIWSMessage(publicKey: string, nonce: string): string {
    return `${this.DOMAIN} wants you to sign in with your Stellar account:\n\n${publicKey}\n\nNonce: ${nonce}`;
  }

  /**
   * Store a nonce in Redis with expiration.
   * 
   * @param publicKey - The user's public key
   * @param nonce - The generated nonce
   * @param expiresAt - Unix timestamp when the nonce expires
   */
  private async storeNonce(publicKey: string, nonce: string, expiresAt: number): Promise<void> {
    const key = `siws_nonce:${publicKey}`;
    const value = JSON.stringify({ nonce, publicKey, expiresAt });
    
    await safeSet(key, value, this.NONCE_TTL_SECONDS);
  }

  /**
   * Generate and store a nonce for SIWS authentication.
   * 
   * @param publicKey - The user's Stellar public key (G...)
   * @returns Promise resolving to nonce response with message and metadata
   */
  async generateNonce(publicKey: string): Promise<NonceResponse> {
    // Validate public key format
    if (!publicKey.startsWith("G") || publicKey.length !== 56) {
      throw new Error("Invalid Stellar public key format");
    }

    // Generate cryptographically secure nonce
    const nonce = this.generateSecureNonce();
    const expiresAt = Math.floor(Date.now() / 1000) + this.NONCE_TTL_SECONDS;

    // Store in Redis with expiration
    await this.storeNonce(publicKey, nonce, expiresAt);

    // Format SIWS message
    const message = this.formatSIWSMessage(publicKey, nonce);

    return {
      message,
      nonce,
      expiresAt,
    };
  }

  /**
   * Retrieve a stored nonce from Redis.
   * 
   * @param publicKey - The user's public key
   * @returns Promise resolving to stored nonce data or null if not found/expired
   */
  async getStoredNonce(publicKey: string): Promise<StoredNonce | null> {
    const key = `siws_nonce:${publicKey}`;
    const cached = await safeGet(key);

    if (!cached) {
      return null;
    }

    try {
      const stored: StoredNonce = JSON.parse(cached);
      
      // Check if nonce has expired
      if (Date.now() / 1000 > stored.expiresAt) {
        // Let Redis handle expiration naturally, but we can proactively delete
        return null;
      }

      return stored;
    } catch (error) {
      console.error(`Failed to parse cached nonce for ${publicKey}:`, error);
      return null;
    }
  }

  /**
   * Verify a nonce and clean it up after successful verification.
   * 
   * @param publicKey - The user's public key
   * @param nonce - The nonce to verify
   * @returns Promise resolving to true if nonce is valid and not expired
   */
  async verifyNonce(publicKey: string, nonce: string): Promise<boolean> {
    const stored = await this.getStoredNonce(publicKey);

    if (!stored) {
      return false;
    }

    // Verify nonce matches
    if (stored.nonce !== nonce) {
      return false;
    }

    // Nonce is valid, it will be cleaned up automatically by Redis TTL
    return true;
  }
}

// Export singleton instance
export const authService = new AuthService();
