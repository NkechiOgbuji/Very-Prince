/**
 * Resolves an IPFS CID or ipfs:// URL to a public HTTP gateway URL.
 * Used to render images in standard <img> tags.
 */
export function ipfsToHttp(cid: string | undefined | null): string {
  if (!cid) return "";
  
  // Strip ipfs:// prefix if present to handle both formats
  const cleanCid = cid.replace("ipfs://", "");
  
  // Using Cloudflare's public gateway as requested
  return `https://cloudflare-ipfs.com/ipfs/${cleanCid}`;
}