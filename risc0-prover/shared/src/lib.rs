use serde::{Deserialize, Serialize};


#[derive(Serialize, Deserialize, Clone, Copy)]
#[repr(C)]
pub struct RustShit(
    pub [u8; 32],
    pub [u8; 32],
);

#[derive(Serialize, Deserialize, Debug)]
pub struct PublicOutputs{
    pub root: [u8; 32],
    pub used: Vec<[u8; 32]>,
}