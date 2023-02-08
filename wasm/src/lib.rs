mod utils;

use aes_gcm_siv::{
    Nonce, Aes256GcmSiv, aead::{Aead, KeyInit}, AesGcmSiv
};
use primitive_types::U256;
use rand::{Rng, random};
use rand_core::RngCore;
use wasm_bindgen::{prelude::*, throw_str};
use std::{str, convert::{TryFrom, TryInto}, string::FromUtf8Error, error::Error};
use argon2::{
    password_hash::{
        rand_core::OsRng,
        PasswordHash, PasswordHasher, PasswordVerifier, SaltString
    },
    Argon2
};

use serde::{Serialize, Deserialize};
use serde_big_array::BigArray;
use bn_rs::{BigNumber};
use log::{Level, info};



#[derive(Serialize, Deserialize, Debug)]
pub struct Witness {
    #[serde(with = "BigArray")]
    pub key: [u8; 32*8],
    pub iv: String,
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
pub struct ContractAccountInfo {
    pub username: String,
    pub password: String,
    pub label: String,
    pub nonce: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DecryptedInformation {
    pub username: String,
    pub password: String,
    pub label: String,
    pub rawLabel: String
}


#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

use std::collections::HashMap;
use std::hash::Hash;
use std::iter::Iterator;

fn counter<T, I>(it: I) -> HashMap<T, usize>
where
    T: Eq + Hash,
    I: Iterator<Item = T>,
{
    let mut count_by_element = HashMap::new();
    for e in it {
        *count_by_element.entry(e).or_insert(0) += 1;
    }
    count_by_element
}

pub fn generate_key_from_password(pw: &str) -> Vec<u8> {
    // Generate a new key from a password using pbkdf2

    // No salt here, another time
    // Hash password to PHC string ($pbkdf2-sha256$...)
    // TODO: Implement salt, right now this is not done at all
    info!("Generating key from password: {}", pw);
    let salt = SaltString::b64_encode(&[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]).unwrap();
    let argon2 = Argon2::default();
    let hash = argon2.hash_password(pw.as_bytes(), salt.as_ref());
    let binding = match hash {
        Ok(phash) => phash.hash.unwrap(),
        Err(e) => {
            throw_str(&format!("Error: {}", e));
        }
    };
    info!("Password hashed");
    binding.as_bytes().to_vec()
    
}

#[wasm_bindgen]
pub fn generate_binary_key_from_password(pw: &str) -> Vec<u8> {
    // Generate a new key from a password using pbkdf2

    let bytes_pw = generate_key_from_password(pw);
    let mut output = [0u8; 32 * 8];
    generate_binary_from_bytes(bytes_pw, &mut output);
    output.to_vec()
}

#[wasm_bindgen]
pub fn generate_encrypt_info(encryption_password: &str, msg: &str, username: &str, label: &str) -> JsValue {
    // Generate a witness from a key and a message
    // Turn key into a binary array
    console_log::init_with_level(Level::Info);
    let key: Vec<u8> = generate_key_from_password(encryption_password).into();
    info!("Key: {:?}", &key);

    let mut key_bin = [0u8; 32*8];
    let mut msg_bin = [0u8; 16*8];
    let mut v_msg = Vec::from(msg);
    v_msg.push(v_msg.len() as u8);

    generate_binary_from_bytes(key.to_vec(), &mut key_bin);
    info!("Generated key binary");
    generate_binary_from_string(v_msg, &mut msg_bin);
    info!("Generated msg binary");
    info!("Message roundtrip: {}", str::from_utf8(&generate_bytes_from_binary(&msg_bin)).unwrap());
    // Generate a random IV  with max 96 bits
    let random_number: u128 = rand::thread_rng().gen_range(0u128..2u128.pow(96));
    info!("Random number nonce: {}", random_number);

    let binding = &random_number.to_le_bytes()[0..12];
    let nonce = Nonce::from_slice(&binding);
    let cipher = Aes256GcmSiv::new_from_slice(&key.into_boxed_slice()).unwrap();

    info!("Encrypting");
    info!("Label: {}", label);
    let mut enc_username = cipher.encrypt(nonce, username.as_bytes()).unwrap();
    let mut enc_label = cipher.encrypt(nonce, label.as_bytes()).unwrap();


    // print enc username and label lengths
    info!("Encrypted username length: {}", enc_username.len());
    info!("Encrypted label length: {}", enc_label.len());

    // Add length of the encrypted message to the beginning of the username/message, so we know how long it is for decoding
    // This is why we are limited to 31 bytes for the username and label
    enc_username.insert(0, enc_username.len() as u8);
    enc_label.insert(0, enc_label.len() as u8);

    info!("Done encrypting");
    let mut user32 = [0u8; 32];
    let mut label32 = [0u8; 32];

    user32[..enc_username.len()].copy_from_slice(&enc_username);
    label32[..enc_label.len()].copy_from_slice(&enc_label);

    info!("Enc label, {:?}", label32);
    // Generate the witness
    let witness = Witness {
        key: key_bin,
        iv: random_number.to_string(),
        msg: msg_bin,
    };

    let enc_info = EncryptedInformation {
        witness,
        enc_username: "0x".to_owned()+&hex::encode(user32),
        enc_label: "0x".to_owned()+&hex::encode(label32),
    };
    info!("Encrypted info: {:?}", enc_info);


    serde_wasm_bindgen::to_value(&enc_info).unwrap()
}

#[wasm_bindgen]
pub fn test_decryption(encryption_password: &str, part_1: &str, part_2: &str, nonce: &str) {
    // parts to output
    let raw_output_0: u128 = u128::from_str_radix(part_1, 10).unwrap();
    let raw_output_1: u128 = u128::from_str_radix(part_2, 10).unwrap();

    let raw_output_0_le = raw_output_0.to_le_bytes();
    let raw_output_1_le = raw_output_1.to_le_bytes();

    let raw_pw = [raw_output_1_le, raw_output_0_le].concat();

    let nonce_raw: u128 = u128::from_str_radix(nonce, 10).unwrap();
    info!("out 0: {}, out 1: {}, nonce: {}", raw_output_0, raw_output_1, nonce_raw);
    let private_key = generate_key_from_password(encryption_password);

    let binding = &nonce_raw.to_le_bytes()[0..12];
    let nonce = Nonce::from_slice(&binding);
    
    println!("Private key: {:?}", private_key);

    let cipher = match Aes256GcmSiv::new_from_slice(&private_key.into_boxed_slice()) {
        Ok(c) => c,
        Err(e) => {
            panic!("Invalid length");
        }
    };

    let mut v_msg = Vec::from("testPASS1234!@)");
    v_msg.insert(0, v_msg.len() as u8); 

    let compared_pw = cipher.encrypt(nonce, v_msg.as_slice()).unwrap();
    // Convert compared_pw to big endian
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
    
    let output = cipher.decrypt(nonce, raw_pw.as_slice()).unwrap();

    println!("Output: {:?}", output);
}

#[wasm_bindgen]
pub fn decrypt_infos(infos: JsValue, encryption_password: &str) -> JsValue {
    console_log::init_with_level(Level::Info);
    info!("Deserializing");
    let res = serde_wasm_bindgen::from_value(infos); 
    let infos: Vec<ContractAccountInfo> = match res {
        Ok(v) => v,
        Err(e) => {
            throw_str(&format!("Error with serde: {}", e));
        }
    }; 

    info!("Decrypting infos");
    let key = generate_key_from_password(encryption_password);
    let mut decrypted_infos = Vec::new();
    let cipher = match Aes256GcmSiv::new_from_slice(&key.into_boxed_slice()) {
        Ok(c) => c,
        Err(e) => {
            throw_str(&format!("Error with creating cipher: {}", e));
        }
    };
    for info in infos {
        info!("Decrypting info");
        let res = decrypt_info(&cipher, &info.nonce, &info.username, &info.label, &info.password);
        match res {
            Ok(v) => decrypted_infos.push(v),
            Err(e) => {
                throw_str(&format!("Error decrypting: {}", e));
            }
        }
    }
    serde_wasm_bindgen::to_value(&decrypted_infos).unwrap()
}

fn decrypt_info(cipher: &Aes256GcmSiv, nonce: &str, enc_hex_username: &str, enc_hex_label: &str, enc_password: &str) -> Result<DecryptedInformation, Box<dyn std::error::Error>> {

    let nonce: u128 = nonce.parse()?;

    let mut enc_username = hex::decode(enc_hex_username.split_at(2).1)?;
    let mut enc_label: Vec<u8> = hex::decode(enc_hex_label.split_at(2).1)?;

    info!("Enc username length actual: {}", enc_username[0]);
    info!("Enc label length actual: {:?} {}", enc_label, enc_label[0]);
    // Reshape username and password from encoded length
    enc_username.truncate(enc_username[0] as usize + 1);
    enc_username.remove(0);
    enc_label.truncate(enc_label[0] as usize + 1);
    enc_label.remove(0);

    let binding = &nonce.to_le_bytes()[0..12];
    let nonce = Nonce::from_slice(&binding);

    let username = cipher.decrypt(nonce, enc_username.as_slice())
        .map_err(|e| String::from(&format!("Error decrypting user name: {}", e.to_string())))?;
    let label = cipher.decrypt(nonce, enc_label.as_slice()).map_err(|e| String::from(&format!("Error decrypting label: {}", e.to_string())))?;

    let password_num = U256::from_str_radix(enc_password, 10)?;
    info!("Got u256");
    let mut password_bytes = [0u8; 32]; // I dunno why this is 0 it just is
    password_num.to_little_endian(&mut password_bytes);
    // Remove length of the encrypted message from the beginning of the username/message
    let real_length = password_bytes[0] as usize;
    let mut real_bytes = &mut password_bytes[1..real_length + 1];
    real_bytes.reverse();
    let recovered_password = String::from_utf8_lossy(real_bytes).to_string();
    info!("recovered length: {}", recovered_password.len());

    Ok(DecryptedInformation {
        username: str::from_utf8(&username)?.to_owned(),
        password: recovered_password,
        label: str::from_utf8(&label)?.to_owned(),
        rawLabel: enc_hex_label.to_owned(),
    })
}

// Input is little endian  (vec of bytes)
pub fn generate_binary_from_bytes(input: Vec<u8>, output: &mut [u8]) {
    // Generate a binary array from a hex string
    if (input.len() * 8 > output.len()) {
        throw_str("Input string too long");
    }
    let length = input.len();
    info!("Generating binary from bytes");
    let mut i = 0;
    for c in input {
        let bits = &format!("{:08b}", c);
        println!("Bits: {} c: {:x}", bits, c);
        let mut j = 0;
        for c in bits.chars() {
            let index = i * 8 + (7-j);

            println!("J: {}, B: {}", j, c);
            output[index] = c.to_digit(2).unwrap() as u8;
            j += 1;
        }
        i += 1;
    }
}

use std::iter;

pub fn diff(a: &str, b: &str) -> String {
    let mut v: Vec<char> = vec![];
    let counter_a = counter(a.chars());
    let counter_b = counter(b.chars());
    for (c, n_a) in &counter_a {
        let n_b = counter_b.get(c).unwrap_or(&0); // how many `c` in `b`?
        if n_a > n_b {
            v.extend(iter::repeat(c).take(n_a - n_b)); // add `n_a - n_b` `c`s
        }
    }
    v.into_iter().collect::<String>() // build the String
}

// The initial vec is big endian (from a string) - the binary output is 
pub fn generate_binary_from_string(input: Vec<u8>, output: &mut [u8]) {
    // Generate a binary array from a hex string
    if (input.len() * 8 > output.len()) {
        throw_str("Input string too long");
    }
    let length = input.len();
    info!("Generating binary from bytes");
    let mut i = 0;
    for c in input {
        let bits = &format!("{:08b}", c);
        println!("Bits: {} c: {:x}", bits, c);
        let mut j = 0;
        for c in bits.chars() {
            let index = (length - i - 1) * 8 + (7-j);

            println!("J: {}, B: {}", j, c);
            output[index] = c.to_digit(2).unwrap() as u8;
            j += 1;
        }
        i += 1;
    }
}

pub fn generate_bytes_from_binary(input: &[u8]) -> Vec<u8> {
    // Generate a hex string from a binary array
    let mut output = Vec::new();
    let mut i = 0;
    while i < input.len() {
        let mut byte = 0;
        for j in 0..8 {
            let index = i + j;
            println!("Index: {}, B: {}", index, input[index]);
            assert!(input[index] == 0 || input[index] == 1);
            byte += input[index] << j;
        }
        output.push(byte);
        i += 8;
    }
    output
}

#[cfg(test)]
mod tests {
    use std::{io::Write, borrow::Borrow};

