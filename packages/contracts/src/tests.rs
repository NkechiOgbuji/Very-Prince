#[allow(clippy::module_inception)]
#[cfg(test)]
mod tests {
    use crate::{PayoutParams, PayoutRegistry, PayoutRegistryClient};
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{symbol_short, token, Address, Env, String, Symbol, Vec};

    // ── Test Helpers ─────────────────────────────────────────────────────────

    struct Setup {
        env: Env,
        client: PayoutRegistryClient<'static>,
        #[allow(dead_code)]
        token_admin: Address,
        token: token::StellarAssetClient<'static>,
    }

    fn setup() -> Setup {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let token_contract_id = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_client = token::StellarAssetClient::new(&env, &token_contract_id.address());

        let contract_id = env.register_contract(None, PayoutRegistry);
        let client = PayoutRegistryClient::new(&env, &contract_id);

        // Create 3 protocol admins with threshold of 2 for multisig
        let admin1 = Address::generate(&env);
        let admin2 = Address::generate(&env);
        let admin3 = Address::generate(&env);
        let mut admins = Vec::new(&env);
        admins.push_back(admin1.clone());
        admins.push_back(admin2.clone());
        admins.push_back(admin3.clone());
        
        client.init(&token_contract_id.address(), &admins, &2);

        Setup {
            env,
            client,
            token_admin,
            token: token_client,
        }
    }

    fn register_test_org(
        env: &Env,
        client: &PayoutRegistryClient<'_>,
        _org_sym: Symbol,
    ) -> Address {
        let admin = Address::generate(env);
        client.register_org(
            &admin,
            &String::from_str(env, "Test Organization"),
        );
        admin
    }

    // ── Existing Tests ────────────────────────────────────────────────────────

    #[test]
    fn test_init() {
        let Setup { env, client, .. } = setup();
        let additional_token = Address::generate(&env);
        let mut admins = Vec::new(&env);
        admins.push_back(Address::generate(&env));
        let result = client.try_init(&additional_token, &admins, &1);
        assert!(result.is_err());
    }

    #[test]
    fn test_register_and_get_org() {
        let Setup { env, client, .. } = setup();
        let org_sym = symbol_short!("myorg");
        let admin = register_test_org(&env, &client, org_sym.clone());

        let org = client.get_org(&org_sym);
        assert_eq!(org.id, org_sym);
        assert_eq!(org.admins.get(0).unwrap(), admin);
        assert_eq!(client.get_org_budget(&org_sym), 0);
    }

    #[test]
    fn test_fund_org() {
        let Setup {
            env, client, token, ..
        } = setup();
        let org_sym = symbol_short!("myorg");
        register_test_org(&env, &client, org_sym.clone());

        let donor = Address::generate(&env);
        let token_client = token::Client::new(&env, &token.address);

        token.mint(&donor, &100_000_000);
        assert_eq!(token_client.balance(&donor), 100_000_000);

        client.fund_org(&org_sym, &donor, &50_000_000);

        assert_eq!(client.get_org_budget(&org_sym), 50_000_000);
        assert_eq!(token_client.balance(&client.address), 50_000_000);
        assert_eq!(token_client.balance(&donor), 50_000_000);
    }

    #[test]
    fn test_allocate_without_budget_panics() {
        let Setup { env, client, .. } = setup();
        let org_sym = symbol_short!("myorg");
        register_test_org(&env, &client, org_sym.clone());

        let maintainer = Address::generate(&env);
        client.add_maintainer(&org_sym, &maintainer);

        let result = client.try_allocate_payout(&org_sym, &maintainer, &5_000_000_i128, &1234567890_u64);
        assert!(result.is_err());
    }

