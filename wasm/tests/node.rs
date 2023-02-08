//! Test suite for the Web and headless browsers.

#![cfg(target_arch = "wasm32")]

extern crate wasm_bindgen_test;

use log::{Level, info};
use wasm_bindgen_test::*;
use wasm_bindgen_test::wasm_bindgen_test_configure;

//wasm_bindgen_test_configure!(node);
use std::{io::Write, borrow::Borrow};

use aes_gcm_siv::{Aes256GcmSiv, KeyInit, Nonce, aead::Aead, AesGcmSiv};
use primitive_types::{U256, U512};

use wasm::{generate_key_from_password, generate_bytes_from_binary, generate_binary_from_string, generate_binary_from_bytes, diff};

#[wasm_bindgen_test]
fn binary_bytes() {
    // There is a bug here

    let test_1 = Vec::from("ts");
    let mut binary_1 = [0u8; 16];
    generate_binary_from_string(test_1, &mut binary_1);
    assert_eq!(binary_1[0], 1);

    println!("Testing hello world");
    let bytes = Vec::from("Hello World");
    let mut binary = [0u8; 88];
    generate_binary_from_bytes(bytes, &mut binary);
    let bytes = generate_bytes_from_binary(&binary);
    assert_eq!(bytes, Vec::from("Hello World"));
    
    println!("Testing key");
    let private_key = generate_key_from_password("test_enc_pas");
    let mut key_bin = [0u8; 32*8];
    let pkey_clone = private_key.clone();
    generate_binary_from_bytes(private_key, &mut key_bin);
    let key_bytes = generate_bytes_from_binary(&key_bin);
    assert_eq!(key_bytes, pkey_clone);
}

#[wasm_bindgen_test]
fn parse_zk_output() {
    let raw_output_0: u128 = 131273948142674397661556942260248217834;
    let raw_output_1: u128 = 317295017284696336992010911869908711217;

    let raw_output_0_le = raw_output_0.to_le_bytes();
    let raw_output_1_le = raw_output_1.to_le_bytes();

    let raw_pw = [raw_output_0_le, raw_output_1_le].concat();
    let nonce_raw: u128 = 54822174152160929529777032685;
    let mut private_key = generate_key_from_password("test_enc_pas");
    private_key.reverse();
    let binding = &nonce_raw.to_le_bytes()[0..12];
    let nonce = Nonce::from_slice(&binding);
    let nonce_circom: U256 = U256::from_dec_str("54822174152160929529777032685").unwrap();
    let mut bytes_nonce = [0u8; 32];
    nonce_circom.to_little_endian(&mut bytes_nonce);
    println!("Private key: {:?}", private_key);

    let cipher = match Aes256GcmSiv::new_from_slice(&private_key.into_boxed_slice()) {
        Ok(c) => c,
        Err(e) => {
            panic!("Invalid length");
        }
    };

    let mut v_msg = Vec::from("testPASS1234!@)");
    v_msg.insert(0, v_msg.len() as u8); 

    let bits_reve_circom: U256 = U256::from_dec_str("107969899493856550825927928274414867298691519239183300433621548449418343319786").expect("Invalid number");
    let mut bytes_circom = [0; 32];
    bits_reve_circom.to_little_endian(&mut bytes_circom);

    let long_test_message: U512 = U512::from_dec_str("34301434124644589159264606949451511223195083389315069678936754058070721529496011742907303312901895405484342470946393").unwrap();
    let mut bytes_long = [0; 64];
    long_test_message.to_little_endian(&mut bytes_long);
    //let decrypted_circom_bits = cipher.decrypt(nonce, &bytes_long.as_slice()[..48]).expect("Decryption failed");

    let compared_pw = cipher.encrypt(nonce, v_msg.as_slice()).unwrap();
    let mut compared_pw_bits = [0u8; 32*8];
    let length = compared_pw.len();
    generate_binary_from_bytes(compared_pw, &mut compared_pw_bits);
    
    let mut raw_pw_bits = [0u8; 32*8];
    generate_binary_from_bytes(raw_pw, &mut raw_pw_bits);
    println!("Circom pw bits: {:?}", raw_pw_bits);
    println!("Compared pw bits: {:?}, len: {} bytes", compared_pw_bits, length);
    // Convert compared_pw to big endian
    /*
    let mut compared_pw_be = [0u8; 32];
    for i in 0..32 {
        // convert byte to big endian - flip bits
        let mut byte = compared_pw[i];
        let mut flipped_byte = 0;
        for j in 0..8 {
            flipped_byte += (byte & 1) << (7-j);
            byte >>= 1;
        }
        compared_pw_be[i] = flipped_byte;
    }
    */
    //let output = cipher.decrypt(nonce, raw_pw.as_slice()).unwrap();

    //println!("Output: {:?}", output);
}

