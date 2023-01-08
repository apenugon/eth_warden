mod utils;

use wasm_bindgen::prelude::*;

use pbkdf2::pbkdf2; 


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
    alert("Hello, wasm!");
}

#[wasm_bindgen]
pub fn generate_key_from_password(pw: &str) {
    // Generate a new key from a password using pbkdf2

    // No salt here, another time
    // Hash password to PHC string ($pbkdf2-sha256$...)
    let result;
    let null_salt;
    pbkdf2::pbkdf2(pw.as_bytes(), null_salt, 10000, result);
    return result;
}
