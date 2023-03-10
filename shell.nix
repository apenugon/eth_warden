{ pkgs ? import <nixpkgs> {} }:
  pkgs.mkShell {
    # nativeBuildInputs is usually what you want -- tools you need to run
    nativeBuildInputs = [ 
      pkgs.rustup 
      pkgs.wasm-pack 
      pkgs.nodePackages.npm 
      pkgs.nodejs 
      pkgs.gnumake
      pkgs.nlohmann_json
      pkgs.gmp
      pkgs.nasm
    ];
}