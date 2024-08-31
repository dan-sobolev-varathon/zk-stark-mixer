use parity_scale_codec::{Decode, Encode};


#[derive(Clone, Encode, Decode)]
pub enum ContractHandleAction {
    Deposit { hashes: Vec<[u8; 32]> },
    Withdraw { image_id_receipt: Vec<u8> },
}