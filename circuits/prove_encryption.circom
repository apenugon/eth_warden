pragma circom 2.0.0;

include "../lib/aes-circom/circuits/gcm_siv_enc_2_keys.circom";

template ProveEncryption () {  

   // Declaration of signals. Defined such that the output is 32 bytes - just enough to fit in a solidity word.
   signal input key[256];
   signal input iv[128];
   signal input msg[128];
   signal output encrypted[(128/8+16)*8];  

   var i;

   component gcm_siv_enc_2_keys = GCM_SIV_ENC_2_Keys(0, 128);
   for(i=0; i<256; i++) gcm_siv_enc_2_keys.K1[i] <== key[i];
   for(i=0; i<128; i++) gcm_siv_enc_2_keys.N[i] <== iv[i];
   for(i=0; i<128; i++) gcm_siv_enc_2_keys.MSG[i] <== msg[i];

   // Constraints.  
   for(i=0; i<(128/8+16)*8; i++) encrypted[i] <== gcm_siv_enc_2_keys.CT[i];
   
}

 component main = ProveEncryption();