pragma circom 2.0.0;

include "../lib/aes-circom/circuits/gcm_siv_enc_2_keys.circom";

// MUST be compiled with -p bls12381
template ProveEncryption () {  

   // Declaration of signals. Defined such that the output is 32 bytes - just enough to fit in a solidity word.
   signal input key[256];
   signal input iv[128];
   signal input msg[128];
   signal output encrypted_lower;
   signal output encrypted_upper;

   var i;

   component gcm_siv_enc_2_keys = GCM_SIV_ENC_2_Keys(0, 128);
   for(i=0; i<256; i++) gcm_siv_enc_2_keys.K1[i] <== key[i];
   for(i=0; i<128; i++) gcm_siv_enc_2_keys.N[i] <== iv[i];
   for(i=0; i<128; i++) gcm_siv_enc_2_keys.MSG[i] <== msg[i];

   var a_encrypted_lower[128];
   var a_encrypted_upper[128];
   for (i=0; i<128; i++) {
      a_encrypted_lower[i] = gcm_siv_enc_2_keys.CT[i];
      a_encrypted_upper[i] = gcm_siv_enc_2_keys.CT[i+128];
   }

   component bits_to_num_lower = Bits2Num(128);
   component bits_to_num_upper = Bits2Num(128);
   bits_to_num_lower.in <== a_encrypted_lower;
   bits_to_num_upper.in <== a_encrypted_upper;
   encrypted_lower <== bits_to_num_lower.out;
   encrypted_upper <== bits_to_num_upper.out;
}

 component main = ProveEncryption();