    #[test]
    fn test_allocate_and_claim_with_tokens() {
        let Setup {
            env, client, token, ..
        } = setup();
        let org_sym = symbol_short!("myorg");
        register_test_org(&env, &client, org_sym.clone());

        let maintainer = Address::generate(&env);
        client.add_maintainer(&org_sym, &maintainer);

        let donor = Address::generate(&env);
        let token_client = token::Client::new(&env, &token.address);
        token.mint(&donor, &20_000_000);

        client.fund_org(&org_sym, &donor, &20_000_000);

        client.allocate_payout(&org_sym, &maintainer, &5_000_000_i128, &1234567890_u64);
        assert_eq!(client.get_claimable_balance(&maintainer), 5_000_000);
        assert_eq!(client.get_org_budget(&org_sym), 15_000_000);

        assert_eq!(token_client.balance(&maintainer), 0);
        let claimed = client.claim_payout(&maintainer);
        assert_eq!(claimed, 5_000_000);

        assert_eq!(client.get_claimable_balance(&maintainer), 0);
        assert_eq!(token_client.balance(&maintainer), 5_000_000);
        assert_eq!(token_client.balance(&client.address), 15_000_000);
    }

    // ── Batch Allocate Tests ──────────────────────────────────────────────────

    #[test]
    fn test_batch_allocate_basic() {
        let Setup {
            env, client, token, ..
        } = setup();
        let org_sym = symbol_short!("batchorg");
        let admin = register_test_org(&env, &client, org_sym.clone());

        let m1 = Address::generate(&env);
        let m2 = Address::generate(&env);
        let m3 = Address::generate(&env);

        client.add_maintainer(&org_sym, &m1);
        client.add_maintainer(&org_sym, &m2);
        client.add_maintainer(&org_sym, &m3);

        let donor = Address::generate(&env);
        token.mint(&donor, &100_000_000);
        client.fund_org(&org_sym, &donor, &100_000_000);

        let mut payouts = Vec::new(&env);
        payouts.push_back(PayoutParams { maintainer: m1.clone(), amount: 10_000_000 });
        payouts.push_back(PayoutParams { maintainer: m2.clone(), amount: 20_000_000 });
        payouts.push_back(PayoutParams { maintainer: m3.clone(), amount: 30_000_000 });

        client.batch_allocate(&admin, &org_sym, &payouts);

        assert_eq!(client.get_claimable_balance(&m1), 10_000_000);
        assert_eq!(client.get_claimable_balance(&m2), 20_000_000);
        assert_eq!(client.get_claimable_balance(&m3), 30_000_000);
        assert_eq!(client.get_org_budget(&org_sym), 40_000_000); // 100M - 60M
    }

    #[test]
    fn test_batch_allocate_deducts_budget_atomically() {
        let Setup {
            env, client, token, ..
        } = setup();
        let org_sym = symbol_short!("atomorg");
        let admin = register_test_org(&env, &client, org_sym.clone());

        let m1 = Address::generate(&env);
        let m2 = Address::generate(&env);
        client.add_maintainer(&org_sym, &m1);
        client.add_maintainer(&org_sym, &m2);

        let donor = Address::generate(&env);
        token.mint(&donor, &50_000_000);
        client.fund_org(&org_sym, &donor, &50_000_000);

        let mut payouts = Vec::new(&env);
        payouts.push_back(PayoutParams { maintainer: m1.clone(), amount: 25_000_000 });
        payouts.push_back(PayoutParams { maintainer: m2.clone(), amount: 25_000_000 });

        client.batch_allocate(&admin, &org_sym, &payouts);

        assert_eq!(client.get_org_budget(&org_sym), 0);
        assert_eq!(client.get_claimable_balance(&m1), 25_000_000);
        assert_eq!(client.get_claimable_balance(&m2), 25_000_000);
    }

    #[test]
    fn test_batch_allocate_insufficient_budget_fails() {
        let Setup {
            env, client, token, ..
        } = setup();
        let org_sym = symbol_short!("poororg");
        let admin = register_test_org(&env, &client, org_sym.clone());

        let m1 = Address::generate(&env);
        client.add_maintainer(&org_sym, &m1);

        let donor = Address::generate(&env);
        token.mint(&donor, &5_000_000);
        client.fund_org(&org_sym, &donor, &5_000_000);

        let mut payouts = Vec::new(&env);
        payouts.push_back(PayoutParams { maintainer: m1.clone(), amount: 10_000_000 });

        let result = client.try_batch_allocate(&admin, &org_sym, &payouts);
        assert!(result.is_err());

        // Budget must remain untouched on failure
        assert_eq!(client.get_org_budget(&org_sym), 5_000_000);
    }