    use aes_gcm_siv::{Aes256GcmSiv, KeyInit, Nonce, aead::Aead, AesGcmSiv};
    use primitive_types::{U256, U512};

    use crate::{generate_key_from_password, generate_bytes_from_binary, generate_binary_from_string, generate_binary_from_bytes, diff};

    #[test]
    fn binary_bytes() {
        // There is a bug here

        let test_1 = Vec::from("ts");
        let mut binary_1 = [0u8; 16];
        super::generate_binary_from_string(test_1, &mut binary_1);
        assert_eq!(binary_1[0], 1);

        println!("Testing hello world");
        let bytes = Vec::from("Hello World");
        let mut binary = [0u8; 88];
        super::generate_binary_from_bytes(bytes, &mut binary);
        let bytes = super::generate_bytes_from_binary(&binary);
        assert_eq!(bytes, Vec::from("Hello World"));
        
        println!("Testing key");
        let private_key = generate_key_from_password("test_enc_pas");
        let mut key_bin = [0u8; 32*8];
        let pkey_clone = private_key.clone();
        super::generate_binary_from_bytes(private_key, &mut key_bin);
        let key_bytes = super::generate_bytes_from_binary(&key_bin);
        assert_eq!(key_bytes, pkey_clone);
    }

    #[test]
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

