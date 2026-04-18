import { PublicKey } from "@solana/web3.js";
import { FingerprintSDK } from "@fingerprint/sdk";
import {
  getEscrowsEligibleForRefund,
  getEscrowsEligibleForRelease,
} from "../db/queries";

export class EscrowWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private sdk: FingerprintSDK,
    private intervalMs = parseInt(process.env.WORKER_INTERVAL_MS ?? "30000", 10)
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((error) => {
        console.error("[worker] Tick failed:", error);
      });
    }, this.intervalMs);

    void this.tick();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    if (this.running) return;
    this.running = true;

    try {
      const nowUnix = Math.floor(Date.now() / 1000);

      const releasable = await getEscrowsEligibleForRelease(nowUnix);
      for (const escrow of releasable) {
        try {
          await this.sdk.escrow.releaseFunds(
            BigInt(escrow.escrow_id),
            new PublicKey(escrow.receiver)
          );
          console.log(`[worker] Released escrow ${escrow.escrow_id}`);
        } catch (error) {
          console.error(`[worker] Failed to release escrow ${escrow.escrow_id}:`, error);
        }
      }

      const refundable = await getEscrowsEligibleForRefund(nowUnix);
      for (const escrow of refundable) {
        try {
          await this.sdk.escrow.refund(
            BigInt(escrow.escrow_id),
            new PublicKey(escrow.payer)
          );
          console.log(`[worker] Refunded escrow ${escrow.escrow_id}`);
        } catch (error) {
          console.error(`[worker] Failed to refund escrow ${escrow.escrow_id}:`, error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
