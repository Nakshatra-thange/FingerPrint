use anchor_lang::prelude::*;
declare_id!("6MXh43qNLot7M8B7K2W1eshywgZecDRfkLazRKLmQZ5S");

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

        let escrow = &mut ctx.accounts.escrow_account;
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
        escrow.threshold_met_at = Some(Clock::get()?.unix_timestamp);
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

        let seeds = [
            b"vault",
            &escrow_id.to_le_bytes()[..],
            &[ctx.bumps.escrow_vault],

        ];

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
            &escrow_id.to_le_bytes()[..],
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
pub fn resolve_dispute(
    ctx: Context<ResolveDispute>,
    escrow_id: u64,
    release_to_receiver: bool,
) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow_account;

    require!(
        escrow.status == EscrowStatus::Disputed,
        EscrowError::InvalidStatus
    );
    require!(
        ctx.accounts.dispute_program.key() == crate::DISPUTE_PROGRAM_ID,
        EscrowError::Unauthorized
    );

    let seeds = &[
        b"vault",
        &escrow_id.to_le_bytes()[..],
        &[ctx.bumps.escrow_vault],
    ];
    let signer = &[&seeds[..]];

    if release_to_receiver {
        escrow.status = EscrowStatus::Released;
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.receiver.to_account_info(),
            },
            signer,
        );
        anchor_lang::system_program::transfer(cpi_context, escrow.amount)?;
    } else {
        escrow.status = EscrowStatus::Refunded;
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.payer.to_account_info(),
            },
            signer,
        );
        anchor_lang::system_program::transfer(cpi_context, escrow.amount)?;
    }

    emit!(DisputeResolved {
        escrow_id,
        release_to_receiver,
    });

    Ok(())
}

pub const ATTESTATION_PROGRAM_ID: Pubkey = pubkey!("dTydWteGkLkpESKHHW9QeRFD5yBDe3CAjZPVuKrNxCX");
pub const DISPUTE_PROGRAM_ID: Pubkey = pubkey!("HtcJfyMQodiZZx6D2MwRT8DiwXL7Lgwd9P16HbvpDRc4");

#[account]
pub struct EscrowAccount {
    pub escrow_id: u64,            // 8
    pub payer: Pubkey,             // 32
    pub receiver: Pubkey,          // 32
    pub event_description: String, // 4 + 256
    pub required_attestors: Vec<Pubkey>, // 4 + 10*32
    pub threshold: u8,             // 1
    pub amount: u64,               // 8
    pub deadline: i64,             // 8
    pub dispute_window_seconds: i64, // 8
    pub status: EscrowStatus,      // 1
    pub threshold_met_at: Option<i64>, // 1 + 8
    pub created_at: i64,           // 8
    pub bump: u8,                  // 1
}
 
impl EscrowAccount {
    pub const MAX_SIZE: usize = 8    // discriminator
        + 8                          // escrow_id
        + 32                         // payer
        + 32                         // receiver
        + (4 + 256)                  // event_description
        + (4 + 10 * 32)              // required_attestors (max 10)
        + 1                          // threshold
        + 8                          // amount
        + 8                          // deadline
        + 8                          // dispute_window_seconds
        + 1                          // status
        + 9                          // threshold_met_at (Option<i64>)
        + 8                          // created_at
        + 1;                         // bump
}
 
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowStatus {
    Active,
    ThresholdMet,
    Disputed,
    Released,
    Refunded,
}

// ─── Instruction contexts ─────────────────────────────────────────────────────
 
#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct CreateEscrow<'info> {
    #[account(
        init,
        payer = payer,
        space = EscrowAccount::MAX_SIZE,
        seeds = [b"escrow", escrow_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
 
    /// CHECK: Vault PDA that holds SOL — no data, just lamports
    #[account(
        mut,
        seeds = [b"vault", escrow_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_vault: AccountInfo<'info>,
 
    #[account(mut)]
    pub payer: Signer<'info>,
 
    /// CHECK: Receiver address, validated by payer
    pub receiver: AccountInfo<'info>,
 
    pub system_program: Program<'info, System>,
}
 
#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct MarkThresholdMet<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_id.to_le_bytes().as_ref()],
        bump = escrow_account.bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
 
    /// CHECK: Must be the attestation program
    pub attestation_program: AccountInfo<'info>,
}
 
