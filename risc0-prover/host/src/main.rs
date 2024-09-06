
use std::time::Instant;

use methods::{
    HELLO_GUEST_ELF, HELLO_GUEST_ID
};
use risc0_zkvm::{default_prover, sha::{Impl, Sha256}, ExecutorEnv};
use rs_merkle::{Hasher, MerkleTree};
use shared::{PublicOutputs, RustShit};

#[derive(Clone)]
struct DigestWrapper(Impl);

impl rs_merkle::Hasher for DigestWrapper{
    type Hash = [u8; 32];
    fn hash(data: &[u8]) -> Self::Hash {
        (*Impl::hash_bytes(data)).into()
    }
}

fn deserialize_public_outputs(bytes: Vec<u8>) -> PublicOutputs{
    let bytes_len = bytes.len();
    assert!(bytes_len >= 132, "Wrong public outputs");
    let mut root = [0u8; 32];

    let mut chunks = bytes.chunks_exact(4);
    for i in 0..32{
        root[i] = chunks.next().unwrap()[0];
    }
    let len = u32::from_le_bytes(chunks.next().unwrap().try_into().unwrap()) as usize;
    assert_eq!(bytes_len, 132 + len * 32 * 4, "Wrong public outputs");

    let mut used = Vec::with_capacity(len);
    for _ in 0..len{
        let mut elem = [0u8; 32];
        for i in 0..32{
            elem[i] = chunks.next().unwrap()[0];
        }
        used.push(elem);
    }
    PublicOutputs{root, used}
}

fn main(){
    let elems: Vec<RustShit> = (0..10).map(|x: u32| RustShit([x as u8; 32], [x as u8; 32])).collect();
    let leaves: Vec<[u8; 32]> = elems
        .iter()
        .map(|x| {
            let a: [u8; 64] = unsafe{std::mem::transmute(*x)};
            DigestWrapper::hash(&a)
        })
        .collect();

    let merkle_tree = MerkleTree::<DigestWrapper>::from_leaves(&leaves);
    let indices_to_prove: Vec<usize> = (6..8).into_iter().collect();
    let elems_to_prove = elems.get(6..8).ok_or("can't get leaves to prove").unwrap().to_vec();
    let merkle_proof = merkle_tree.proof(&indices_to_prove);
    let merkle_root = merkle_tree.root().ok_or("couldn't get the merkle root").unwrap();
    let proof_bytes = merkle_proof.to_bytes();

    let env = ExecutorEnv::builder()
        .write(&proof_bytes)
        .unwrap()
        .write(&indices_to_prove)
        .unwrap()
        .write(&elems_to_prove)
        .unwrap()
        .write(&leaves.len())
        .unwrap()
        .build()
        .unwrap();

    let prover = default_prover();

    let start_time = Instant::now();
    let receipt = prover
        .prove(env, HELLO_GUEST_ELF)
        .unwrap();
    let duration = start_time.elapsed();
    let time_for_proof = duration.as_millis(); 

    // let output: PublicOutputs = receipt.receipt.journal.decode().unwrap();
    let output = deserialize_public_outputs(receipt.receipt.journal.bytes.clone());

    let start_time = Instant::now();
    let a = receipt.receipt.verify(HELLO_GUEST_ID);
    let duration = start_time.elapsed();
    let time_for_verify = duration.as_millis(); 

    match a {
        Ok(..) => {
            let real_output = merkle_root;
            if output.root == real_output {
                println!("time for creating proof {} ms\ntime for verify {} ms", time_for_proof, time_for_verify);
            }
            else{
                println!("output_hash = {:?}, real_hash = {:?}", output.root, real_output)
            }
        }
        _ => println!("Wrong proof")
    };
}