mod utils;

use aes_gcm_siv::{
    Nonce, Aes256GcmSiv, aead::{Aead, KeyInit}
};
use rand::Rng;
use rand_core::RngCore;
use wasm_bindgen::prelude::*;
use std::{str, convert::TryFrom, string::FromUtf8Error};
use pbkdf2::{
    password_hash::{PasswordHasher, Salt, Output, SaltString},
    Algorithm, Params, Pbkdf2,
};
use sha2::Sha256;
use hmac::Hmac;
use serde::{Serialize, Deserialize};
use serde_big_array::BigArray;

use log::{Level, info};
// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[derive(Serialize, Deserialize, Debug)]
pub struct Witness {
    #[serde(with = "BigArray")]
    pub key: [u8; 32*8],
    pub iv: u128,
    #[serde(with = "BigArray")]
    pub msg: [u8; 16*8],
}

#[derive(Serialize, Deserialize, Debug)]
pub struct EncryptedInformation {
    pub witness: Witness,
    pub enc_username: String,
    pub enc_label: String
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DecryptedInformation {
    pub username: String,
    pub label: String,
    pub password: String
}


#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn generate_key_from_password(pw: &str) -> String {
    // Generate a new key from a password using pbkdf2

    // No salt here, another time
    // Hash password to PHC string ($pbkdf2-sha256$...)
    // TODO: Implement salt, right now this is not done at all
    console_log::init_with_level(Level::Info);
    info!("Generating key from password: {}", pw);
    let salt = SaltString::b64_encode(&[0,0,0,0]).unwrap();
    let hash = Pbkdf2.hash_password_customized(
        pw.as_bytes(),
        Some(Algorithm::Pbkdf2Sha256.ident()),
        None,
        Params { rounds: 10000, output_length: 32 },
        &salt,    
    );
    let binding = match hash {
        Ok(phash) => phash.hash.unwrap(),
        Err(e) => {
            info!("Error: {}", e);
            return "Error".into();
        }
    };
    info!("Password hashed");
    let bytes = binding.as_bytes();
    let hex_rep = hex::encode(&bytes);
    info!("Generated hex: {}, hex length: {}, bytes length: {}", hex_rep, hex_rep.len(), bytes.len());
    return hex_rep.into();
}

#[wasm_bindgen]
pub fn generate_encrypt_info(key: &str, msg: &str, username: &str, label: &str) -> JsValue {
    // Generate a witness from a key and a message
    // Turn key into a binary array

    info!("Key and key length: {:?}, {}", hex::decode(key).unwrap(), key.len());

    let mut key_bin = [0u8; 32*8];
    let mut msg_bin = [0u8; 16*8];

    generate_binary_from_bytes(hex::decode(key).unwrap(), &mut key_bin);
    info!("Generated key binary");
    generate_binary_from_bytes(Vec::from(msg), &mut msg_bin);
    info!("Generated msg binary");
    info!("Message roundtrip: {}", str::from_utf8(&generate_bytes_from_binary(&msg_bin)).unwrap());
    // Generate a random IV  with max 96 bits
    let random_number = rand::thread_rng().gen_range(0u128..2u128.pow(96));

    let binding = number_to_u8(random_number);
    let nonce = Nonce::from_slice(&binding);
    let cipher = Aes256GcmSiv::new_from_slice(&hex::decode(key).unwrap()).unwrap();

    info!("Encrypting");
    let enc_username = cipher.encrypt(nonce, username.as_bytes()).unwrap();
    let enc_password = cipher.encrypt(nonce, label.as_bytes()).unwrap();
    info!("Done encrypting");
    let mut user32 = [0u8; 32];
    let mut pass32 = [0u8; 32];

    user32[..enc_username.len()].copy_from_slice(&enc_username);
    pass32[..enc_password.len()].copy_from_slice(&enc_password);

    info!("Encrypted username: {:?}", user32);

    // Generate the witness
    let witness = Witness {
        key: key_bin,
        iv: random_number,
        msg: msg_bin,
    };

    let enc_info = EncryptedInformation {
        witness,
        enc_username: "0x".to_owned()+&hex::encode(user32),
        enc_label: "0x".to_owned()+&hex::encode(pass32),
    };

    serde_wasm_bindgen::to_value(&enc_info).unwrap()
}

#[wasm_bindgen]
pub fn decrypt_info(key: &str, nonce: &str, enc_hex_username: &str, enc_hex_label: &str, enc_hex_password: &str) -> JsValue {
    let nonce: u128 = nonce.parse().unwrap();
    let enc_username = hex::decode(enc_hex_username).unwrap();
    let enc_password: Vec<u8> = hex::decode(enc_hex_password).unwrap();
    let enc_label: Vec<u8> = hex::decode(enc_hex_label).unwrap();

    let binding = number_to_u8(nonce);
    let nonce = Nonce::from_slice(&binding);
    let cipher = Aes256GcmSiv::new_from_slice(&hex::decode(key).unwrap()).unwrap();

    let username = cipher.decrypt(nonce, enc_username.as_slice()).unwrap();
    let password = cipher.decrypt(nonce, enc_password.as_slice()).unwrap();
    let label = cipher.decrypt(nonce, enc_label.as_slice()).unwrap();

    let decrypted_info = DecryptedInformation {
        username: str::from_utf8(&username).unwrap().to_owned(),
        password: str::from_utf8(&password).unwrap().to_owned(),
        label: str::from_utf8(&label).unwrap().to_owned(),
    };

    serde_wasm_bindgen::to_value(&decrypted_info).unwrap()
}

// convert number to u8 byte array
// Input should actually only be 96 bits, will get truncated otherwise
fn number_to_u8(number: u128) -> [u8; 12] {
    let mut bytes = [0u8; 12];
    for i in 0..12 {
        bytes[i] = ((number >> (i * 8)) & 0xff) as u8;
    }
    bytes
}

fn generate_binary_from_bytes(input: Vec<u8>, output: &mut [u8]) {
    // Generate a binary array from a hex string
    assert!(input.len() * 8 <= output.len(), "Input string too long");
    info!("Generating binary from bytes");
    let mut i = 0;
    for c in input {
        let bits = &format!("{:08b}", c);
        println!("Bits: {}", bits);
        let mut j = 0;
        for c in bits.chars() {
            let index = i * 8 + j;

            println!("J: {}, B: {}", j, c);
            output[index] = c.to_digit(2).unwrap() as u8;
            j += 1;
        }
        i += 1;
    }
}

fn generate_bytes_from_binary(input: &[u8]) -> Vec<u8> {
    // Generate a hex string from a binary array
    let mut output = Vec::new();
    let mut i = 0;
    while i < input.len() {
        let mut byte = 0;
        for j in 0..8 {
            let index = i + j;
            byte += input[index] << (7 - j);
        }
        output.push(byte);
        i += 8;
    }
    output
}

