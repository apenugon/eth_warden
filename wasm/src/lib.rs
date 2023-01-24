mod utils;

use rand_core::RngCore;
use wasm_bindgen::prelude::*;
use std::{str, convert::TryFrom};
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
    #[serde(with = "BigArray")]
    pub iv: [u8; 16*8],
    #[serde(with = "BigArray")]
    pub msg: [u8; 16*8],
}

#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    unsafe {
        alert("Hello, wasm!");
    }
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
pub fn generate_witness(key: &str, msg: &str) -> JsValue {
    // Generate a witness from a key and a message
    // Turn key into a binary array

    info!("Key and key length: {:?}, {}", hex::decode(key).unwrap(), key.len());

    let mut key_bin = [0u8; 32*8];
    let mut msg_bin = [0u8; 16*8];
    let mut iv_bin = [0u8; 16*8];

    generate_binary_from_bytes(hex::decode(key).unwrap(), &mut key_bin);
    info!("Generated key binary");
    generate_binary_from_bytes(Vec::from(msg), &mut msg_bin);
    info!("Generated msg binary");
    info!("Message roundtrip: {}", str::from_utf8(&generate_bytes_from_binary(&msg_bin)).unwrap());
    // Generate a random IV
    let random_bytes: [u8; 12] = rand::random();
    generate_binary_from_bytes(random_bytes.to_vec(), &mut iv_bin);

    // Generate the witness
    let witness = Witness {
        key: key_bin,
        iv: iv_bin,
        msg: msg_bin,
    };
    info!("Witness generated: {:?}", witness);
    serde_wasm_bindgen::to_value(&witness).unwrap()
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