    #[test]
    fn test_batch_allocate_wrong_admin_fails() {
        let Setup {
            env, client, token, ..
        } = setup();
        let org_sym = symbol_short!("secorg");
        register_test_org(&env, &client, org_sym.clone());

        let m1 = Address::generate(&env);
        client.add_maintainer(&org_sym, &m1);

        let donor = Address::generate(&env);
        token.mint(&donor, &20_000_000);
        client.fund_org(&org_sym, &donor, &20_000_000);

        let impostor = Address::generate(&env);
        let mut payouts = Vec::new(&env);
        payouts.push_back(PayoutParams { maintainer: m1.clone(), amount: 5_000_000 });

        let result = client.try_batch_allocate(&impostor, &org_sym, &payouts);
        assert!(result.is_err());
    }

    #[test]
    fn test_batch_allocate_maintainer_wrong_org_fails() {
        let Setup {
            env, client, token, ..
        } = setup();
        let org_a = symbol_short!("orga");
        let org_b = symbol_short!("orgb");

        let admin_a = register_test_org(&env, &client, org_a.clone());
        register_test_org(&env, &client, org_b.clone());

        // Register maintainer under org_b
        let m1 = Address::generate(&env);
        client.add_maintainer(&org_b, &m1);

        let donor = Address::generate(&env);
        token.mint(&donor, &20_000_000);
        client.fund_org(&org_a, &donor, &20_000_000);

        // Try to batch allocate org_a funds to a maintainer from org_b
        let mut payouts = Vec::new(&env);
        payouts.push_back(PayoutParams { maintainer: m1.clone(), amount: 5_000_000 });

        let result = client.try_batch_allocate(&admin_a, &org_a, &payouts);
        assert!(result.is_err());
    }

    #[test]
    fn test_batch_allocate_zero_amount_fails() {
        let Setup { env, client, .. } = setup();
        let org_sym = symbol_short!("zeroorg");
        let admin = register_test_org(&env, &client, org_sym.clone());

        let m1 = Address::generate(&env);
        client.add_maintainer(&org_sym, &m1);

        let mut payouts = Vec::new(&env);
        payouts.push_back(PayoutParams { maintainer: m1.clone(), amount: 0 });

        let result = client.try_batch_allocate(&admin, &org_sym, &payouts);
        assert!(result.is_err());
    }

    #[test]
    fn test_batch_allocate_empty_list_fails() {
        let Setup { env, client, .. } = setup();
        let org_sym = symbol_short!("emptyorg");
        let admin = register_test_org(&env, &client, org_sym.clone());

        let payouts: Vec<PayoutParams> = Vec::new(&env);
        let result = client.try_batch_allocate(&admin, &org_sym, &payouts);
        assert!(result.is_err());
    }

    #[test]
    fn test_batch_allocate_then_claim() {
        let Setup {
            env, client, token, ..
        } = setup();
        let org_sym = symbol_short!("claimorg");
        let admin = register_test_org(&env, &client, org_sym.clone());

        let m1 = Address::generate(&env);
        client.add_maintainer(&org_sym, &m1);

        let donor = Address::generate(&env);
        let token_client = token::Client::new(&env, &token.address);
        token.mint(&donor, &30_000_000);
        client.fund_org(&org_sym, &donor, &30_000_000);

        let mut payouts = Vec::new(&env);
        payouts.push_back(PayoutParams { maintainer: m1.clone(), amount: 12_000_000 });
        client.batch_allocate(&admin, &org_sym, &payouts);

        assert_eq!(client.get_claimable_balance(&m1), 12_000_000);

        let claimed = client.claim_payout(&m1);
        assert_eq!(claimed, 12_000_000);
        assert_eq!(token_client.balance(&m1), 12_000_000);
        assert_eq!(client.get_claimable_balance(&m1), 0);
        assert_eq!(client.get_org_budget(&org_sym), 18_000_000);
    }

