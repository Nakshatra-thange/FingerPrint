use anchor_lang::prelude::*;
use escorw::cpi::accounts::{FreezeForDispute, ResolveDispute as EscrowResolveDispute};
use escorw::program::Escrow;

declare_id!("DiSp1111111111111111111111111111111111111111");
pub const RESOLVER: pubkey!("ReSo1111111111111111111111111111111111111111");

#[program]
pub mod dispute {
    use super::*;
    pub fn open_dispute(
        ctx: Context<OpenDispute>,
        escrow_id: u64,
        reason: String,
        counter_evidence_cid: Option<String>,

    )->Result<()> {
        require!(reason.len()<= 512, DisputeError::ReasonTooLong);

        if let Some(ref cid) = counter_evidence_cid {
            require!(cid.len() <= 64, DisputeError::CidTooLong);
        }

        require!(
            ctx.accounts.disuter.key()==ctx.accounts.escrow_account.payer,
            DisputeError::OnlyPayerCanDispute
        );

        let escorw = &ctx.accounts.escrow_account;
        let clock = Clock::get()?;
        let threshold_met_at = escrow.threshold_met_at
            .ok_or(DisputeError::Overflow)?;
        let dispute_window_end = threshold_met_at
            .checked_add(escrow.dispute_window_seconds)
            .ok_or(DisputeError::Overflow)?;
        require!(
                clock.unix_timestamp < dispute_window_end,
                DisputeError::DisputeWindowClosed
            );

        let dispute_record = &mut ctx.accounts.dispute_record;
        dispute_record.escrow_id = escrow_id;
        dispute_record.disputer = ctx.accounts.disputer.key();
        dispute_record.reason = reason.clone();
        dispute_record.counter_evidence_cid = counter_evidence_cid.clone();
        dispute_record.status = DisputeStatus::Open;
        dispute_record.opened_at = clock.unix_timestamp;
        dispute_record.resolved_at = None;
        dispute_record.resolver_notes = None;
        dispute_record.bump = ctx.bumps.dispute_record;

        let cpi_program = ctx.account.escrow_program.to_account_info();
        let cpi_accounts = FreezeForDispute{
            escrow_account: ctx.accounts.escrow_account.to_account_info(),
            dispute_program: ctx.accounts.dispute_self.to_account_info(),
        }
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        escrow::cpi::freeze_for_dispute(cpi_ctx, escrow_id)?;

        emit!(DisputeOpened {
            escrow_id,
            disputer: ctx.accounts.disputer.key(),
            reason,
            counter_evidence_cid,
        });

        Ok(())

    }

    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        escrow_id: u64,
        release_to_receiver: bool,
        resolver_notes: Option<String>,

    )->Result<()>{
        require!(
            ctx.accounts.resolver.key() == RESOLVER,
            DisputeError::NotAuthorizedResolver
        );

        if let Some(ref notes) = resolver_notes {
            require!(notes.len() <= 512, DisputeError::NotesTooLong);
        }

        let dispute_record = &mut ctx.accounts.dispute_record;
        require!(
            dispute_record.status == DisputeStatus::Open,
            DisputeError::DisputeNotOpen
        );

        dispute_record.status = if release_to_receiver {
            DisputeStatus::ResolvedForReceiver
        } else {
            DisputeStatus::ResolvedForPayer
        };
        dispute_record.resolved_at = Some(Clock::get()?.unix_timestamp);
        dispute_record.resolver_notes = resolver_notes.clone();

        let cpi_program = ctx.accounts.escrow_program.to_account_info();
        let cpi_accounts = EscrowResolveDispute{
            escrow_account: ctx.accounts.escrow_account.to_account_info(),
            escrow_vault: ctx.accounts.escrow_vault.to_account_info(),
            receiver: ctx.accounts.receiver.to_account_info(),
            payer: ctx.accounts.payer_account.to_account_info(),
            dispute_program: ctx.accounts.dispute_self.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),

        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        escrow::cpi::resolve_dispute(cpi_ctx, escrow_id, release_to_receiver)?;

        emit!(DisputeResolved {
            escrow_id,
            release_to_receiver,
            resolver_notes,
        });

        Ok(());
    }

}

