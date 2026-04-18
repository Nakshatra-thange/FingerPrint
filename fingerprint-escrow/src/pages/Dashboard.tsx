import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { EscrowCard } from "@/components/EscrowCard";
import { useFingerprintSDK } from "@/hooks/useFingerprintSDK";
import { useEscrowStore } from "@/store/escrowStore";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CalendarIcon, Plus, X } from "lucide-react";
import { format } from "date-fns";

const DISPUTE_OPTIONS = [
  { value: "3600", label: "1 hour" },
  { value: "21600", label: "6 hours" },
  { value: "86400", label: "24 hours" },
  { value: "259200", label: "72 hours" },
];

function makeEscrowId() {
  return BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
}

export default function Dashboard() {
  const sdk = useFingerprintSDK();
  const {
    escrows,
    fetchEscrowsForWallet,
    isLoading,
    setError,
    setSuccess,
    walletAddress,
  } = useEscrowStore();

  const [creating, setCreating] = useState(false);
  const [description, setDescription] = useState("");
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState<Date>();
  const [attestors, setAttestors] = useState<string[]>([""]);
  const [threshold, setThreshold] = useState(1);
  const [disputeWindow, setDisputeWindow] = useState("86400");

  useEffect(() => {
    if (walletAddress) {
      void fetchEscrowsForWallet(walletAddress);
    }
  }, [fetchEscrowsForWallet, walletAddress]);

  const addAttestor = () => {
    if (attestors.length < 10) {
      setAttestors((current) => [...current, ""]);
    }
  };

  const removeAttestor = (index: number) => {
    setAttestors((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateAttestor = (index: number, value: string) => {
    setAttestors((current) =>
      current.map((item, currentIndex) => (currentIndex === index ? value : item))
    );
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sdk || !walletAddress) {
      setError("Connect a wallet before creating an escrow.");
      return;
    }

    if (!deadline) {
      setError("Pick a deadline.");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      setSuccess(null);

      const requiredAttestors = attestors
        .map((address) => address.trim())
        .filter(Boolean)
        .map((address) => new PublicKey(address));

      if (requiredAttestors.length === 0) {
        throw new Error("Add at least one attestor.");
      }

      const receiverKey = new PublicKey(receiver.trim());
      const amountLamports = BigInt(Math.round(Number(amount) * 1_000_000_000));
      const escrowId = makeEscrowId();
      const deadlineUnix = Math.floor(deadline.getTime() / 1000);

      await sdk.setupEscrow({
        escrowId,
        eventDescription: description.trim(),
        receiver: receiverKey,
        requiredAttestors,
        threshold,
        amountLamports,
        deadlineUnix,
        disputeWindowSeconds: Number(disputeWindow),
      });

      setDescription("");
      setReceiver("");
      setAmount("");
      setDeadline(undefined);
      setAttestors([""]);
      setThreshold(1);
      setDisputeWindow("86400");
      setSuccess(`Escrow ${escrowId.toString()} created.`);
      await fetchEscrowsForWallet(walletAddress);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message.includes("Transaction failed") ? message : message);
    } finally {
      setCreating(false);
    }
  }

  if (!walletAddress) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg text-muted-foreground">
          Connect your wallet to create and track escrows.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-6 text-2xl font-bold">Create Escrow</h1>
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl space-y-5 rounded-lg border bg-card p-6"
        >
          <div className="space-y-2">
            <Label>Event Description</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, 256))}
              placeholder="Truck TN-07 delivers 200 bags of wheat to warehouse W12"
              rows={3}
            />
            <p className="text-right text-xs text-muted-foreground">{description.length}/256</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Receiver Wallet</Label>
              <Input
                value={receiver}
                onChange={(event) => setReceiver(event.target.value)}
                placeholder="Solana address"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (SOL)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.50"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Deadline</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !deadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deadline}
                    onSelect={setDeadline}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Dispute Window</Label>
              <Select value={disputeWindow} onValueChange={setDisputeWindow}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPUTE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Attestors</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addAttestor}
                disabled={attestors.length >= 10}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </div>

            {attestors.map((attestor, index) => (
              <div key={`${attestor}-${index}`} className="flex gap-2">
                <Input
                  value={attestor}
                  onChange={(event) => updateAttestor(index, event.target.value)}
                  placeholder={`Attestor ${index + 1} wallet address`}
                  className="font-mono text-sm"
                />
                {attestors.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAttestor(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Threshold</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={Math.max(attestors.filter(Boolean).length, 1)}
                className="w-24"
                value={threshold}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  const max = Math.max(attestors.filter(Boolean).length, 1);
                  setThreshold(Math.min(Math.max(next, 1), max));
                }}
              />
              <span className="text-sm text-muted-foreground">
                of {Math.max(attestors.filter(Boolean).length, 1)} attestors
              </span>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={creating || !sdk}>
            {creating ? "Creating..." : "Lock Funds"}
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Your Escrows</h2>
        {isLoading ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">Loading escrows...</p>
          </div>
        ) : escrows.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-8 text-center">
            <p className="text-muted-foreground">No escrows yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {escrows.map((escrow) => (
              <EscrowCard key={escrow.escrowId} escrow={escrow} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
