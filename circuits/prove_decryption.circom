pragma circom 2.0.0;

include "../lib/aes-circom/circuits/gcm_siv_dec_2_keys.circom";

template ProveDecryption() {
    signal input key[256];
    signal input iv; // Should hold 128 bits of info
    signal input encrypted[2];
    signal output msg;
    signal output success;

    var iv_bits[128];
    component num_to_bits = Num2Bits(128);
    num_to_bits.in <== iv;
    iv_bits = num_to_bits.out;
    var i;

    // Convert encrypted back to bits
    
    component num_to_bits_lower = Num2Bits(128);
    component num_to_bits_upper = Num2Bits(128);
    component test_bits_to_num = Bits2Num(128);
    num_to_bits_lower.in <== encrypted[0];
    num_to_bits_upper.in <== encrypted[1];
    var encrypted_bits[256];
    for (i = 0; i < 128; i++) {
        encrypted_bits[i] = num_to_bits_lower.out[i];
        encrypted_bits[i+128] = num_to_bits_upper.out[i];
    }
    test_bits_to_num.in <== num_to_bits_lower.out;
    
    component gcm_siv_dec_2_keys = GCM_SIV_DEC_2_Keys(0, 128);
    for(i=0; i<256; i++) gcm_siv_dec_2_keys.K1[i] <== key[i];
    for(i=0; i<128; i++) gcm_siv_dec_2_keys.N[i] <== iv_bits[i];
    for(i=0; i<256; i++) gcm_siv_dec_2_keys.CT[i] <== encrypted_bits[i];

    component bits_to_num = Bits2Num(128);
    bits_to_num.in <== gcm_siv_dec_2_keys.MSG;

    msg <== bits_to_num.out;
    success <== gcm_siv_dec_2_keys.success;
}

component main = ProveDecryption();