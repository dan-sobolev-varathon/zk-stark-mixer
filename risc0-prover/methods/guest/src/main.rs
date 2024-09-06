#![no_main]

risc0_zkvm::guest::entry!(main);

use risc0_zkvm::{
    guest::env,
    sha::{Impl, Sha256},
};
use rs_merkle::{Hasher, MerkleProof};
use shared::{RustShit, PublicOutputs};

#[derive(Clone)]
struct DigestWrapper(Impl);

impl rs_merkle::Hasher for DigestWrapper{
    type Hash = [u8; 32];
    fn hash(data: &[u8]) -> Self::Hash {
        (*Impl::hash_bytes(data)).into()
    }
}

fn main(){
    let proof_bytes: Vec<u8> = env::read();
    let indices_to_prove: Vec<usize> = env::read();
    let elems_to_prove: Vec<RustShit> = env::read();
    let total_leaves_count: usize = env::read();

    let proof = MerkleProof::<DigestWrapper>::try_from(proof_bytes).unwrap();

    let leaves_to_prove_and_used: (Vec<[u8; 32]>, Vec<[u8; 32]>) = elems_to_prove.into_iter().map(|x| {
        let b = x.0;
        let a: [u8; 64] = unsafe{std::mem::transmute(x)};
        (DigestWrapper::hash(&a), b)
    }).collect();

    let root = proof.root(&indices_to_prove, &leaves_to_prove_and_used.0, total_leaves_count).unwrap();
    let used = leaves_to_prove_and_used.1;

    let public_outputs = PublicOutputs{root, used};

    env::commit(&public_outputs);
}
