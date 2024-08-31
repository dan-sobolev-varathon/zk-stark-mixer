use std::error::Error;

use gclient::ext::sp_core::hashing::sha2_256;
use keyring::Entry;
use parity_scale_codec::Encode;
use utils::ContractHandleAction;

use crate::{ACCOUNTS, CONTRACT, DERIVED_KEY, KEYRING_SERVICE, MIXING, MIXING_SERVICE};

use super::account_handling;

mod utils;

const VARA_UNIT: u128 = 1_000_000_000_000;

pub async fn activate_mixing() -> Result<(), Box<dyn Error>>{
    let entry = Entry::new(KEYRING_SERVICE, MIXING_SERVICE)?;
    let amount_res = entry.get_password();
    let amount: u32 = match amount_res {
        Ok(amount_str) => amount_str.parse().unwrap(),
        Err(_) => {
            let amount = 0;
            entry.set_password(&amount.to_string())?;
            amount
        }
    };

    let mut guard = MIXING.lock().await;
    let derived_key = *DERIVED_KEY.lock().await;

    for i in 0..amount{
        let encr_data = Entry::new(KEYRING_SERVICE, &i.to_string())?.get_password().unwrap();
        let data: [u8; 64] = account_handling::utils::decrypt_string_derived_key(&encr_data, &derived_key)?.try_into().unwrap();

        guard.insert(data[..32].try_into().unwrap(), (data, i));
    }

    Ok(())
}

pub async fn check_mixing(data: Vec<[u8; 32]>) -> Result<u32, Box<dyn Error>>{
    let mut guard = MIXING.lock().await;
    let s = MIXING_SERVICE.to_string();
    println!("\nMIXING: {:?}", guard.keys());
    println!("\n\nDATA: {:?}", data);
    for d in data{
        if let std::collections::hash_map::Entry::Occupied(entry) = guard.entry(d){
            let index = entry.get().1;
            Entry::new(KEYRING_SERVICE, &index.to_string())?.delete_password()?;
            entry.remove();
        }
    }
    println!("Length {}", guard.len());
    Ok(guard.len() as u32)
}

pub async fn deposit(addr: String, amount: u32) -> Result<(), Box<dyn Error>>{
    if amount % 10 != 0{
        Err("Wrong amount, must be amount % 10")?;
    }
    let size = amount / 10;
    let mut data: Vec<([u8; 32], [u8; 64])> = Vec::with_capacity(size as usize);
    let mut hash_data = Vec::with_capacity(size as usize);
    for _ in 0..size{
        let d: [u8; 64] = sodiumoxide::randombytes::randombytes(64).try_into().unwrap();
        data.push((d[..32].try_into().unwrap(), d));
        let hd = sha2_256(&d);
        hash_data.push(hd);
    }
    let payload = ContractHandleAction::Deposit { hashes: hash_data }.encode(); 
    let guard = ACCOUNTS.lock().await;
    let gear_api = guard.get(&addr).unwrap();

    let value = amount as u128 * VARA_UNIT;

    let gas_info = gear_api.calculate_handle_gas(None, CONTRACT.into(), payload.clone(), value, true).await?;
    let balance = gear_api.free_balance(gear_api.account_id()).await?;
    if gas_info.min_limit as u128 + value > balance{
        Err("Insufficient balance")?;
    }
    gear_api.send_message_bytes(CONTRACT.into(), payload, gas_info.min_limit, value).await?;

    let mut guard = MIXING.lock().await;
    let derived_key = *DERIVED_KEY.lock().await;

    let mut prev_len = guard.len();
    for d in data{
        Entry::new(KEYRING_SERVICE, &prev_len.to_string())?.set_password(&account_handling::utils::encrypt_bytes_derived_key(&d.1, &derived_key)?)?;
        guard.insert(d.0, (d.1, prev_len as u32));
        prev_len += 1;
    }
    Entry::new(KEYRING_SERVICE, MIXING_SERVICE)?.set_password(&prev_len.to_string())?;

    Ok(())
}

// pub async fn withdraw(amount: u32) -> Result<(), Box<dyn Error>>{
//     if amount % 10 != 0{
//         Err("Wrong amount, must be amount % 10")?;
//     }
//     let size = amount / 10;
    
// }