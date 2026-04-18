"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.keypairFromBase58OrGenerate = keypairFromBase58OrGenerate;
exports.createNodeSdk = createNodeSdk;
const bs58_1 = __importDefault(require("bs58"));
const dotenv_1 = __importDefault(require("dotenv"));
const web3_js_1 = require("@solana/web3.js");
const sdk_1 = require("@fingerprint/sdk");
const idls_1 = require("./idls");
dotenv_1.default.config();
function keypairFromBase58OrGenerate(secret) {
    return secret ? web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(secret)) : web3_js_1.Keypair.generate();
}
function createNodeSdk(secret, rpcUrl) {
    const keypair = keypairFromBase58OrGenerate(secret);
    const sdk = (0, sdk_1.createSDKFromKeypair)(keypair, rpcUrl ?? process.env.SOLANA_RPC_URL ?? "http://localhost:8899", {
        escrow: idls_1.escrowIdl,
        attestation: idls_1.attestationIdl,
        dispute: idls_1.disputeIdl,
    });
    return { keypair, sdk };
}
