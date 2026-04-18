import path from "path";

const idlRoot = path.resolve(__dirname, "../../../fingerprint/target/idl");

export const escrowIdl = require(path.join(idlRoot, "escrow.json"));
export const attestationIdl = require(path.join(idlRoot, "attestation.json"));
export const disputeIdl = require(path.join(idlRoot, "dispute.json"));
