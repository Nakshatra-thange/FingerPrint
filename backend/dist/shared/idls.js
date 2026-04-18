"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disputeIdl = exports.attestationIdl = exports.escrowIdl = void 0;
const path_1 = __importDefault(require("path"));
const idlRoot = path_1.default.resolve(__dirname, "../../../fingerprint/target/idl");
exports.escrowIdl = require(path_1.default.join(idlRoot, "escrow.json"));
exports.attestationIdl = require(path_1.default.join(idlRoot, "attestation.json"));
exports.disputeIdl = require(path_1.default.join(idlRoot, "dispute.json"));