    #[test]
    fn parse() {
        let mut v_msg = Vec::from("testPASS1234!@)");
        v_msg.insert(0, v_msg.len() as u8); 
        let n: u128 = 20542784042969719753319256133717803049;
        let n_le = n.to_le_bytes();
        //let n_be = n_le.iter().map(|b| b.reverse_bits()).collect::<Vec<u8>>();
        // convert to string
        let s = String::from_utf8_lossy(&n_le);
        println!("S: {}", s);
        // convert be to string
        //let s_be = String::from_utf8_lossy(&n_be);
        //println!("S BE: {}", s_be);

        let new_password = "abcdefg123456789abcdefg123456789"; // 32 char pw
        let mut output = [0u8; 32*8];
        //generate_binary_from_string(new_password.into(), &mut output);
        println!("Bits: {:?}", output);
    }

    #[test]
    fn compare_to_normal_encrypt() {
        let raw_key_bits = [0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1];
        let raw_nonce: u128 = 54822174152160929529777032685;
        let raw_msg = [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0];


        // Currently this is reversed - don't put it in the end though
        let binding = generate_bytes_from_binary(&raw_msg);
        let parsed_str = &String::from_utf8_lossy(&binding)[..15];
        let diff = diff(&parsed_str.to_string(), ")@!4321SSAPtset");
        println!("Parsed str: {}, diff: {:?}", parsed_str, diff.as_bytes());
        assert!(parsed_str.eq(")@!4321SSAPtset"));
        // The above verifies that the message is proper

        // Now, let's encrypt here

        let binding = &raw_nonce.to_le_bytes()[0..12];
        let nonce = Nonce::from_slice(&binding);
        let key_bytes = generate_bytes_from_binary(raw_key_bits.as_ref());
        let key_generated_bytes = &generate_key_from_password("test_enc_pas");
        let mut keygen_bits: [u8; 32] = [0; 32];
        println!("Key bytes: {:?}", key_bytes);
        println!("Key generated bytes: {:?}", key_generated_bytes);
        generate_binary_from_bytes(key_generated_bytes.to_vec(), &mut keygen_bits);
        println!("Key generated bits: {:?}", keygen_bits);
        let roundtrip = generate_bytes_from_binary(keygen_bits.as_ref());
        assert!(key_bytes.eq(&roundtrip));
        assert!(key_bytes.eq(key_generated_bytes))
    }
}