#[wasm_bindgen_test]
fn parse() {
    let mut v_msg = Vec::from("testPASS1234!@)");
    v_msg.insert(0, v_msg.len() as u8); 
    let n: u128 = 20542784042969719753319256133717803049;
    let n_le = n.to_le_bytes();
    let n_be = n_le.iter().map(|b| b.reverse_bits()).collect::<Vec<u8>>();
    // convert to string
    let s = String::from_utf8_lossy(&n_le);
    println!("S: {}", s);
    // convert be to string
    let s_be = String::from_utf8_lossy(&n_be);
    println!("S BE: {}", s_be);

    let new_password = "abcdefg123456789abcdefg123456789"; // 32 char pw
    let mut output = [0u8; 32*8];
    generate_binary_from_string(new_password.into(), &mut output);
    println!("Bits: {:?}", output);
}

#[wasm_bindgen_test]
fn compare_to_normal_encrypt() {
    console_log::init_with_level(Level::Info);
    let raw_key_bits = [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0];
    let raw_nonce: u128 = 54822174152160929529777032685;
    let raw_msg = [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0];

    let mut circom_output_ciphertext = [0,0,1,0,1,0,0,1,1,1,1,1,0,1,1,1,0,0,1,1,1,0,1,0,1,1,0,1,1,1,1,1,1,0,1,1,1,0,0,1,1,1,0,1,1,0,0,0,1,0,1,1,1,0,0,0,0,1,1,0,1,0,1,0,1,0,1,0,1,1,0,1,0,1,0,1,0,0,1,0,0,0,0,1,0,0,1,1,0,1,0,1,0,0,1,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,1,1,0,1,0,0,0,0,1,0,0,0,0,1,1,1,1,0,0,1,1,0,0,1,0,0,0,1,0,0,1,0,1,0,0,1,1,0,0,1,1,0,1,1,1,1,1,0,1,1,0,0,0,0,0,0,1,0,0,1,1,0,0,0,0,1,1,1,1,1,1,0,1,0,0,1,0,0,0,0,0,1,1,0,1,1,1,0,1,0,1,1,1,1,1,1,1,0,1,1,1,1,0,0,0,0,1,1,0,0,1,0,1,1,1,1,1,0,1,1,0,1,1,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,1,1,1,1,1,0];
    //circom_output_ciphertext.reverse();


    // Currently this is reversed - don't put it in the end though
    let binding = generate_bytes_from_binary(&raw_msg);
    let parsed_str = &String::from_utf8_lossy(&binding)[..15];
    let diff = diff(&parsed_str.to_string(), ")@!4321SSAPtset");
    info!("Parsed str: {}, diff: {:?}", parsed_str, diff.as_bytes());
    assert!(parsed_str.eq(")@!4321SSAPtset"));
    // The above verifies that the message is proper

    // Now, let's encrypt here

    let binding = &raw_nonce.to_le_bytes()[0..12];
    let nonce = Nonce::from_slice(&binding);
    let key_bytes = generate_bytes_from_binary(raw_key_bits.as_ref());
    let key_generated_bytes = &generate_key_from_password("test_enc_pas");
    let mut keygen_bits: [u8; 32*8] = [0; 32*8];
    info!("Key bytes: {:?}", key_bytes);
    info!("Key generated bytes: {:?}", key_generated_bytes);
    generate_binary_from_bytes(key_generated_bytes.to_vec(), &mut keygen_bits);
    info!("Key generated bits: {:?}", keygen_bits);
    let roundtrip = generate_bytes_from_binary(keygen_bits.as_ref());
    info!("Roundtrip: {:?}", roundtrip);
    assert!(key_generated_bytes.eq(&roundtrip));
    assert!(key_bytes.eq(key_generated_bytes)); // This confirms that the key is actually what we think it is. I put a wrong key in initially

    let circom_ciphertext_bytes = generate_bytes_from_binary(circom_output_ciphertext.as_ref());
    let raw_msg_bytes = generate_bytes_from_binary(raw_msg.as_ref());
    info!("Circom ciphertext bytes: {:?}", circom_ciphertext_bytes);
    let cipher = match Aes256GcmSiv::new_from_slice(&key_bytes.into_boxed_slice()) {
        Ok(c) => c,
        Err(e) => {
            panic!("Invalid length");
        }
    };
    let wasm_ciphertext_bytes = cipher.encrypt(nonce, raw_msg_bytes.as_ref()).unwrap();
    info!("Wasm ciphertext: {:?}", wasm_ciphertext_bytes);
    let mut wasm_ciphertext_bits: [u8; 32*8] = [0; 32*8];
    generate_binary_from_bytes(wasm_ciphertext_bytes.to_vec(), &mut wasm_ciphertext_bits);
    info!("Wasm bits: {:?}, len: {}", wasm_ciphertext_bits, wasm_ciphertext_bytes.len());
    cipher.decrypt(nonce, circom_ciphertext_bytes.as_ref()).unwrap();
    assert!(circom_ciphertext_bytes.eq(&wasm_ciphertext_bytes)); // This confirms that the ciphertext is actually what we think it is. I put a wrong ciphertext in initially

}
#[wasm_bindgen_test]
fn pass() {
    assert_eq!(1 + 1, 2);
}
