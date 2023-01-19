mod utils;

use wasm_bindgen::prelude::*;
use std::str;
use pbkdf2::{
    password_hash::{PasswordHasher, Salt, Output},
    Algorithm, Params, Pbkdf2,
};
use sha2::Sha256;
use hmac::Hmac;
use serde::{Serialize, Deserialize};

use log::{Level, info};
// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[derive(Serialize, Deserialize)]
pub struct Witness {
    pub key: [u8; 32*8],
    pub iv: [u8; 16*8],
    pub msg: [u8; 32*8],
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
    let hash = Pbkdf2.hash_password(pw.as_bytes(), "aaaa");
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
    info!("Generated hex: {}", hex_rep);
    // test
    return hex_rep.into();
}

#[wasm_bindgen]
pub fn generate_witness(key: &str, msg: &str) -> JsValue {
    // Generate a witness from a key and a message
    // Turn key into a binary array

    let mut key_bin = [0u8; 32*8];
    let mut msg_bin = [0u8; 32*8];
    let mut iv_bin = [0u8; 16*8];

    generate_binary_from_string(key, &mut key_bin);
    generate_binary_from_string(msg, &mut msg_bin);
    
}

fn generate_binary_from_string(input: &str, output: &mut [u8]) {
    // Generate a binary array from a string
    assert!(input.len() * 8 < output.len(), "Input string too long");

    let mut i = 0;
    for c in input.bytes() {
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

