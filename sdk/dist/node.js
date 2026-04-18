"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSDKFromKeypair = createSDKFromKeypair;
const nodewallet_1 = __importDefault(require("@coral-xyz/anchor/dist/cjs/nodewallet"));
const web3_js_1 = require("@solana/web3.js");
const browser_1 = require("./browser");
function createSDKFromKeypair(keypair, rpcUrl, idls) {
    const connection = new web3_js_1.Connection(rpcUrl, "confirmed");
    const wallet = new nodewallet_1.default(keypair);
    return new browser_1.FingerprintSDK({
        connection,
        wallet,
        escrowIdl: idls.escrow,
        attestationIdl: idls.attestation,
        disputeIdl: idls.dispute,
    });
}
