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

        let esrcow = &mut ctx.accounts.escrow_account;
        escrow.escrow_id= escrow_id;
        escrow.payer = ctx.accounts.payer.key();
        escrow.receiver = ctx.accounts.receiver.key();
        escrow.event_description = event_description;
        escrow.required_attestors = required_attestors;
        escrow.threshold = threshold;
        escrow.amount = amount;
        escrow.deadline = deadline;
        escrow.dispute_window_seconds = dispute_window_seconds;
        escrow.bump = ctx.bumps.escrow_account;
        escrow.status = EscrowStatus::Active;
        escrow.threshold_met_at = None;
        escrow.created_at = Clock::get()?.unix_timestamp;

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.escrow_vault.to_account_info(),

            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;
        emit!(EscrowCreated {
            escrow_id,
            payer: ctx.accounts.payer.key(),
            receiver: ctx.accounts.receiver.key(),
            amount,
            threshold,
            deadline,
        });
 
        Ok(())
    }

    pub fn mark_threshold_met(
        ctx:Context<MarkThresholdMet>,
        escrow_id:u64
    )-> Result<()>{
        let escrow = &mut ctx.accounts.escrow_account;
        require!(
            escrow.status == EscrowStatus::Active,
            EscrowError::InvalidStatus
        );

        require!(
            ctx.accounts.attestation_program.key() == crate::ATTESTATION_PROGRAM_ID,
            EscrowError::Unauthorized
        );

        escrow.status = EscrowStatus::ThresholdMet;
        escorw.threshold_met_at = Some(Clock::get()?.unix_timestamp);
        emit!(ThresholdMet {
            escrow_id,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())

    }

    pub fn release_funds(
        ctx: Context<ReleaseFunds>, 
        escrow_id: u64
    )-> Result<()>{

        let escrow = &mut ctx.accounts.escrow_account;
        let clock = Clock::get()?;

        require!(
            escrow.status == EscrowStatus::ThresholdMet,
            EscrowError::InvalidStatus
        );

        


    }
    












    }

}
