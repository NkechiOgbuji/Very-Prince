use crate::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Env, Symbol, String, token, Address};
use proptest::prelude::*;

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, IntoVal, String, Symbol, Vec,
};

// ─────────────────────────────────────────────────────────────────────────────
// Data Types
// ─────────────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Organization {
    pub id: Symbol,
    pub name: String,
    pub admin: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Maintainer {
    pub address: Address,
    pub org_id: Symbol,
}

/// Represents a single payout entry in a batch allocation.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayoutParams {
    pub maintainer: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MaintainerPayout {
    pub amount: i128,
    pub unlock_timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProtocolState {
    Active,
    Paused,
}

#[contracttype]
pub enum DataKey {
    /// The global Stellar Asset Contract address configured during initialization.
    Token,
    Organization(Symbol),
    OrgAdmin(Symbol),
    OrgMaintainers(Symbol),
    MaintainerOrg(Address),
    MaintainerBalance(Address),
    /// Total budget currently held by this org (in stroops).
    OrgBudget(Symbol),
    /// Protocol admin address for contract upgrades and emergency functions.
    ProtocolAdmin,
    /// Current protocol state (Active or Paused).
    ProtocolState,
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────────────────────

#[contract]
pub struct PayoutRegistry;

#[contractimpl]
impl PayoutRegistry {
    // ─────────────────────────────────────────────────────────────────────────
    // Initialization
    // ─────────────────────────────────────────────────────────────────────────

    pub fn init(env: Env, token: Address) {
        if env.storage().persistent().has(&DataKey::Token) {
            panic!("already initialized");
        }
        env.storage().persistent().set(&DataKey::Token, &token);
        env.storage().persistent().set(&DataKey::ProtocolAdmin, &protocol_admin);
        env.storage().persistent().set(&DataKey::ProtocolState, &ProtocolState::Active);
        
        env.events().publish(
            (Symbol::new(&env, "VeryPrincess"), Symbol::new(&env, "Initialized")),
            (token, protocol_admin),
        );
    }

    pub fn get_token(env: Env) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::Token)
            .expect("contract not initialized")
    }

    /// Retrieve the protocol admin address.
    ///
    /// # Panics
    /// If the contract has not been initialized.
    pub fn get_protocol_admin(env: Env) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::ProtocolAdmin)
            .expect("contract not initialized")
    }

    /// Retrieve the current protocol state.
    ///
    /// # Panics
    /// If the contract has not been initialized.
    pub fn get_protocol_state(env: Env) -> ProtocolState {
        env.storage()
            .persistent()
            .get(&DataKey::ProtocolState)
            .expect("contract not initialized")
    }

    /// Assert that the protocol is currently active.
    /// 
    /// # Panics
    /// If the protocol is paused.
    fn assert_active(env: &Env) {
        let state = Self::get_protocol_state(env.clone());
        match state {
            ProtocolState::Active => {}, // Continue normally
            ProtocolState::Paused => panic!("protocol is paused"),
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Organisation Management & Funding
    // ─────────────────────────────────────────────────────────────────────────

    pub fn register_org(env: Env, admin: Address, name: String) -> BytesN<32> {
        admin.require_auth();

        // Generate a deterministic ID based on admin address and name
        let mut combined_data = Vec::new(&env);
        combined_data.push_back(admin.clone());
        combined_data.push_back(name.clone());
        let id_bytes = env.crypto().sha256(&combined_data);
        let id = Symbol::new(&env, &id_bytes);

        let org_key = DataKey::Organization(id.clone());

        if env.storage().persistent().has(&org_key) {
            panic!("organization already registered");
        }

        let org = Organization {
            id: id.clone(),
            name,
            admin: admin.clone(),
        };
        env.storage().persistent().set(&org_key, &org);

        env.storage()
            .persistent()
            .set(&DataKey::OrgAdmin(id.clone()), &admin);

        let empty_list: Vec<Address> = Vec::new(&env);
        env.storage()
            .persistent()
            .set(&DataKey::OrgMaintainers(id.clone()), &empty_list);

        env.storage()
            .persistent()
            .set(&DataKey::OrgBudget(id.clone()), &0_i128);

        env.events().publish(
            (Symbol::new(&env, "VeryPrincess"), Symbol::new(&env, "org_registered")),
            (id.clone(), admin.clone()),
        );

        id_bytes
    }

    pub fn get_org(env: Env, id: Symbol) -> Organization {
        env.storage()
            .persistent()
            .get(&DataKey::Organization(id))
            .expect("organization not found")
    }

    pub fn fund_org(env: Env, org_id: Symbol, from: Address, amount: i128) {
        Self::assert_active(&env);
        
        // Strict authorization: bind the signature to the exact parameters
        from.require_auth_for_args((org_id.clone(), from.clone(), amount).into_val(&env));

        if amount <= 0 {
            panic!("amount must be positive");
        }

        if !env
            .storage()
            .persistent()
            .has(&DataKey::OrgAdmin(org_id.clone()))
        {
            panic!("organization not found");
        }

        let token = Self::get_token(env.clone());
        let token_client = token::Client::new(&env, &token);

        token_client.transfer(&from, &env.current_contract_address(), &amount);

        let budget_key = DataKey::OrgBudget(org_id.clone());
        let current_budget: i128 = env.storage().persistent().get(&budget_key).unwrap_or(0);
        let new_budget = current_budget.checked_add(amount).expect("budget overflow");
        env.storage()
            .persistent()
            .set(&budget_key, &new_budget);

        env.events().publish(
    (Symbol::new(&env, "VeryPrincess"), Symbol::new(&env, "OrgFunded")),
    (org_id, from, amount),
);
    }

    pub fn get_org_budget(env: Env, id: Symbol) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::OrgBudget(id))
            .unwrap_or(0_i128)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Maintainer Management
    // ─────────────────────────────────────────────────────────────────────────

    pub fn add_maintainer(env: Env, org_id: Symbol, maintainer: Address) {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::OrgAdmin(org_id.clone()))
            .expect("organization not found");
        admin.require_auth();

        if env
            .storage()
            .persistent()
            .has(&DataKey::MaintainerOrg(maintainer.clone()))
        {
            panic!("maintainer already registered");
        }

        env.storage()
            .persistent()
            .set(&DataKey::MaintainerOrg(maintainer.clone()), &org_id);

        env.storage()
            .persistent()
            .set(&DataKey::MaintainerBalance(maintainer.clone()), &MaintainerPayout { amount: 0, unlock_timestamp: 0 });

        let maintainer_list_key = DataKey::OrgMaintainers(org_id.clone());
        let mut maintainers: Vec<Address> = env
            .storage()
            .persistent()
            .get(&maintainer_list_key)
            .unwrap_or_else(|| Vec::new(&env));
        maintainers.push_back(maintainer.clone());
        env.storage()
            .persistent()
            .set(&maintainer_list_key, &maintainers);

        env.events().publish(
    (Symbol::new(&env, "VeryPrincess"), Symbol::new(&env, "MaintainerAdded")),
    (org_id, maintainer),
);
    }

    pub fn get_maintainer(env: Env, address: Address) -> Maintainer {
        let org_id: Symbol = env
            .storage()
            .persistent()
            .get(&DataKey::MaintainerOrg(address.clone()))
            .expect("maintainer not registered");
        Maintainer { address, org_id }
    }

    pub fn get_maintainers(env: Env, org_id: Symbol) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::OrgMaintainers(org_id))
            .unwrap_or_else(|| Vec::new(&env))
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Payout Allocation & Claiming
    // ─────────────────────────────────────────────────────────────────────────

    pub fn allocate_payout(env: Env, org_id: Symbol, maintainer: Address, amount: i128, unlock_timestamp: u64) {
        Self::assert_active(&env);
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::OrgAdmin(org_id.clone()))
            .expect("organization not found");
        
        // Strict authorization: ensure the admin authorizes this specific payout allocation
        admin.require_auth_for_args((org_id.clone(), maintainer.clone(), amount, unlock_timestamp).into_val(&env));

        if amount <= 0 {
            panic!("payout amount must be positive");
        }

        let maintainer_org: Symbol = env
            .storage()
            .persistent()
            .get(&DataKey::MaintainerOrg(maintainer.clone()))
            .expect("maintainer not registered");
        if maintainer_org != org_id {
            panic!("maintainer does not belong to this organization");
        }

        let budget_key = DataKey::OrgBudget(org_id.clone());
        let current_budget: i128 = env.storage().persistent().get(&budget_key).unwrap_or(0);
        if current_budget < amount {
            panic!("insufficient organization budget");
        }

        env.storage()
            .persistent()
            .set(&budget_key, &(current_budget - amount));

        let balance_key = DataKey::MaintainerBalance(maintainer.clone());
        let mut current_payout: MaintainerPayout = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(MaintainerPayout { amount: 0, unlock_timestamp: 0 });
        current_payout.amount = current_payout.amount.checked_add(amount).expect("payout amount overflow");
        current_payout.unlock_timestamp = unlock_timestamp;
        env.storage().persistent().set(&balance_key, &current_payout);

        env.events().publish(
    (Symbol::new(&env, "VeryPrincess"), Symbol::new(&env, "PayoutAllocated")),
    (org_id, maintainer, amount),
);
    }

    /// Allocate payouts to multiple maintainers in a single transaction.
    ///
    /// Admin auth is required only once for the entire batch.
    /// The total sum of all payouts must not exceed the organization's current budget.
    /// Maximum batch size is 100 entries to stay within Soroban CPU/instruction limits.
    pub fn batch_allocate(
        env: Env,
        admin: Address,
        org_id: Symbol,
        payouts: Vec<PayoutParams>,
    ) {
        // Require admin auth once for the entire batch
        admin.require_auth();

        // Verify caller is the registered admin for this org
        let stored_admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::OrgAdmin(org_id.clone()))
            .expect("organization not found");
        if stored_admin != admin {
            panic!("caller is not the organization admin");
        }

        // Enforce batch size limit to prevent out-of-gas errors
        if payouts.len() > 100 {
            panic!("batch size exceeds maximum of 100");
        }

        if payouts.is_empty() {
            panic!("payouts list must not be empty");
        }

        // Compute total payout sum and validate each entry before touching storage
        let mut total: i128 = 0_i128;
        for i in 0..payouts.len() {
            let entry = payouts.get(i).unwrap();
            if entry.amount <= 0 {
                panic!("payout amount must be positive");
            }
            let maintainer_org: Symbol = env
                .storage()
                .persistent()
                .get(&DataKey::MaintainerOrg(entry.maintainer.clone()))
                .expect("maintainer not registered");
            if maintainer_org != org_id {
                panic!("maintainer does not belong to this organization");
            }
            total += entry.amount;
        }

        // Verify the org has enough budget to cover the entire batch
        let budget_key = DataKey::OrgBudget(org_id.clone());
        let current_budget: i128 = env.storage().persistent().get(&budget_key).unwrap_or(0);
        if current_budget < total {
            panic!("insufficient organization budget for batch");
        }

        // Deduct total from org budget in one write
        env.storage()
            .persistent()
            .set(&budget_key, &(current_budget - total));

        // Accumulate each maintainer's claimable balance
        for i in 0..payouts.len() {
            let entry = payouts.get(i).unwrap();
            let balance_key = DataKey::MaintainerBalance(entry.maintainer.clone());
            let current_balance: i128 = env
                .storage()
                .persistent()
                .get(&balance_key)
                .unwrap_or(0_i128);
            env.storage()
                .persistent()
                .set(&balance_key, &(current_balance + entry.amount));
        }

        // Emit a single batch_allocated event
        env.events().publish(
            (symbol_short!("payout"), symbol_short!("batch_alc")),
            (org_id, admin, total),
        );
    }

    pub fn get_claimable_balance(env: Env, maintainer: Address) -> i128 {
        let payout: MaintainerPayout = env.storage()
            .persistent()
            .get(&DataKey::MaintainerBalance(maintainer))
            .unwrap_or(MaintainerPayout { amount: 0, unlock_timestamp: 0 });
        payout.amount
    }

    pub fn claim_payout(env: Env, maintainer: Address) -> i128 {
        Self::assert_active(&env);
        
        // Strict authorization: ensure the maintainer is the one claiming
        maintainer.require_auth_for_args((maintainer.clone(),).into_val(&env));

        let balance_key = DataKey::MaintainerBalance(maintainer.clone());
        let payout: MaintainerPayout = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(MaintainerPayout { amount: 0, unlock_timestamp: 0 });

        if payout.amount == 0 {
            panic!("no claimable balance");
        }

        // Reset balance BEFORE transfer (Checks-Effects-Interactions)
        env.storage().persistent().set(&balance_key, &0_i128);

        let token = Self::get_token(env.clone());
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &maintainer, &payout.amount);

        env.events().publish(
    (Symbol::new(&env, "VeryPrincess"), Symbol::new(&env, "PayoutClaimed")),
    (maintainer, payout.amount),
);

        payout.amount
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Protocol Pause/Unpause
    // ─────────────────────────────────────────────────────────────────────────

    /// Pause the protocol. Only the protocol admin can call this.
    /// 
    /// When paused, all fund_org, allocate_payout, and claim_payout operations
    /// will be blocked with a "protocol is paused" error.
    /// 
    /// # Arguments
    /// * `env` - The contract environment
    /// * `protocol_admin` - The address of the protocol admin (must match stored admin)
    pub fn pause_protocol(env: Env, protocol_admin: Address) {
        // Verify the caller is the protocol admin
        let stored_admin = Self::get_protocol_admin(env.clone());
        if stored_admin != protocol_admin {
            panic!("unauthorized: not protocol admin");
        }
        
        // Require authentication from the protocol admin
        protocol_admin.require_auth();
        
        // Update the protocol state to paused
        env.storage().persistent().set(&DataKey::ProtocolState, &ProtocolState::Paused);
        
        // Emit pause event
        env.events().publish(
            (Symbol::new(&env, "VeryPrincess"), Symbol::new(&env, "ProtocolPaused")),
            protocol_admin,
        );
    }

    /// Unpause the protocol. Only the protocol admin can call this.
    /// 
    /// When unpaused, normal operations resume.
    /// 
    /// # Arguments
    /// * `env` - The contract environment
    /// * `protocol_admin` - The address of the protocol admin (must match stored admin)
    pub fn unpause_protocol(env: Env, protocol_admin: Address) {
        // Verify the caller is the protocol admin
        let stored_admin = Self::get_protocol_admin(env.clone());
        if stored_admin != protocol_admin {
            panic!("unauthorized: not protocol admin");
        }
        
        // Require authentication from the protocol admin
        protocol_admin.require_auth();
        
        // Update the protocol state to active
        env.storage().persistent().set(&DataKey::ProtocolState, &ProtocolState::Active);
        
        // Emit unpause event
        env.events().publish(
            (Symbol::new(&env, "VeryPrincess"), Symbol::new(&env, "ProtocolUnpaused")),
            protocol_admin,
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Contract Upgradeability
    // ─────────────────────────────────────────────────────────────────────────

    /// Upgrade the contract to a new WASM binary.
    /// 
    /// This function can only be called by the protocol admin and allows for
    /// upgrading the contract code while preserving all contract state.
    /// 
    /// # Arguments
    /// * `env` - The contract environment
    /// * `protocol_admin` - The address of the protocol admin (must match stored admin)
    /// * `new_wasm_hash` - The 32-byte hash of the new WASM binary
    /// 
    /// # Panics
    /// * If the caller is not the protocol admin
    /// * If the WASM hash is invalid
    pub fn upgrade(env: Env, protocol_admin: Address, new_wasm_hash: BytesN<32>) {
        // Verify the caller is the protocol admin
        let stored_admin = Self::get_protocol_admin(env.clone());
        if stored_admin != protocol_admin {
            panic!("unauthorized: not protocol admin");
        }
        
        // Require authentication from the protocol admin
        protocol_admin.require_auth();
        
        // Perform the upgrade
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        
        // Emit upgrade event
        env.events().publish(
            (Symbol::new(&env, "VeryPrincess"), Symbol::new(&env, "ContractUpgraded")),
            (protocol_admin, new_wasm_hash),
        );
    }
}
#[cfg(test)]
mod tests;


struct FuzzSetup {
    env: Env,
    client: PayoutRegistryClient<'static>,
    token: token::StellarAssetClient<'static>,
    protocol_admin: Address,
}

fn setup_fuzz() -> FuzzSetup {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let token_contract_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token::StellarAssetClient::new(&env, &token_contract_id.address());

    let contract_id = env.register_contract(None, PayoutRegistry);
    let client = PayoutRegistryClient::new(&env, &contract_id);

    let protocol_admin = Address::generate(&env);
    client.init(&token_contract_id.address(), &protocol_admin);

    FuzzSetup {
        env,
        client,
        token,
        protocol_admin,
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn fuzz_fund_org(amount in -1000_i128..1_000_000_000_000_i128) {
        let FuzzSetup { env, client, token, .. } = setup_fuzz();
        let org_id = Symbol::new(&env, "fuzzorg");
        let admin = Address::generate(&env);
        
        client.register_org(&org_id, &String::from_str(&env, "Fuzz Org"), &admin);
        
        let donor = Address::generate(&env);
        token.mint(&donor, &1_000_000_000_000_i128);
        
        if amount <= 0 {
            // Should panic/trap
            let result = client.try_fund_org(&org_id, &donor, &amount);
            assert!(result.is_err());
        } else {
            // Should succeed or fail if amount > minted
            let result = client.try_fund_org(&org_id, &donor, &amount);
            if amount <= 1_000_000_000_000_i128 {
                assert!(result.is_ok());
                assert_eq!(client.get_org_budget(&org_id), amount);
            } else {
                assert!(result.is_err());
            }
        }
    }

    #[test]
    fn fuzz_allocate_payout(amount in 1_i128..10_000_000_i128) {
        let FuzzSetup { env, client, token, .. } = setup_fuzz();
        let org_id = Symbol::new(&env, "fuzzorg");
        let admin = Address::generate(&env);
        client.register_org(&org_id, &String::from_str(&env, "Fuzz Org"), &admin);

        let maintainer = Address::generate(&env);
        client.add_maintainer(&org_id, &maintainer);

        // Fund with fixed amount
        let donor = Address::generate(&env);
        token.mint(&donor, &5_000_000_i128);
        client.fund_org(&org_id, &donor, &5_000_000_i128);

        let result = client.try_allocate_payout(&org_id, &maintainer, &amount, &0);
        
        if amount <= 5_000_000 {
            assert!(result.is_ok());
            assert_eq!(client.get_claimable_balance(&maintainer), amount);
        } else {
            assert!(result.is_err()); // insufficient budget
        }
    }
}
