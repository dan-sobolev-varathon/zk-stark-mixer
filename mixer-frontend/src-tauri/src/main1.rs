// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod crypto;

use std::{collections::HashMap, error::Error};

use crypto::account_decoding::{self, decode_pair_from_encrypted_json, decode_string_into_bytes, encode_bytes_into_string, encode_pair};
use gclient::{ext::{sp_core::{crypto::Ss58Codec, sr25519, Pair}, sp_runtime::AccountId32}, GearApi};
use keyring::Entry;
use lazy_static::lazy_static;
use schnorrkel::SecretKey;
use tauri::async_runtime::Mutex;

const KEYRING_SERVICE: &str = "dgluihf";

lazy_static! {
    static ref ACCOUNTS: Mutex<HashMap<String, GearApi>> = Mutex::new(HashMap::new());
}

async fn activate_accounts_shit(addresses: Vec<String>, password: String) -> Result<(), Box<dyn Error>>{
    let mut guard = ACCOUNTS.lock().await;
    for addr in addresses{
        let encoded_key = Entry::new(KEYRING_SERVICE, &addr)?.get_password()?;
        let secret_key = decode_string_into_bytes(&encoded_key, &password)?;
        
        let pair = sr25519::Pair::from(SecretKey::from_bytes(&secret_key).map_err(|e| e.to_string())?);
        let gear_api = GearApi::dev().await?.with(pair)?;
        guard.insert(addr, gear_api);
    }

    Ok(())
}

#[tauri::command]
async fn activate_accounts(addresses: Vec<String>, password: String) -> Result<(), String>{
    activate_accounts_shit(addresses, password).await.map_err(|e| e.to_string())
}

async fn create_new_account_shit(name: String, password: String) -> Result<String, Box<dyn Error>>{
    let (pair, _, _) = sr25519::Pair::generate_with_phrase(None);
    let addr = AccountId32::from(pair.public().0).to_ss58check();

    let encoded_key = encode_bytes_into_string(&pair.to_raw_vec(), &password)?;

    Entry::new(KEYRING_SERVICE, &addr)?.set_password(&encoded_key)?;

    let gear_api = GearApi::dev().await?.with(pair)?;
    ACCOUNTS.lock().await.insert(addr.clone(), gear_api);

    Ok(addr)
}

#[tauri::command]
async fn create_new_account(name: String, password: String) -> Result<String, String>{
    create_new_account_shit(name, password).await.map_err(|e| e.to_string())
}

async fn export_account_shit(addr: String, name: String, password: String) -> Result<String, Box<dyn Error>>{
    let encoded_key = Entry::new(KEYRING_SERVICE, &addr)?.get_password()?;
    let secret_key = decode_string_into_bytes(&encoded_key, &password)?;
    let pair = sr25519::Pair::from(SecretKey::from_bytes(&secret_key).map_err(|e| e.to_string())?);
    let json_encoded = encode_pair(&pair.public().0, &pair.to_raw_vec().try_into().unwrap(), &password)?;
    let json_pair = serde_json::json!({
        "encoded": base64::encode(&json_encoded),
        "encoding": {
            "content": ["pkcs8", "sr25519"],
            "type": ["scrypt", "xsalsa20-poly1305"],
            "version": "3"
        },
        "address": addr,
        "meta": {
            "genesisHash": null,
            "name": name,
            "whenCreated": null
        }
    });
    let json_encoded_pair = serde_json::to_string_pretty(&json_pair)?;
    Ok(json_encoded_pair)
}

#[tauri::command]
async fn export_account(addr: String, name: String, password: String) -> Result<String, String>{
    export_account_shit(addr, name, password).await.map_err(|e| e.to_string())
}

async fn import_account_shit(json_encoded_pair: String, password: String) -> Result<String, Box<dyn Error>>{
    let (secret_key, _public_key) = decode_pair_from_encrypted_json(&json_encoded_pair, &password)?;
    let pair = sr25519::Pair::from(SecretKey::from_bytes(&secret_key).map_err(|e| e.to_string())?);
    let addr = AccountId32::from(pair.public().0).to_ss58check();

    Entry::new(KEYRING_SERVICE, &addr)?.set_password(&encode_bytes_into_string(&secret_key, &password)?)?;

    let gear_api = GearApi::dev().await?.with(pair)?;
    ACCOUNTS.lock().await.insert(addr.clone(), gear_api);

    Ok(addr)
}

#[tauri::command]
async fn import_account(json_encoded_pair: String, password: String) -> Result<String, String>{
    import_account_shit(json_encoded_pair, password).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_accounts() -> Vec<String> {
    ACCOUNTS.lock().await.keys().cloned().into_iter().collect()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_all_accounts, activate_accounts, create_new_account, export_account, import_account])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