#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct ReleaseFunds<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_id.to_le_bytes().as_ref()],
        bump = escrow_account.bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
 
    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [b"vault", escrow_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_vault: AccountInfo<'info>,
 
    /// CHECK: Receiver — validated against escrow_account.receiver
    #[account(
        mut,
        constraint = receiver.key() == escrow_account.receiver @ EscrowError::WrongReceiver
    )]
    pub receiver: AccountInfo<'info>,
 
    pub system_program: Program<'info, System>,
}
 
#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct Refund<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_id.to_le_bytes().as_ref()],
        bump = escrow_account.bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
 
    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [b"vault", escrow_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_vault: AccountInfo<'info>,
 
    #[account(mut)]
    pub payer: Signer<'info>,
 
    pub system_program: Program<'info, System>,
}
 
#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct FreezeForDispute<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_id.to_le_bytes().as_ref()],
        bump = escrow_account.bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
 
    /// CHECK: Must be the dispute program
    pub dispute_program: AccountInfo<'info>,
}
 
#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct ResolveDispute<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow_id.to_le_bytes().as_ref()],
        bump = escrow_account.bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
 
    /// CHECK: Vault PDA
    #[account(
        mut,
        seeds = [b"vault", escrow_id.to_le_bytes().as_ref()],
        bump
    )]
    pub escrow_vault: AccountInfo<'info>,
 
    /// CHECK: Receiver
    #[account(
        mut,
        constraint = receiver.key() == escrow_account.receiver @ EscrowError::WrongReceiver
    )]
    pub receiver: AccountInfo<'info>,
 
    /// CHECK: Payer
    #[account(
        mut,
        constraint = payer.key() == escrow_account.payer @ EscrowError::Unauthorized
    )]
    pub payer: AccountInfo<'info>,
 
    /// CHECK: Must be dispute program
    pub dispute_program: AccountInfo<'info>,
 
    pub system_program: Program<'info, System>,
}
 
// ─── Events ──────────────────────────────────────────────────────────────────
 
#[event]
pub struct EscrowCreated {
    pub escrow_id: u64,
    pub payer: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
    pub threshold: u8,
    pub deadline: i64,
}
 
#[event]
pub struct ThresholdMet {
    pub escrow_id: u64,
    pub timestamp: i64,
}
 
#[event]
pub struct FundsReleased {
    pub escrow_id: u64,
    pub receiver: Pubkey,
    pub amount: u64,
}
 
#[event]
pub struct FundsRefunded {
    pub escrow_id: u64,
    pub payer: Pubkey,
    pub amount: u64,
}
 
#[event]
pub struct EscrowFrozen {
    pub escrow_id: u64,
    pub timestamp: i64,
}
 
#[event]
pub struct DisputeResolved {
    pub escrow_id: u64,
    pub release_to_receiver: bool,
}
 
// ─── Errors ──────────────────────────────────────────────────────────────────
 
#[error_code]
pub enum EscrowError {
    #[msg("Event description exceeds 256 characters")]
    DescriptionTooLong,
    #[msg("Threshold must be > 0 and <= number of attestors")]
    InvalidThreshold,
    #[msg("Maximum 10 attestors allowed")]
    TooManyAttestors,
    #[msg("Amount must be > 0")]
    ZeroAmount,
    #[msg("Deadline must be in the future")]
    DeadlineInPast,
    #[msg("Escrow is not in the expected status")]
    InvalidStatus,
    #[msg("Caller is not authorized")]
    Unauthorized,
    #[msg("Dispute window is still active")]
    DisputeWindowActive,
    #[msg("Deadline has not passed yet")]
    DeadlineNotPassed,
    #[msg("Wrong receiver account")]
    WrongReceiver,
    #[msg("Arithmetic overflow")]
    Overflow,
}















    }
    












  
