/**
 * @file sorobanClient.ts
 * @description Browser-side service for interacting with the Soroban RPC and Horizon.
 *
 * This service centralizes all Stellar network interactions for the frontend.
 * It provides methods for both read-only contract calls (simulations) and
 * for building write transactions that can be signed by a wallet (e.g., Freighter).
 *
 * It encapsulates the `stellar-sdk`'s `SorobanRpc.Server` and `Horizon.Server`
 * instances, ensuring they are configured and used consistently.
 *
 * ## Adding New Operations
 *
 * 1. Identify the contract function name (e.g. `get_org`).
 * 2. Build the argument list using `nativeToScVal`.
 * 3. Call `simulateContractCall(functionName, args)` and convert the return
 *    value with `scValToNative`.
 */

"use client";

import {
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Contract,
  Keypair,
  Horizon,
} from "@stellar/stellar-sdk";
import type { MaintainerBalance, Organization } from "./contractTypes";

// ─── Network Configuration ────────────────────────────────────────────────────

const HORIZON_URL = process.env["NEXT_PUBLIC_HORIZON_URL"] ?? "https://horizon-testnet.stellar.org";
const RPC_URL =
  process.env["NEXT_PUBLIC_RPC_URL"] ?? "https://soroban-testnet.stellar.org";

const NETWORK_PASSPHRASE =
  process.env["NEXT_PUBLIC_NETWORK_PASSPHRASE"] ??
  Networks.TESTNET;

const CONTRACT_ID = process.env["NEXT_PUBLIC_CONTRACT_ID"] ?? "";

/**
 * A service class that provides a centralized client for interacting with
 * the Stellar network (Soroban RPC and Horizon).
 */
class SorobanClient {
  private readonly rpcServer: SorobanRpc.Server;
  private readonly horizonServer: Horizon.Server;

  constructor() {
    this.rpcServer = new SorobanRpc.Server(RPC_URL, {
      allowHttp: RPC_URL.startsWith("http://"),
    });
    this.horizonServer = new Horizon.Server(HORIZON_URL, {
      allowHttp: HORIZON_URL.startsWith("http://"),
    });
  }

  // ─── Simulation Helper ────────────────────────────────────────────────────────

