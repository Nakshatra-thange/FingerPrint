use anchor_lang::prelude::*;
use escrow::cpi::accounts::MarkThresholdMet;
use escrow::program::Escrow;

declare_id!("dTydWteGkLkpESKHHW9QeRFD5yBDe3CAjZPVuKrNxCX");

#[program]
pub mod attestation {
    use super::*;

    pub fn init_registry(
        ctx:Context<InitRegistry>,
        escrow_id: u64,
    )-> Result<()> {
        let registry = &mut ctx.accounts.attestor_registry;
        registry.escrow_id= escrow_id;
        registry.escrow = ctx.accounts.escrow_account.key();
        registry.attestation_count = 0;
        registry.bump = ctx.bumps.attestor_registry;

        registry.required_attestors = ctx.accounts.escrow_account.required_attestors.clone();
        registry.threshold = ctx.accounts.escrow_account.threshold;
        registry.threshold_reached = false;

        emit!(RegistryInitialised {
            escrow_id,
            attestors: registry.required_attestors.clone(),
            threshold: registry.threshold,
        });

        Ok(())
    }

    pub fn submit_attestation(
        ctx: Context<SubmitAttestation>,
        escrow_id: u64,
        evidence_cid: Option<String>,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.attestor_registry;
        let attestor_key = ctx.accounts.attestor.key();
 
        // Verify this attestor is on the approved list
        require!(
            registry.required_attestors.contains(&attestor_key),
            AttestationError::NotAuthorizedAttestor
        );

        require!(
            !ctx.accounts.attestation_record.attested,
            AttestationError::AlreadyAttested
        );

        require!(
            !registry.threshold_reached,
            AttestationError::ThresholdAlreadyReached
        );

        if let Some(ref cid) = evidence_cid {
            require!(cid.len() <= 64, AttestationError::CidTooLong);
        }

        let record = &mut ctx.accounts.attestation_record;
        record.escrow_id = escrow_id;
        record.attestor = attestor_key;
        record.attested = true;
        record.evidence_cid = evidence_cid.clone();
        record.timestamp = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.attestation_record;
 
        registry.attestation_count += 1;

        emit!(AttestationSubmitted {
            escrow_id,
            attestor: attestor_key,
            count: registry.attestation_count,
            threshold: registry.threshold,
            evidence_cid,
        });

        if registry.attestation_count >= registry.threshold {
            registry.threshold_reached = true;

            let cpi_program = ctx.accounts.escrow_program.to_account_info();
            let cpi_accounts = MarkThresholdMet {
                escrow_account: ctx.accounts.escrow_account.to_account_info(),
                attestation_program: ctx.accounts.attestation_self.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            escrow::cpi::mark_threshold_met(cpi_ctx, escrow_id)?;
            emit!(ThresholdReached {
                escrow_id,
                count: registry.attestation_count,
            });
        }

        Ok(())
    }

    pub fn check_attestation(
        ctx: Context<CheckAttestation>,
        _escrow_id: u64,
    ) -> Result<bool> {
        Ok(ctx.accounts.attestation_record.attested)
    }
}

#[account]
pub struct AttestorRegistry {
    pub escrow_id: u64,                  // 8
    pub escrow: Pubkey,                  // 32
    pub required_attestors: Vec<Pubkey>, // 4 + 10*32
    pub threshold: u8,                   // 1
    pub attestation_count: u8,           // 1
    pub threshold_reached: bool,         // 1
    pub bump: u8,                        // 1
}
 
impl AttestorRegistry {
    pub const MAX_SIZE: usize = 8
        + 8
        + 32
        + (4 + 10 * 32)
        + 1
        + 1
        + 1
        + 1;
}
 
#[account]
pub struct AttestationRecord {
    pub escrow_id: u64,            // 8
    pub attestor: Pubkey,          // 32
    pub attested: bool,            // 1
    pub evidence_cid: Option<String>, // 1 + 4 + 64
    pub timestamp: i64,            // 8
    pub bump: u8,                  // 1
}
 
impl AttestationRecord {
    pub const MAX_SIZE: usize = 8
        + 8
        + 32
        + 1
        + (1 + 4 + 64)
        + 8
        + 1;
}
#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct InitRegistry<'info> {
    #[account(
        init,
        payer = payer,
        space = AttestorRegistry::MAX_SIZE,
        seeds = [b"registry", escrow_id.to_le_bytes().as_ref()],
        bump
    )]
    pub attestor_registry: Account<'info, AttestorRegistry>,
 
    /// CHECK: Read-only escrow account to copy attestors from
    pub escrow_account: Account<'info, escrow::escrow::EscrowAccount>,
 
    #[account(mut)]
    pub payer: Signer<'info>,
 
    pub system_program: Program<'info, System>,
}
 
#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct SubmitAttestation<'info> {
    #[account(
        mut,
        seeds = [b"registry", escrow_id.to_le_bytes().as_ref()],
        bump = attestor_registry.bump
    )]
    pub attestor_registry: Account<'info, AttestorRegistry>,
 
    #[account(
        init_if_needed,
        payer = attestor,
        space = AttestationRecord::MAX_SIZE,
        seeds = [
            b"attestation",
            escrow_id.to_le_bytes().as_ref(),
            attestor.key().as_ref()
        ],
        bump
    )]
    pub attestation_record: Account<'info, AttestationRecord>,
 
    /// CHECK: Escrow account — passed to CPI if threshold is met
    #[account(mut)]
    pub escrow_account: AccountInfo<'info>,
 
    #[account(mut)]
    pub attestor: Signer<'info>,
 
    pub escrow_program: Program<'info, Escrow>,
 
    /// CHECK: This program's own ID, passed as the "caller" to escrow CPI
    #[account(address = crate::ID)]
    pub attestation_self: AccountInfo<'info>,
 
    pub system_program: Program<'info, System>,
}
 
#[derive(Accounts)]
#[instruction(escrow_id: u64)]
pub struct CheckAttestation<'info> {
    #[account(
        seeds = [
            b"attestation",
            escrow_id.to_le_bytes().as_ref(),
            attestor.key().as_ref()
        ],
        bump = attestation_record.bump
    )]
    pub attestation_record: Account<'info, AttestationRecord>,
 
    /// CHECK: The attestor being queried
    pub attestor: AccountInfo<'info>,
}


#[event]
pub struct RegistryInitialised {
    pub escrow_id: u64,
    pub attestors: Vec<Pubkey>,
    pub threshold: u8,
}
 
#[event]
pub struct AttestationSubmitted {
    pub escrow_id: u64,
    pub attestor: Pubkey,
    pub count: u8,
    pub threshold: u8,
    pub evidence_cid: Option<String>,
}
 
#[event]
pub struct ThresholdReached {
    pub escrow_id: u64,
    pub count: u8,
}

#[error_code]
pub enum AttestationError {
    #[msg("Attestor is not on the approved list for this escrow")]
    NotAuthorizedAttestor,
    #[msg("This attestor has already attested")]
    AlreadyAttested,
    #[msg("Threshold has already been reached")]
    ThresholdAlreadyReached,
    #[msg("Evidence CID must be 64 characters or fewer")]
    CidTooLong,
}

 