    #[test]
    fn test_add_remove_admin() {
        let Setup { env, client, .. } = setup();
        let org_sym = symbol_short!("adminorg");
        let admin1 = register_test_org(&env, &client, org_sym.clone());
        let admin2 = Address::generate(&env);

        // Add admin2
        client.add_admin(&org_sym, &admin2);
        let org = client.get_org(&org_sym);
        assert_eq!(org.admins.len(), 2);
        assert!(org.admins.contains(&admin2));

        // Remove admin1
        client.remove_admin(&org_sym, &admin1);
        let org = client.get_org(&org_sym);
        assert_eq!(org.admins.len(), 1);
        assert_eq!(org.admins.get(0).unwrap(), admin2);

        // Cannot remove the last admin
        let result = client.try_remove_admin(&org_sym, &admin2);
        assert!(result.is_err());
    }

    #[test]
    fn test_max_admin_limit() {
        let Setup { env, client, .. } = setup();
        let org_sym = symbol_short!("maxorg");
        register_test_org(&env, &client, org_sym.clone());

        for _ in 0..9 {
            client.add_admin(&org_sym, &Address::generate(&env));
        }

        let result = client.try_add_admin(&org_sym, &Address::generate(&env));
        assert!(result.is_err()); // Limit is 10
    }

    // ── Multisig Protocol Admin Tests ───────────────────────────────────────────

    #[test]
    fn test_multisig_upgrade_with_three_keypairs() {
        let env = Env::default();
        let token_admin = Address::generate(&env);
        let token_contract_id = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_client = token::StellarAssetClient::new(&env, &token_contract_id.address());

        let contract_id = env.register_contract(None, PayoutRegistry);
        let client = PayoutRegistryClient::new(&env, &contract_id);

        // Create 3 unique protocol admin keypairs
        let admin1 = Address::generate(&env);
        let admin2 = Address::generate(&env);
        let admin3 = Address::generate(&env);
        
        let mut admins = Vec::new(&env);
        admins.push_back(admin1.clone());
        admins.push_back(admin2.clone());
        admins.push_back(admin3.clone());
        
        // Initialize with threshold of 2 (requires 2-of-3 signatures)
        client.init(&token_contract_id.address(), &admins, &2);

        // Verify multisig configuration
        let multisig_admin = client.get_multisig_admin();
        assert_eq!(multisig_admin.admins.len(), 3);
        assert_eq!(multisig_admin.threshold, 2);

        // Test 1: Upgrade with only 1 signature should fail
        env.set_auths(&[]);
        env.mock_auths(&[(&admin1, &123)]);
        
        let new_wasm_hash = soroban_sdk::BytesN::from_array(&env, &[1; 32]);
        let result = client.try_upgrade(&new_wasm_hash);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap().to_string(), "ContractError(4)"); // insufficient multisig signatures

        // Test 2: Upgrade with 2 signatures should succeed
        env.set_auths(&[]);
        env.mock_auths(&[(&admin1, &123), (&admin2, &456)]);
        
        let result = client.try_upgrade(&new_wasm_hash);
        assert!(result.is_ok());

        // Test 3: Pause with 2 signatures should succeed
        env.set_auths(&[]);
        env.mock_auths(&[(&admin2, &789), (&admin3, &101112)]);
        
        let result = client.try_pause_protocol();
        assert!(result.is_ok());
        assert_eq!(client.get_protocol_state(), crate::ProtocolState::Paused);

        // Test 4: Unpause with only 1 signature should fail
        env.set_auths(&[]);
        env.mock_auths(&[(&admin1, &131415)]);
        
        let result = client.try_unpause_protocol();
        assert!(result.is_err());

        // Test 5: Unpause with 2 signatures should succeed
        env.set_auths(&[]);
        env.mock_auths(&[(&admin1, &161718), (&admin3, &192021)]);
        
        let result = client.try_unpause_protocol();
        assert!(result.is_ok());
        assert_eq!(client.get_protocol_state(), crate::ProtocolState::Active);
    }
}