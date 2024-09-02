#![no_std]

use gmeta::{InOut, Metadata};
use gstd::{ActorId, Vec};
use parity_scale_codec::{Decode, Encode};
use scale_info::TypeInfo;

pub struct ProgramMetadata;

impl Metadata for ProgramMetadata {
    type Init = ();
    type Handle = InOut<ContractHandleAction, ContractHandleEvent>;
    type Reply = InOut<(), ()>;
    type State = InOut<StatePayload, StateOutput>;
    type Signal = ();
    type Others = ();
}

#[derive(Clone, Encode, Decode, TypeInfo)]
pub enum ContractHandleAction {
    Deposit { hashes: Vec<[u8; 32]> },
    Withdraw { image_id_receipt: Vec<u8> },
}

#[derive(Encode, Decode, TypeInfo)]
pub enum ContractHandleEvent {
    Deposited,
    WrongDeposit,
    Withdrawed,
}

#[derive(Encode, Decode, TypeInfo)]
pub enum StatePayload {
    Leaves,
    Withdrawn{from: u64},
    WithdrawnAll,
    HistoryOneFrom{user: ActorId, from: u64},
    HistoryFrom(Vec<(ActorId, u64)>),
    HistoryAll,
}

#[derive(Encode, Decode, TypeInfo, Clone)]
pub struct TransactionInfo {
    pub amount: i32,
    pub time: u64,
}

#[derive(Encode, Decode, TypeInfo)]
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
