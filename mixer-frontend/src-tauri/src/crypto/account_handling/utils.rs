use std::error::Error;

use schnorrkel::SecretKey;
use scrypt::{scrypt, Params};
use serde_json::Value;
use sodiumoxide::crypto::secretbox;

const SCRYPT_LENGTH: usize = 32 + (3 * 4);
const PKCS8_DIVIDER: [u8; 5] = [161, 35, 3, 33, 0];
const PKCS8_HEADER: [u8; 16] = [48, 83, 2, 1, 1, 48, 5, 6, 3, 43, 101, 112, 4, 34, 4, 32];
const PUB_LENGTH: usize = 32;
const SEC_LENGTH: usize = 64;

const SALT_LENGTH: usize = 32;
const NONCE_LENGTH: usize = 24;

const SCRYPT_N: u32 = 1 << 15;
const SCRYPT_R: u32 = 8;
const SCRYPT_P: u32 = 1;

pub fn generate_salt() -> [u8; SALT_LENGTH]{
    let mut salt = [0u8; SALT_LENGTH];
    sodiumoxide::randombytes::randombytes_into(&mut salt);
    salt
}

pub fn derive_key(salt: &[u8], password: &str) -> Result<[u8; 32], Box<dyn Error>>{
    let params = Params::new(15, SCRYPT_R, SCRYPT_P)?;
    let mut derived_key = [0u8; 32];
    scrypt(password.as_bytes(), salt, &params, &mut derived_key)?;
    Ok(derived_key)
}

pub fn encrypt_bytes_derived_key(bytes: &[u8], derived_key: &[u8]) -> Result<String, Box<dyn Error>>{
    sodiumoxide::init().expect("Failed to initialize sodiumoxide");
    let nonce = secretbox::gen_nonce();
    let secretbox_key = secretbox::Key::from_slice(&derived_key).ok_or("Invalid key length")?;
    let ciphertext = secretbox::seal(bytes, &nonce, &secretbox_key);

    let mut encrypted = Vec::new();
    encrypted.extend_from_slice(nonce.as_ref());
    encrypted.extend_from_slice(&ciphertext);

    let encrypted_str = base64::encode(encrypted);

    Ok(encrypted_str)
}

pub fn decrypt_string_derived_key(s: &str, derived_key: &[u8]) -> Result<Vec<u8>, Box<dyn Error>>{
    let encrypted = base64::decode(s)?;
    let nonce = &encrypted[..NONCE_LENGTH];
    let ciphertext = &encrypted[NONCE_LENGTH..];

    sodiumoxide::init().expect("Failed to initialize sodiumoxide");
    let secretbox_key = secretbox::Key::from_slice(&derived_key).ok_or("Invalid key length")?;
    let nonce = secretbox::Nonce::from_slice(nonce).ok_or("Invalid nonce length")?;
    let decrypted = secretbox::open(ciphertext, &nonce, &secretbox_key).map_err(|_| "Decryption failed")?;

    Ok(decrypted)
}

pub fn encrypt_bytes(bytes: &[u8], password: &str) -> Result<String, Box<dyn Error>>{
    let salt = generate_salt();
    let derived_key = derive_key(&salt, password)?;
    
    sodiumoxide::init().expect("Failed to initialize sodiumoxide");
    let nonce = secretbox::gen_nonce();
    let secretbox_key = secretbox::Key::from_slice(&derived_key).ok_or("Invalid key length")?;
    let ciphertext = secretbox::seal(bytes, &nonce, &secretbox_key);

    let mut encrypted = Vec::new();
    encrypted.extend_from_slice(&salt);
    encrypted.extend_from_slice(nonce.as_ref());
    encrypted.extend_from_slice(&ciphertext);

    let encrypted_str = base64::encode(encrypted);

    Ok(encrypted_str)
}

pub fn decrypt_string(s: &str, password: &str) -> Result<Vec<u8>, Box<dyn Error>>{
    let encrypted = base64::decode(s)?;

    let salt = &encrypted[..SALT_LENGTH];
    let derived_key = derive_key(salt, password)?;

    let nonce = &encrypted[SALT_LENGTH..SALT_LENGTH + NONCE_LENGTH];
    let ciphertext = &encrypted[SALT_LENGTH + NONCE_LENGTH ..];

    sodiumoxide::init().expect("Failed to initialize sodiumoxide");
    let secretbox_key = secretbox::Key::from_slice(&derived_key).ok_or("Invalid key length")?;
    let nonce = secretbox::Nonce::from_slice(nonce).ok_or("Invalid nonce length")?;
    let decrypted = secretbox::open(ciphertext, &nonce, &secretbox_key).map_err(|_| "Decryption failed")?;

    Ok(decrypted)
}

