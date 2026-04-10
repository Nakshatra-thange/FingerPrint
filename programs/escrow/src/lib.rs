use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
declare_id("EscR1111111111111111111111111111111111111111");

#[program]
pub mod escrow{
    use super::*; 
    pub fn create_escrow(
        ctx:Context<CreateEscrow>,
        escrow_id:u64,
        event_description:String,
        required_attestors:Vec<Pubkey>,
        threshold:u8,
        amount:u64,
        deadline:i64,
        dispute_window_seconds:i64,
    ) -> Result<()> {
        require!(
            threshold > 0 && threshold as usize <= required_attestors.len(),
            EscrowError::InvalidThreshold
        );
        require!(
            required_attestors.len() <= 10,
            EscrowError::TooManyAttestors
        );
        require!(amount > 0, EscrowError::ZeroAmount);
        require!(
            deadline > Clock::get()?.unix_timestamp,
            EscrowError::DeadlineInPast
        );
    }

}
