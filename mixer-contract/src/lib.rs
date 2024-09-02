#![no_std]

use gstd::{
    collections::{HashMap, HashSet},
    exec, msg, ActorId, Vec,
};
use io::{ContractHandleAction, ContractHandleEvent, StateOutput, StatePayload, TransactionInfo};
use risc0_zkvm::{guest::sha::Impl, sha::Sha256};
use rs_merkle::MerkleTree;

const RISC0_BUILTIN: ActorId = ActorId::new(hex_literal::hex!(
    "1ef25efb2be22235d221e0570bf57efd2b5483a39088cff6e9144b1125696632"
));

const GUEST_ID: [u32; 8] = [3059853664, 1138407129, 918623963, 946626020, 282452322, 3875698598, 154530926, 35396726];
const VARA_UNIT: u128 = 1_000_000_000_000;
const VARA_DEPOSIT_AMOUNT: u32 = 10;
const DEPOSIT_AMOUNT: u128 = VARA_UNIT * VARA_DEPOSIT_AMOUNT as u128;

#[derive(Clone)]
pub struct DigestWrapper(Impl);

impl rs_merkle::Hasher for DigestWrapper {
    type Hash = [u8; 32];
    fn hash(data: &[u8]) -> Self::Hash {
        (*Impl::hash_bytes(data)).into()
    }
}

pub struct PublicOutputs {
    pub root: [u8; 32],
    pub used: Vec<[u8; 32]>,
}

fn deserialize_public_outputs(bytes: Vec<u8>) -> PublicOutputs {
    let bytes_len = bytes.len();
    assert!(bytes_len >= 132, "Wrong public outputs {:?}", bytes);
    let mut root = [0u8; 32];

    let mut chunks = bytes.chunks_exact(4);
    for i in 0..32 {
        root[i] = chunks.next().unwrap()[0];
    }
    let len = u32::from_le_bytes(chunks.next().unwrap().try_into().unwrap()) as usize;
    assert_eq!(
        bytes_len,
        132 + len * 32 * 4,
        "Wrong public outputs {:?}",
        bytes
    );

    let mut used = Vec::with_capacity(len);
    for _ in 0..len {
        let mut elem = [0u8; 32];
        for i in 0..32 {
            elem[i] = chunks.next().unwrap()[0];
        }
        used.push(elem);
    }
    PublicOutputs { root, used }
}

#[derive(Default)]
pub struct Mixer {
    pub merkle_tree: MerkleTree<DigestWrapper>,
    pub withdrawn: HashSet<[u8; 32]>,
    pub withdrawn_vec: Vec<[u8; 32]>,
    pub history: HashMap<ActorId, Vec<TransactionInfo>>,
}

impl Mixer {
    fn deposit(&mut self, mut hashes: Vec<[u8; 32]>) {
        let hash_len = hashes.len();
        if hash_len as u128 != msg::value() / DEPOSIT_AMOUNT {
            msg::reply(ContractHandleEvent::WrongDeposit, msg::value())
                .expect("Error in wrong deposit reply");
            return;
        }
        self.merkle_tree.append(&mut hashes).commit();

        self.history
            .entry(msg::source())
            .or_insert_with(Vec::new)
            .push(TransactionInfo {
                amount: hash_len as i32,
                time: exec::block_timestamp(),
            });

        msg::reply(ContractHandleEvent::Deposited, 0).expect("Error in reply in deposit");
    }

    async fn withdraw(&mut self, image_id_receipt: Vec<u8>) {
        let image_id: [u32; 8] = postcard::from_bytes(&image_id_receipt).expect("Wrong image id");
        assert_eq!(image_id, GUEST_ID, "Wrong image id in proof");

        let public_outputs = msg::send_bytes_for_reply(RISC0_BUILTIN, image_id_receipt, 0, 0)
            .expect("Error in send_bytes_for_reply in winthdraw")
            .await
            .expect("Error in your zk-proof");

        let PublicOutputs { root, used } = deserialize_public_outputs(public_outputs);

        assert!(
            self.merkle_tree
                .history
                .iter()
                .rfind(|&&x| x == root)
                .is_some(),
            "There has never been such a root"
        );

        let mut amount = 0;
        for u in used {
            if let gstd::collections::hash_set::Entry::Vacant(e) = self.withdrawn.entry(u) {
                amount += 1;
                e.insert();
                self.withdrawn_vec.push(u);
            }
        }

        self.history
            .entry(msg::source())
            .or_insert_with(Vec::new)
            .push(TransactionInfo {
                amount: -(amount as i32),
                time: exec::block_timestamp(),
            });

        msg::reply(ContractHandleEvent::Withdrawed, amount * DEPOSIT_AMOUNT)
            .expect("Error in reply in withdraw");
    }
}

static mut MIXER: Option<Mixer> = None;

#[no_mangle]
unsafe extern "C" fn init() {
    MIXER = Some(Mixer {
        ..Default::default()
    });
}

#[gstd::async_main]
async fn main() {
    let action: ContractHandleAction = msg::load().expect("Unable to decode ContractHandleAction");
    let mixer = unsafe { MIXER.get_or_insert(Default::default()) };

    match action {
        ContractHandleAction::Deposit { hashes } => mixer.deposit(hashes),
        ContractHandleAction::Withdraw { image_id_receipt } => {
            mixer.withdraw(image_id_receipt).await
        }
    };
}

#[no_mangle]
extern "C" fn state() {
    let payload: StatePayload = msg::load().expect("Error in decoding payload in state function");
    let mixer = unsafe { MIXER.take().unwrap_or_default() };
    match payload {
        StatePayload::Leaves => {
            let res = mixer.merkle_tree.leaves().unwrap_or_default();
            msg::reply(StateOutput::Leaves { res }, 0).expect("Failed to share state");
        }
        StatePayload::Withdrawn { from } => {
            let res = mixer.withdrawn_vec.get(from as usize..).unwrap_or_default().to_vec();
            msg::reply(StateOutput::Withdrawn { res }, 0).expect("Failed to share state");
        }
        StatePayload::WithdrawnAll => {
            let res = mixer.withdrawn_vec;
            msg::reply(StateOutput::Withdrawn { res }, 0).expect("Failed to share state");
        }
        StatePayload::HistoryOneFrom{user, from} => {
            let res = mixer
            .history
            .get(&user)
            .map(|history| history.get(from as usize..).unwrap_or_default().to_vec())
            .filter(|history_from| history_from.len() != 0)
            .unwrap_or_default();
            msg::reply(StateOutput::HistoryOneFrom { res }, 0).expect("Failed to share state");
        }
        StatePayload::HistoryFrom(users_from) => {
            let res = users_from
                .into_iter()
                .filter_map(|(user, from)| {
                    mixer
                        .history
                        .get(&user)
                        .map(|history| (user, history.get(from as usize..).unwrap_or_default().to_vec()))
                        .filter(|(_, history_from)| history_from.len() != 0)
                })
                .collect();
            msg::reply(StateOutput::HistoryFrom { res }, 0).expect("Failed to share state");
        }
        StatePayload::HistoryAll => {
            let res = mixer.history.into_iter().collect();
            msg::reply(StateOutput::HistoryAll { res }, 0).expect("Failed to share state");
        }
    }
}
