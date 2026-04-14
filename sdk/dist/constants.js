"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEEDS = exports.DEFAULT_DISPUTE_WINDOW_SECONDS = exports.DISPUTE_PROGRAM_ID = exports.ATTESTATION_PROGRAM_ID = exports.ESCROW_PROGRAM_ID = void 0;
const web3_js_1 = require("@solana/web3.js");
exports.ESCROW_PROGRAM_ID = new web3_js_1.PublicKey("6MXh43qNLot7M8B7K2W1eshywgZecDRfkLazRKLmQZ5S");
exports.ATTESTATION_PROGRAM_ID = new web3_js_1.PublicKey("dTydWteGkLkpESKHHW9QeRFD5yBDe3CAjZPVuKrNxCX");
exports.DISPUTE_PROGRAM_ID = new web3_js_1.PublicKey("HtcJfyMQodiZZx6D2MwRT8DiwXL7Lgwd9P16HbvpDRc4");
exports.DEFAULT_DISPUTE_WINDOW_SECONDS = 24 * 60 * 60;
exports.SEEDS = {
    ESCROW: "escrow",
    VAULT: "vault",
    REGISTRY: "registry",
    ATTESTATION: "attestation",
    DISPUTE: "dispute",
};
