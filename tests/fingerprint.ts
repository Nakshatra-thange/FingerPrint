import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { Fingerprint } from "../target/types/fingerprint";

describe("fingerprint", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.fingerprint as Program<Fingerprint>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