#[account]
pub struct DisputeRecord {
    pub escrow_id: u64,                      // 8
    pub disputer: Pubkey,                    // 32
    pub reason: String,                      // 4 + 512
    pub counter_evidence_cid: Option<String>, // 1 + 4 + 64
    pub status: DisputeStatus,               // 1
    pub opened_at: i64,                      // 8
    pub resolved_at: Option<i64>,            // 9
    pub resolver_notes: Option<String>,      // 1 + 4 + 512
    pub bump: u8,                            // 1
}

impl DisputeRecord {
    pub const MAX_SIZE: usize = 8
    + 8
    + 32
    + (4 + 512)
    + (1 + 4 + 64)
    + 1
    + 8
    + 9
    + (1 + 4 + 512)
    + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum DisputeStatus {
    Open,
    ResolvedForReceiver,
    ResolvedForPayer,
}

#[derive(Accounts)]
#[instruction(escrow_id:u64)]
pub struct OpenDispute<'info>{
    #[account(
        init,
        payer = disputer,
        space = DisputeRecord::MAX_SIZE,
        seeds = [b"dispute", escrow_id.to_le_bytes().as_ref()],
        bump
    )]

    pub dispute_record: Account<'info, DisputeRecord>,
    #[account(mut)]
    pub escrow_account: Account<'info, escrow::EscrowAccount>,
 
    #[account(mut)]
    pub disputer: Signer<'info>,
 
    pub escrow_program: Program<'info, Escrow>,
 
    /// CHECK: This program's own ID
    #[account(address = crate::ID)]
    pub dispute_self: AccountInfo<'info>,
 
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct ResolveDispute<'info> {
    #[account(
        mut,
        seeds = [b"dispute", escrow_id.to_le_bytes().as_ref()],
        bump = dispute_record.bump
    )]
    pub dispute_record: Account<'info, DisputeRecord>,
 
    /// CHECK: Escrow account
    #[account(mut)]
    pub escrow_account: Account<'info, escrow::EscrowAccount>,
 
    /// CHECK: Vault PDA
    #[account(mut)]
    pub escrow_vault: AccountInfo<'info>,
 
    /// CHECK: Receiver
    #[account(mut)]
    pub receiver: AccountInfo<'info>,
 
    /// CHECK: Payer
    #[account(mut)]
    pub payer_account: AccountInfo<'info>,
 
    pub resolver: Signer<'info>,
 
    pub escrow_program: Program<'info, Escrow>,
 
    /// CHECK: This program's own ID
    #[account(address = crate::ID)]
    pub dispute_self: AccountInfo<'info>,
 
    pub system_program: Program<'info, System>,
}



#[event]
pub struct DisputeOpened {
    pub escrow_id: u64,
    pub disputer: Pubkey,
    pub reason: String,
    pub counter_evidence_cid: Option<String>,
}
 
#[event]
pub struct DisputeResolved {
    pub escrow_id: u64,
    pub release_to_receiver: bool,
    pub resolver_notes: Option<String>,
}

#[error_code]
pub enum DisputeError {
    #[msg("Reason must be 512 characters or fewer")]
    ReasonTooLong,
    #[msg("Evidence CID must be 64 characters or fewer")]
    CidTooLong,
    #[msg("Only the payer can open a dispute")]
    OnlyPayerCanDispute,
    #[msg("Threshold has not been met yet — nothing to dispute")]
    ThresholdNotMet,
    #[msg("The dispute window has already closed")]
    DisputeWindowClosed,
    #[msg("Caller is not the authorised resolver")]
    NotAuthorizedResolver,
    #[msg("Dispute is not in Open status")]
    DisputeNotOpen,
    #[msg("Resolver notes must be 512 characters or fewer")]
    NotesTooLong,
    #[msg("Arithmetic overflow")]
    Overflow,
}
 
 





        






