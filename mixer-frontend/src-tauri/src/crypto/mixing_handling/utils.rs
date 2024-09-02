use std::error::Error;

use gclient::{ext::sp_core::hashing::sha2_256, metadata::runtime_types::gprimitives::ActorId};
use parity_scale_codec::{Decode, Encode};
use risc0_zkvm::{default_prover, ExecutorEnv};
use rs_merkle::{MerkleProof, MerkleTree};

use super::methods::{HELLO_GUEST_ELF, HELLO_GUEST_ID};


#[derive(Clone, Encode, Decode)]
pub enum ContractHandleAction {
    Deposit { hashes: Vec<[u8; 32]> },
    Withdraw { image_id_receipt: Vec<u8> },
}

#[derive(Encode, Decode)]
pub enum StatePayload {
    Leaves,
    Withdrawn{from: u64},
    WithdrawnAll,
    HistoryOneFrom{user: ActorId, from: u64},
    HistoryFrom(Vec<(ActorId, u64)>),
    HistoryAll,
}

#[derive(Encode, Decode, Clone)]
pub struct TransactionInfo {
    pub amount: i32,
    pub time: u64,
}

#[derive(Encode, Decode)]
pub enum StateOutput {
    Leaves {
        res: Vec<[u8; 32]>,
    },
    Withdrawn {
        res: Vec<[u8; 32]>,
    },
    WithdrawnAll{
        res: Vec<[u8; 32]>,
    },
    HistoryOneFrom{
        res: Vec<TransactionInfo>,
    },  
    HistoryFrom {
        res: Vec<(ActorId, Vec<TransactionInfo>)>,
    },
    HistoryAll {
        res: Vec<(ActorId, Vec<TransactionInfo>)>,
    },
}

#[derive(Clone)]
struct DigestWrapper;

impl rs_merkle::Hasher for DigestWrapper{
    type Hash = [u8; 32];
    fn hash(data: &[u8]) -> Self::Hash {
        sha2_256(data)
    }
}

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy)]
#[repr(C)]
pub struct RustShit(
    pub [u8; 32],
    pub [u8; 32],
);

fn indices_to_prove(elems: &[[u8; 64]], leaves: &[[u8; 32]]) -> Vec<usize>{
    let mut indices_to_prove = Vec::with_capacity(elems.len());
    for elem in elems{
        let sha_elem = sha2_256(&*elem);
        if let Some(pos) = leaves.iter().position(|x| *x == sha_elem){
            indices_to_prove.push(pos);
        }
    }

    indices_to_prove
}

pub fn make_proof(elems: &[[u8; 64]], leaves: &[[u8; 32]]) -> Result<Vec<u8>, Box<dyn Error>>{
    let tree = MerkleTree::<DigestWrapper>::from_leaves(leaves);
    let indices_to_prove = indices_to_prove(elems, &tree.leaves().unwrap());
    let proof_bytes = tree.proof(&indices_to_prove).to_bytes();
    // MerkleProof::try_from(vec![1u8,2,3,4,5]);
    // MerkleProof::root(&self, leaf_indices, leaf_hashes, total_leaves_count)

    let elems: Vec<RustShit> = elems.iter().map(|a| RustShit(a[..32].try_into().unwrap(), a[32..].try_into().unwrap())).collect();

    let env = ExecutorEnv::builder().write(&proof_bytes).unwrap().write(&indices_to_prove).unwrap().write(&elems).unwrap().write(&leaves.len()).unwrap().build().unwrap();
    let prover = default_prover();

    let receipt = prover.prove(env, HELLO_GUEST_ELF).unwrap();
    let image_id_receipt = postcard::to_allocvec(&(HELLO_GUEST_ID, receipt.receipt)).unwrap();

    Ok(image_id_receipt)
}