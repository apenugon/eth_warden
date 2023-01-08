mod utils;

use wasm_bindgen::prelude::*;
use std::str;
use pbkdf2::pbkdf2; 
use sha2::Sha256;
use hmac::Hmac;


// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

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
    let mut result= vec![];
    let null_salt: &[u8] = &[];
    pbkdf2::pbkdf2::<Hmac<Sha256>>(pw.as_bytes(), null_salt, 10000, &mut result);
    return str::from_utf8(&result).unwrap().into();
}
