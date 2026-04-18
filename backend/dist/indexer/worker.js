"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscrowWorker = void 0;
const web3_js_1 = require("@solana/web3.js");
const queries_1 = require("../db/queries");
class EscrowWorker {
    constructor(sdk, intervalMs = parseInt(process.env.WORKER_INTERVAL_MS ?? "30000", 10)) {
        this.sdk = sdk;
        this.intervalMs = intervalMs;
        this.timer = null;
        this.running = false;
    }
    start() {
        if (this.timer)
            return;
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
        if (this.running)
            return;
        this.running = true;
        try {
            const nowUnix = Math.floor(Date.now() / 1000);
            const releasable = await (0, queries_1.getEscrowsEligibleForRelease)(nowUnix);
            for (const escrow of releasable) {
                try {
                    await this.sdk.escrow.releaseFunds(BigInt(escrow.escrow_id), new web3_js_1.PublicKey(escrow.receiver));
                    console.log(`[worker] Released escrow ${escrow.escrow_id}`);
                }
                catch (error) {
                    console.error(`[worker] Failed to release escrow ${escrow.escrow_id}:`, error);
                }
            }
            const refundable = await (0, queries_1.getEscrowsEligibleForRefund)(nowUnix);
            for (const escrow of refundable) {
                try {
                    await this.sdk.escrow.refund(BigInt(escrow.escrow_id), new web3_js_1.PublicKey(escrow.payer));
                    console.log(`[worker] Refunded escrow ${escrow.escrow_id}`);
                }
                catch (error) {
                    console.error(`[worker] Failed to refund escrow ${escrow.escrow_id}:`, error);
                }
            }
        }
        finally {
            this.running = false;
        }
    }
}
exports.EscrowWorker = EscrowWorker;
