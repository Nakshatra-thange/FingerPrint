import { useState } from "react";
import { useEscrowStore } from "@/store/escrowStore";
import { mockEscrows, MOCK_WALLET } from "@/data/mockEscrows";
import { EscrowCard } from "@/components/EscrowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const DISPUTE_OPTIONS = [
  { value: "3600", label: "1 hour" },
  { value: "21600", label: "6 hours" },
  { value: "86400", label: "24 hours" },
  { value: "259200", label: "72 hours" },
];

export default function Dashboard() {
  const { walletAddress, createEscrow } = useEscrowStore();
  const myEscrows = mockEscrows.filter((e) => e.payer === MOCK_WALLET);

  const [description, setDescription] = useState("");
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState<Date>();
  const [attestors, setAttestors] = useState<string[]>([""]);
  const [threshold, setThreshold] = useState(1);
  const [disputeWindow, setDisputeWindow] = useState("86400");

  const addAttestor = () => {
    if (attestors.length < 10) setAttestors([...attestors, ""]);
  };
  const removeAttestor = (i: number) => {
    if (attestors.length > 1) setAttestors(attestors.filter((_, idx) => idx !== i));
  };
  const updateAttestor = (i: number, v: string) => {
    const next = [...attestors];
    next[i] = v;
    setAttestors(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEscrow({
      eventDescription: description,
      receiver,
      amountLamports: String(Number(amount) * 1_000_000_000),
      threshold,
      attestors,
      disputeWindowSeconds: disputeWindow,
    });
  };

  if (!walletAddress) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground text-lg">Connect your wallet to create and manage escrows.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold mb-6">Create Escrow</h1>
        <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-6 space-y-5 max-w-2xl">
          <div className="space-y-2">
            <Label>Event Description</Label>
            <div className="relative">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 256))}
                placeholder="Describe the deliverable or milestone..."
                className="resize-none"
                rows={3}
              />
              <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                {description.length}/256
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Receiver Wallet</Label>
              <Input
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                placeholder="Solana address..."
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (SOL)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Deadline</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !deadline && "text-muted-foreground")}
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
                    disabled={(d) => d < new Date()}
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
                  {DISPUTE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Attestors</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addAttestor} disabled={attestors.length >= 10}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {attestors.map((addr, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={addr}
                  onChange={(e) => updateAttestor(i, e.target.value)}
                  placeholder={`Attestor ${i + 1} wallet address`}
                  className="font-mono text-sm"
                />
                {attestors.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeAttestor(i)}>
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
                value={threshold}
                onChange={(e) => setThreshold(Math.min(Math.max(1, Number(e.target.value)), attestors.length))}
                min={1}
                max={attestors.length}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">of {attestors.length} attestors</span>
            </div>
          </div>

          <Button type="submit" className="w-full">Lock Funds</Button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Your Escrows</h2>
        {myEscrows.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-8 text-center">
            <p className="text-muted-foreground">No escrows locked yet. Create one above.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {myEscrows.map((e) => (
              <EscrowCard key={e.escrowId} escrow={e} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
