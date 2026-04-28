use crate::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Env, Symbol, String, token, Address};
use proptest::prelude::*;

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
