pub mod utils;

use std::error::Error;

use crate::{KEYRING_SERVICE, SALT, DERIVED_KEY, ACCOUNTS};

use utils::{decode_pair_from_encrypted_json, decrypt_string, decrypt_string_derived_key, derive_key, encode_pair_with_salt_and_derived_key, encrypt_bytes, encrypt_bytes_derived_key, generate_salt};
use gclient::{ext::{sp_core::{crypto::Ss58Codec, sr25519, Pair}, sp_runtime::AccountId32}, GearApi};
use keyring::Entry;
use schnorrkel::SecretKey;

use super::mixing_handling;

async fn set_derived_key(password: String) -> Result<[u8; 32], Box<dyn Error>>{
    let entry = Entry::new(KEYRING_SERVICE, "encr_salt")?;
    let encr_salt_res = entry.get_password();
    let (derived_key, salt) = match encr_salt_res {
        Ok(encr_salt) => {
            let salt = decrypt_string(&encr_salt, &password)?;
            (derive_key(&salt, &password)?, salt.try_into().unwrap())
        }
        Err(_) => {
            let salt = generate_salt();
            let derived_key = derive_key(&salt, &password)?;

            let encr_salt = encrypt_bytes(&salt, &password)?;
            entry.set_password(&encr_salt)?;

            (derived_key, salt)
        }
    };

    *SALT.lock().await = salt;
    *DERIVED_KEY.lock().await = derived_key;

    Ok(derived_key)
}

pub async fn activate_accounts(addresses: Vec<String>, password: String, indexes: Vec<u32>) -> Result<(), Box<dyn Error>>{
    let derived_key = set_derived_key(password).await?;
    let mut guard = ACCOUNTS.lock().await;
    for addr in addresses{
        let encoded_key = Entry::new(KEYRING_SERVICE, &addr)?.get_password()?;
        let secret_key = decrypt_string_derived_key(&encoded_key, &derived_key)?;
        
        let pair = sr25519::Pair::from(SecretKey::from_bytes(&secret_key).map_err(|e| e.to_string())?);
        let gear_api = GearApi::dev().await?.with(pair)?;
        guard.insert(addr, gear_api);
    }

    mixing_handling::activate_mixing(indexes).await?;

    Ok(())
}

pub async fn create_new_account() -> Result<(String, String), Box<dyn Error>>{
    let (pair, _, _) = sr25519::Pair::generate_with_phrase(None);
    let addr = "0x".to_string() + &hex::encode(pair.public().0);
    let ss58 = AccountId32::from(pair.public().0).to_ss58check();

    let encoded_key = encrypt_bytes_derived_key(&pair.to_raw_vec(), &*DERIVED_KEY.lock().await)?;

    Entry::new(KEYRING_SERVICE, &addr)?.set_password(&encoded_key)?;

    let gear_api = GearApi::dev().await?.with(pair)?;
    ACCOUNTS.lock().await.insert(addr.clone(), gear_api);

    Ok((addr, ss58))
}

pub async fn export_account(addr: String, name: String) -> Result<String, Box<dyn Error>>{
    let encoded_key = Entry::new(KEYRING_SERVICE, &addr)?.get_password()?;
    let secret_key = decrypt_string_derived_key(&encoded_key, &*DERIVED_KEY.lock().await)?;
    let pair = sr25519::Pair::from(SecretKey::from_bytes(&secret_key).map_err(|e| e.to_string())?);

    let address = AccountId32::from(pair.public().0).to_ss58check();

    let salt = *SALT.lock().await;
    let derived_key = *DERIVED_KEY.lock().await;
    let json_encoded = encode_pair_with_salt_and_derived_key(&pair.public().0, &pair.to_raw_vec().try_into().unwrap(), &salt, &derived_key)?;
    let json_pair = serde_json::json!({
        "encoded": base64::encode(&json_encoded),
        "encoding": {
            "content": ["pkcs8", "sr25519"],
            "type": ["scrypt", "xsalsa20-poly1305"],
            "version": "3"
        },
        "address": address,
        "meta": {
            "genesisHash": null,
            "name": name,
            "whenCreated": null
        }
    });
    let json_encoded_pair = serde_json::to_string_pretty(&json_pair)?;
    Ok(json_encoded_pair)
}

pub async fn import_account(json_encoded_pair: String, password: String) -> Result<(String, String, String), Box<dyn Error>>{
    let (secret_key, _public_key, name) = decode_pair_from_encrypted_json(&json_encoded_pair, &password)?;
    let pair = sr25519::Pair::from(SecretKey::from_bytes(&secret_key).map_err(|e| e.to_string())?);
    let addr = "0x".to_string() + &hex::encode(pair.public().0);
    let ss58 = AccountId32::from(pair.public().0).to_ss58check();

    let derived_key = *DERIVED_KEY.lock().await;
    Entry::new(KEYRING_SERVICE, &addr)?.set_password(&encrypt_bytes_derived_key(&secret_key, &derived_key)?)?;

    let gear_api = GearApi::dev().await?.with(pair)?;
    if let Some(_) = ACCOUNTS.lock().await.insert(addr.clone(), gear_api){
        Err("Such account already exist")?;
    }

    Ok((addr, ss58, name))
}