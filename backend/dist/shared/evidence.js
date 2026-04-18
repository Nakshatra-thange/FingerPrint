"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadEvidenceToIpfs = uploadEvidenceToIpfs;
async function uploadEvidenceToIpfs(input) {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
        throw new Error("PINATA_JWT is not configured");
    }
    const bytes = Buffer.from(input.dataBase64, "base64");
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: input.contentType }), input.fileName);
    form.append("pinataMetadata", JSON.stringify({ name: input.fileName }));
    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${jwt}`,
        },
        body: form,
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Pinata upload failed: ${body}`);
    }
    const json = (await response.json());
    return {
        cid: json.IpfsHash,
        gatewayUrl: `https://gateway.pinata.cloud/ipfs/${json.IpfsHash}`,
    };
}
