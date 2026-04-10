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

        let threshold_met_at = escrow.threshold_met_at.ok_or(EscrowError::InvalidStatus)?;
        let dispute_window_end = threshold_met_at
             .checked_add(escrow.dispute_window_seconds)
             .ok_or(EscrowError::Overflow)?;

         require!(
            clock.unix_timestamp >= dispute_window_end,
            EscrowError::DisputeWindowActive
        );

        escrow.status = EscrowStatus::Released;

        let seeds = &[
            b"vault",
            &escrow_id.to_le_bytes(),
            &[ctx.bumps.escrow_vault],

        ]

        let signer = &[&seeds[..]];
        //imp - allows program to sign on behalf of the PDA --> necessary in anchor

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.receiver.to_account_info(),
            },
            signer,
        );

        anchor_lang::system_program::transfer(cpi_context, escrow.amount)?;
        emit!(FundsReleased {
            escrow_id,
            receiver: ctx.accounts.receiver.key(),
            amount: escrow.amount,
        });

        Ok(())

    }

    pub fn refund(ctx: Context<Refund>, escrow_id: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        let clock = Clock::get()?;
 
        require!(
            escrow.status == EscrowStatus::Active,
            EscrowError::InvalidStatus
        );
        require!(
            clock.unix_timestamp > escrow.deadline,
            EscrowError::DeadlineNotPassed
        );
        require!(
            ctx.accounts.payer.key() == escrow.payer,
            EscrowError::Unauthorized
        );

        escrow.status = EscrowStatus::Refunded;

        let seeds = &[
            b"vault",
            &escrow_id.to_le_bytes(),
            &[ctx.bumps.escrow_vault],
          ];
    let signer = &[&seeds[..]];
    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.escrow_vault.to_account_info(),
            to: ctx.accounts.payer.to_account_info(),
        },
        signer,
    );
    anchor_lang::system_program::transfer(cpi_context, escrow.amount)?;

    emit!(FundsRefunded {
        escrow_id,
        payer: ctx.accounts.payer.key(),
        amount: escrow.amount,
    });

    Ok(())
}
    
    pub fn freeze_for_dispute(ctx: Context<FreezeForDispute>, escrow_id: u64) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow_account;

    require!(
        escrow.status == EscrowStatus::ThresholdMet,
        EscrowError::InvalidStatus
    );
    require!(
        ctx.accounts.dispute_program.key() == crate::DISPUTE_PROGRAM_ID,
        EscrowError::Unauthorized
    );

    escrow.status = EscrowStatus::Disputed;

    emit!(EscrowFrozen {
        escrow_id,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}












    }
    












    }

}