  private async _simulateContractCall(
    functionName: string,
    args: Parameters<typeof nativeToScVal>[0][]
  ): Promise<ReturnType<typeof scValToNative>> {
    if (!CONTRACT_ID) {
      throw new Error("NEXT_PUBLIC_CONTRACT_ID is not set. Deploy the contract first.");
    }

    const fakeKeypair = Keypair.random();
    const contract = new Contract(CONTRACT_ID);

    const fakeAccount = {
      accountId: () => fakeKeypair.publicKey(),
      sequenceNumber: () => "0",
      incrementSequenceNumber: () => {},
    };

    const tx = new TransactionBuilder(
      // @ts-ignore — minimal account duck-typing is sufficient for simulation
      fakeAccount,
      { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE }
    )
      .addOperation(
        // @ts-ignore — call() accepts string args
        contract.call(functionName, ...args.map((a) => nativeToScVal(a)))
      )
      .setTimeout(30)
      .build();

    const simResult = await this.rpcServer.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Contract simulation failed: ${simResult.error}`);
    }

    // @ts-ignore — returnVal present on success result
    return scValToNative(simResult.result?.retval);
  }

  // ─── Public Read API ───────────────────────────────────────────────────────────

  public async readOrganization(orgId: string): Promise<Organization> {
    const raw = await this._simulateContractCall("get_org", [orgId]);
    const map = raw as Record<string, unknown>;
    return {
      id: String(map["id"]),
      name: String(map["name"]),
      admin: String(map["admin"]),
    };
  }

  public async readMaintainers(orgId: string): Promise<string[]> {
    const raw = await this._simulateContractCall("get_maintainers", [orgId]);
    return Array.isArray(raw) ? (raw as string[]) : [];
  }

  public async readClaimableBalance(address: string): Promise<MaintainerBalance> {
    const raw = await this._simulateContractCall("get_claimable_balance", [address]);
    const stroops = BigInt(raw as number);
    const xlm = (Number(stroops) / 10_000_000).toFixed(7);
    return { address, stroops, xlm };
  }

  public async readOrgBudget(orgId: string): Promise<Pick<MaintainerBalance, "stroops" | "xlm">> {
    const raw = await this._simulateContractCall("get_org_budget", [orgId]);
    const stroops = BigInt(raw as number);
    const xlm = (Number(stroops) / 10_000_000).toFixed(7);
    return { stroops, xlm };
  }

  public async readAccountXlmBalance(address: string): Promise<number | null> {
    try {
      const account = await this.horizonServer.loadAccount(address);
      const nativeLine = account.balances.find(
        (b): b is typeof b & { asset_type: "native" } => b.asset_type === "native"
      );
      return nativeLine ? parseFloat(nativeLine.balance) : 0;
    } catch {
      return null;
    }
  }

  // ─── Write API (Transaction Builders) ───────────────────────────────────────

  private async _loadAccount(publicKey: string) {
    try {
      return await this.horizonServer.loadAccount(publicKey);
    } catch (err) {
      throw new Error(`Failed to load account from network. Ensure ${publicKey} is funded on Testnet.`);
    }
  }

  public async buildFundOrgTransaction(
    orgId: string,
    fromAddress: string,
    amountStroops: bigint
  ): Promise<string> {
    const account = await this._loadAccount(fromAddress);
    const contract = new Contract(CONTRACT_ID);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        // @ts-ignore
        contract.call(
          "fund_org",
          nativeToScVal(orgId),
          nativeToScVal(fromAddress),
          nativeToScVal(amountStroops, { type: "i128" })
        )
      )
      .setTimeout(60)
      .build();

    const simResult = await this.rpcServer.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Simulation failed: ${simResult.error}`);
    }

    const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
    return preparedTx.toXDR();
  }

  public async buildClaimPayoutTransaction(userAddress: string): Promise<string> {
    const account = await this._loadAccount(userAddress);
    const contract = new Contract(CONTRACT_ID);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        // @ts-ignore
        contract.call("claim_payout", nativeToScVal(userAddress))
      )
      .setTimeout(60)
      .build();

    const simResult = await this.rpcServer.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`Simulation failed: ${simResult.error}`);
    }

    const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
    return preparedTx.toXDR();
  }

  public async submitSignedTransaction(signedXdr: string): Promise<unknown> {
    const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

    const sendResult = await this.rpcServer.sendTransaction(tx as any);
    if (sendResult.status === "ERROR") {
      throw new Error(`Send error: ${JSON.stringify(sendResult)}`);
    }

    return new Promise((resolve, reject) => {
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > 30) {
          clearInterval(interval);
          return reject(new Error("Transaction confirmation timed out."));
        }

        try {
          const getTxResponse = await this.rpcServer.getTransaction(sendResult.hash);
          if (getTxResponse.status === "SUCCESS") {
            clearInterval(interval);
            resolve(scValToNative(getTxResponse.returnValue as any));
          } else if (getTxResponse.status === "FAILED") {
            clearInterval(interval);
            reject(new Error(`Transaction failed on ledger`));
          }
        } catch (err) {
          // network issue, keep polling
        }
      }, 2000);
    });
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────────

/**
 * A singleton instance of the SorobanClient.
 * Components and hooks should import this instance directly for new code.
 */
export const sorobanClient = new SorobanClient();

// ─── Backward-Compatibility Exports ───────────────────────────────────────────
// To avoid breaking existing imports, we also export the methods as standalone
// functions. New code should prefer using the `sorobanClient` instance.

export const readOrganization = sorobanClient.readOrganization.bind(sorobanClient);
export const readMaintainers = sorobanClient.readMaintainers.bind(sorobanClient);
export const readClaimableBalance = sorobanClient.readClaimableBalance.bind(sorobanClient);
export const readOrgBudget = sorobanClient.readOrgBudget.bind(sorobanClient);
export const readAccountXlmBalance = sorobanClient.readAccountXlmBalance.bind(sorobanClient);
export const buildFundOrgTransaction = sorobanClient.buildFundOrgTransaction.bind(sorobanClient);
export const buildClaimPayoutTransaction =
  sorobanClient.buildClaimPayoutTransaction.bind(sorobanClient);
export const submitSignedTransaction = sorobanClient.submitSignedTransaction.bind(sorobanClient);