pub fn encode_pair_with_salt_and_derived_key(public_key: &[u8; PUB_LENGTH], private_key: &[u8; SEC_LENGTH], salt: &[u8], derived_key: &[u8]) -> Result<Vec<u8>, Box<dyn Error>>{
    let converted_private_key = SecretKey::to_ed25519_bytes(&SecretKey::from_bytes(private_key).map_err(|e| e.to_string())?);
    let message = encode_pkcs8(public_key, &converted_private_key);

    sodiumoxide::init().expect("Failed to initialize sodiumoxide");
    let nonce = secretbox::gen_nonce();
    let secretbox_key = secretbox::Key::from_slice(&derived_key).ok_or("Invalid key length")?;
    let ciphertext = secretbox::seal(&message, &nonce, &secretbox_key);

    let scrypt_params = SCRYPT_N.to_le_bytes()
        .iter()
        .chain(&SCRYPT_P.to_le_bytes())
        .chain(&SCRYPT_R.to_le_bytes())
        .copied()
        .collect::<Vec<u8>>();

    let mut encrypted_pkcs8 = Vec::new();
    encrypted_pkcs8.extend_from_slice(&salt);
    encrypted_pkcs8.extend_from_slice(&scrypt_params);
    encrypted_pkcs8.extend_from_slice(nonce.as_ref());
    encrypted_pkcs8.extend_from_slice(&ciphertext);

    Ok(encrypted_pkcs8)
}
fn encode_pkcs8(public_key: &[u8; PUB_LENGTH], private_key: &[u8; SEC_LENGTH]) -> Vec<u8> {
    let mut pkcs8 = Vec::new();
    pkcs8.extend_from_slice(&PKCS8_HEADER);
    pkcs8.extend_from_slice(private_key);
    pkcs8.extend_from_slice(&PKCS8_DIVIDER);
    pkcs8.extend_from_slice(public_key);
    pkcs8
}

pub fn decode_pair_from_encrypted_json(json_data: &str, passphrase: &str) -> Result<(Vec<u8>, Vec<u8>, String), Box<dyn Error>> {
    let json: Value = serde_json::from_str(json_data)?;
    
    // Check if the version is 3
    if json["encoding"]["version"] != "3" {
        return Err("Unsupported JSON format".into());
    }

    // Decode the base64 encoded data
    let encrypted = base64::decode(json["encoded"].as_str().ok_or("Missing 'encoded' field")?)?;

    // Derive password
    let password = if json["encoding"]["type"].as_array().ok_or("Missing 'type' field")?.contains(&Value::String("scrypt".into())) {
        let salt = &encrypted[0..32];
        let n = u32::from_le_bytes(encrypted[32..36].try_into()?);
        let p = u32::from_le_bytes(encrypted[36..40].try_into()?);
        let r = u32::from_le_bytes(encrypted[40..44].try_into()?);

        let params = Params::new(log2(n) as u8, r, p)?;
        let mut derived_key = [0u8; 32];
        scrypt(passphrase.as_bytes(), salt, &params, &mut derived_key)?;

        derived_key
    } else {
        let mut padded_passphrase = [0u8; 32];
        padded_passphrase[..passphrase.len()].copy_from_slice(passphrase.as_bytes());
        padded_passphrase
    };

    // Adjust the encrypted slice after Scrypt
    let encrypted = &encrypted[SCRYPT_LENGTH..];

    // Decrypt using xsalsa20-poly1305
    if !json["encoding"]["type"].as_array().ok_or("Missing 'type' field")?.contains(&Value::String("xsalsa20-poly1305".into())) {
        return Err("Unsupported encoding type".into());
    }

    let nonce = secretbox::Nonce::from_slice(&encrypted[0..NONCE_LENGTH]).ok_or("Invalid nonce length")?;
    let ciphertext = &encrypted[NONCE_LENGTH..];
    
    sodiumoxide::init().expect("Failed to initialize sodiumoxide");
    let secretbox_key = secretbox::Key::from_slice(&password).ok_or("Invalid key length")?;
    let decrypted = secretbox::open(ciphertext, &nonce, &secretbox_key).map_err(|_| "Decryption failed")?;

    // Decode PKCS8
    let (secret_key, public_key) = decode_pkcs8(&decrypted)?;

    let secret_key = SecretKey::from_ed25519_bytes(&secret_key).map_err(|e| e.to_string())?.to_bytes().to_vec();


    let name = json["meta"]["name"].as_str().unwrap_or_default();
    Ok((secret_key, public_key, name.to_string()))
}

fn decode_pkcs8(ciphertext: &[u8]) -> Result<(Vec<u8>, Vec<u8>), Box<dyn Error>> {
    let mut current_offset = 0;

    if &ciphertext[current_offset..current_offset + PKCS8_HEADER.len()] != PKCS8_HEADER {
        return Err("Invalid PKCS8 header".into());
    }

    current_offset += PKCS8_HEADER.len();

    let secret_key = ciphertext[current_offset..current_offset + SEC_LENGTH].to_vec();
    current_offset += SEC_LENGTH;

    if &ciphertext[current_offset..current_offset + PKCS8_DIVIDER.len()] != PKCS8_DIVIDER {
        return Err("Invalid PKCS8 divider".into());
    }

    current_offset += PKCS8_DIVIDER.len();

    let public_key = ciphertext[current_offset..current_offset + PUB_LENGTH].to_vec();

    Ok((secret_key, public_key))
}

fn log2(x: u32) -> u32 {
    31 - x.leading_zeros()
}