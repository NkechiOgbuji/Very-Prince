/**
 * Next.js configuration for the very-princess frontend.
 *
 * Key notes:
 * - `NEXT_PUBLIC_*` variables are inlined at build time and safe for the browser.
 * - The Soroban RPC and contract ID are public — secrets never go here.
 */
const nextConfig = {
  // Expose network config to the browser bundle.
  env: {
    NEXT_PUBLIC_HORIZON_URL:
      process.env["NEXT_PUBLIC_HORIZON_URL"] ??
      "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_RPC_URL:
      process.env["NEXT_PUBLIC_RPC_URL"] ??
      "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_NETWORK_PASSPHRASE:
      process.env["NEXT_PUBLIC_NETWORK_PASSPHRASE"] ??
      "Test SDF Network ; September 2015",
    NEXT_PUBLIC_CONTRACT_ID: process.env["NEXT_PUBLIC_CONTRACT_ID"] ?? "",
    NEXT_PUBLIC_API_URL:
      process.env["NEXT_PUBLIC_API_URL"] ??
      "http://localhost:3001",
  },

  // Webpack — required so modules that use Node.js built-ins (like `stellar-sdk`)
  // degrade gracefully in the browser bundle.
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
