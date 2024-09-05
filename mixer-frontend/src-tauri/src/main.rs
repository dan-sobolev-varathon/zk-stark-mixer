// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

const KEYRING_SERVICE: &str = "dgegrluihf";

const CONTRACT: ActorId = ActorId(hex_literal::hex!("ccc792af923148e3fc0a00940dcdd1f1d4f042e3f7469642f09747d28830abfc"));

mod crypto;

use std::collections::HashMap;

use crypto::{account_handling, mixing_handling};
use gclient::{metadata::runtime_types::gprimitives::ActorId, GearApi};
use lazy_static::lazy_static;
use tauri::async_runtime::Mutex;

lazy_static! {
    static ref SALT: Mutex<[u8; 32]> = Mutex::new([0; 32]);
    static ref DERIVED_KEY: Mutex<[u8; 32]> = Mutex::new([0; 32]);
    static ref ACCOUNTS: Mutex<HashMap<String, GearApi>> = Mutex::new(HashMap::new());
    static ref MIXING: Mutex<HashMap<[u8; 32], ([u8; 64], u32)>> = Mutex::new(HashMap::new());
}

#[tauri::command]
async fn import_mixing(encrypted_str: String, password: String, shift: u32) -> Result<(u32, Vec<u32>), String>{
    mixing_handling::import_mixing(encrypted_str, password, shift).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_mixing(amount: u32) -> Result<String, String>{
    mixing_handling::export_mixing(amount).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn withdraw(addr: String, amount: u32) -> Result<(), String>{
    mixing_handling::withdraw(addr, amount).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn deposit(addr: String, amount: u32, shift: u32) -> Result<Vec<u32>, String>{
    mixing_handling::deposit(addr, amount, shift).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_mixing(data: Vec<[u8; 32]>) -> Result<(u32, Vec<u32>), String>{
    mixing_handling::check_mixing(data).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn activate_accounts(addresses: Vec<String>, password: String, indexes: Vec<u32>) -> Result<(), String>{
    account_handling::activate_accounts(addresses, password, indexes).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_new_account() -> Result<(String, String), String>{
    account_handling::create_new_account().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_account(addr: String, name: String) -> Result<String, String>{
    account_handling::export_account(addr, name).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn import_account(json_encoded_pair: String, password: String) -> Result<(String, String, String), String>{
    account_handling::import_account(json_encoded_pair, password).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_accounts() -> Vec<String> {
    ACCOUNTS.lock().await.keys().cloned().into_iter().collect()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_all_accounts, activate_accounts, create_new_account, export_account, import_account, check_mixing, deposit, withdraw, import_mixing, export_mixing])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
