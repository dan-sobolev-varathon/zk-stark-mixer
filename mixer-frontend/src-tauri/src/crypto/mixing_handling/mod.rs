use std::error::Error;

use gclient::ext::sp_core::hashing::sha2_256;
use keyring::Entry;
use parity_scale_codec::{Decode, Encode};
use utils::{make_proof, ContractHandleAction, StateOutput, StatePayload};

use crate::{ACCOUNTS, CONTRACT, DERIVED_KEY, KEYRING_SERVICE, MIXING, SALT};

use super::account_handling::{self, utils::{decrypt_string, encrypt_bytes_with_salt_and_derived_key}};

mod utils;
mod methods;

const VARA_UNIT: u128 = 1_000_000_000_000;

pub async fn activate_mixing(indexes: Vec<u32>) -> Result<(), Box<dyn Error>>{
    let mut guard = MIXING.lock().await;
    let derived_key = *DERIVED_KEY.lock().await;

    for i in indexes{
        let encr_data = Entry::new(KEYRING_SERVICE, &i.to_string())?.get_password().unwrap();
        let data: [u8; 64] = account_handling::utils::decrypt_string_derived_key(&encr_data, &derived_key)?.try_into().unwrap();

        guard.insert(data[..32].try_into().unwrap(), (data, i));
    }

    Ok(())
}

pub async fn check_mixing(data: Vec<[u8; 32]>) -> Result<(u32, Vec<u32>), Box<dyn Error>>{
    let mut guard = MIXING.lock().await;
    let mut removed = Vec::new();
    for d in data{
        if let std::collections::hash_map::Entry::Occupied(entry) = guard.entry(d){
            let index = entry.get().1;
            Entry::new(KEYRING_SERVICE, &index.to_string())?.delete_password()?;
            entry.remove();
            removed.push(index);
        }
    }
    Ok((guard.len() as u32, removed))
}

pub async fn deposit(addr: String, amount: u32, mut shift: u32) -> Result<Vec<u32>, Box<dyn Error>>{
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

    let gear_api;
    {
        let guard = ACCOUNTS.lock().await;
        gear_api = guard.get(&addr).unwrap().clone();
    }

    let value = amount as u128 * VARA_UNIT;

    let gas_info = gear_api.calculate_handle_gas(None, CONTRACT.into(), payload.clone(), value, true).await?;
    let balance = gear_api.free_balance(gear_api.account_id()).await?;
    if gas_info.min_limit as u128 + value > balance{
        Err("Insufficient balance")?;
    }

    let mut guard = MIXING.lock().await;

    gear_api.send_message_bytes(CONTRACT.into(), payload, gas_info.min_limit, value).await?;

    let derived_key = *DERIVED_KEY.lock().await;
    
    let mut added = Vec::new();
    for d in data{
        Entry::new(KEYRING_SERVICE, &shift.to_string())?.set_password(&account_handling::utils::encrypt_bytes_derived_key(&d.1, &derived_key)?)?;
        guard.insert(d.0, (d.1, shift as u32));
        added.push(shift);
        shift += 1;
    }

    Ok(added)
}

pub async fn withdraw(addr: String, amount: u32) -> Result<(), Box<dyn Error>>{
    if amount % 10 != 0{
        Err("Wrong amount, must be amount % 10")?;
    }
    let size = amount / 10;
    let guard = MIXING.lock().await;
    if guard.len() < size as usize{
        Err("You don't have so much mixing amount")?;
    }
    let taken_elements: Vec<[u8; 64]> = guard.iter().take(size as usize).map(|(&k, &v)| v.0).collect();

    let gear_api;
    {
        let guard = ACCOUNTS.lock().await;
        gear_api = guard.get(&addr).unwrap().clone();
    }

    let output: StateOutput = gear_api.read_state(CONTRACT.into(), StatePayload::Leaves.encode()).await?;
    let leaves = match output {
        StateOutput::Leaves { res } => res,
        _ => unreachable!(),
    };

    let image_id_receipt = make_proof(&taken_elements, &leaves)?;

    let payload = ContractHandleAction::Withdraw { image_id_receipt }.encode(); 

    let gas_info = gear_api.calculate_handle_gas(None, CONTRACT.into(), payload.clone(), 0, true).await?;
    let balance = gear_api.free_balance(gear_api.account_id()).await?;
    if gas_info.min_limit as u128 > balance{
        Err("Insufficient balance")?;
    }

    gear_api.send_message_bytes(CONTRACT.into(), payload, gas_info.min_limit, 0).await?;

    Ok(())
}

pub async fn export_mixing(amount: u32) -> Result<String, Box<dyn Error>>{
    if amount % 10 != 0{
        Err("Wrong amount, must be amount % 10")?;
    }
    let size = amount / 10;
    let guard = MIXING.lock().await;
    if guard.len() < size as usize{
        Err("You don't have so much mixing amount")?;
    }
    let taken_elements: Vec<[u8; 64]> = guard.iter().take(size as usize).map(|(&k, &v)| v.0).collect();
    let encrypted_str = encrypt_bytes_with_salt_and_derived_key(&taken_elements.encode(), &*SALT.lock().await, &*DERIVED_KEY.lock().await)?;

    Ok(encrypted_str)
}

pub async fn import_mixing(encrypted_str: String, password: String, mut shift: u32) -> Result<(u32, Vec<u32>), Box<dyn Error>>{
    let elems = Vec::<[u8; 64]>::decode(&mut &decrypt_string(&encrypted_str, &password).unwrap()[..]).unwrap();
    let mut guard = MIXING.lock().await;

    let derived_key = *DERIVED_KEY.lock().await;
    let mut added = Vec::new();
    for elem in elems{
        if let std::collections::hash_map::Entry::Vacant(mut entry) = guard.entry(elem[..32].try_into().unwrap()){
            Entry::new(KEYRING_SERVICE, &shift.to_string())?.set_password(&account_handling::utils::encrypt_bytes_derived_key(&elem, &derived_key)?)?;
            entry.insert((elem, shift));
            added.push(shift);
            shift += 1;
        }
    }

    Ok((guard.len() as u32, added))
}   