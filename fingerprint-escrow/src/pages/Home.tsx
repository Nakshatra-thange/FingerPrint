import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Users, Clock, Lock, ArrowRight, CheckCircle, Fingerprint } from "lucide-react";

const features = [
  {
    icon: Lock,
    title: "Lock Funds in Escrow",
    description:
      "SOL is held securely on-chain until all conditions are met. No single party can withdraw unilaterally.",
  },
  {
    icon: Users,
    title: "Multi-Party Attestation",
    description:
      "Define a group of attestors and a threshold. Funds release only when enough independent parties confirm the event.",
  },
  {
    icon: Clock,
    title: "Dispute Windows",
    description:
      "After threshold is reached, a configurable dispute window gives all parties time to raise concerns before release.",
  },
  {
    icon: Shield,
    title: "Fully Transparent",
    description:
      "Every escrow, attestation, and release is recorded on Solana. Anyone can verify the state in the Explorer.",
  },
];

const steps = [
  { number: "01", text: "Payer creates an escrow, defining the receiver, attestors, threshold, and deadline." },
  { number: "02", text: "Attestors independently verify the real-world event and submit their attestations on-chain." },
  { number: "03", text: "Once the threshold is met and the dispute window passes, the receiver claims the funds." },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(163_100%_50%/0.06),transparent_70%)]" />
        <div className="container relative flex flex-col items-center text-center py-24 md:py-36 px-4">
          <div
            className="flex items-center gap-2.5 text-primary mb-6 opacity-0 translate-y-6"
            style={{ animation: "home-fade-up 0.7s ease-out 0.05s forwards" }}
          >
            <Fingerprint className="h-8 w-8 md:h-10 md:w-10" />
            <span className="text-2xl md:text-3xl font-bold tracking-tight">Fingerprint</span>
          </div>
          <h1
            className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl opacity-0 translate-y-6"
            style={{ animation: "home-fade-up 0.7s ease-out 0.15s forwards" }}
          >
            Trust, verified by consensus
          </h1>
          <p
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed opacity-0 translate-y-6"
            style={{ animation: "home-fade-up 0.7s ease-out 0.25s forwards" }}
          >
            Fingerprint is a multi-party attestation escrow protocol on Solana.
            Lock funds, gather independent confirmations, and release only when
            the real world checks out.
          </p>
          <div
            className="mt-10 flex flex-col sm:flex-row gap-4 opacity-0 translate-y-6"
            style={{ animation: "home-fade-up 0.7s ease-out 0.4s forwards" }}
          >
            <Button
              size="lg"
              onClick={() => navigate("/dashboard")}
              className="gap-2 text-base"
            >
              Create an Escrow <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/explorer")}
              className="text-base"
            >
              Browse Explorer
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container px-4 py-20">
        <h2
          className="text-2xl md:text-3xl font-bold text-center mb-14 opacity-0 translate-y-6"
          style={{ animation: "home-fade-up 0.7s ease-out 0.15s forwards" }}
        >
          How it works
        </h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="rounded-lg border bg-card p-6 opacity-0 translate-y-6 transition-colors hover:border-primary/30"
              style={{
                animation: `home-fade-up 0.6s ease-out ${0.2 + i * 0.1}s forwards`,
              }}
            >
              <f.icon className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="container px-4 py-20">
        <h2
          className="text-2xl md:text-3xl font-bold text-center mb-14 opacity-0 translate-y-6"
          style={{ animation: "home-fade-up 0.7s ease-out 0.15s forwards" }}
        >
          Three steps to trustless settlement
        </h2>
        <div className="max-w-2xl mx-auto space-y-8">
          {steps.map((s, i) => (
            <div
              key={s.number}
              className="flex gap-5 items-start opacity-0 translate-y-6"
              style={{
                animation: `home-fade-up 0.6s ease-out ${0.2 + i * 0.12}s forwards`,
              }}
            >
              <span className="font-mono text-2xl font-bold text-primary shrink-0">
                {s.number}
              </span>
              <p className="text-muted-foreground leading-relaxed pt-1">
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Fingerprint */}
      <section className="container px-4 py-20">
        <div
          className="rounded-lg border bg-card p-8 md:p-12 max-w-3xl mx-auto opacity-0 translate-y-6"
          style={{ animation: "home-fade-up 0.7s ease-out 0.2s forwards" }}
        >
          <h2 className="text-2xl font-bold mb-6">Why Fingerprint</h2>
          <ul className="space-y-4">
            {[
              "No centralized arbitrator. Consensus replaces middlemen.",
              "Configurable thresholds and dispute windows for every use case.",
              "Built on Solana for sub-second finality and minimal fees.",
              "Fully open and auditable. Every action is on-chain.",
            ].map((item, i) => (
              <li key={i} className="flex gap-3 items-start text-muted-foreground">
                <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="container px-4 py-20">
        <div
          className="text-center opacity-0 translate-y-6"
          style={{ animation: "home-fade-up 0.7s ease-out 0.2s forwards" }}
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to get started?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Connect your wallet, create an escrow, and let the attestors do the rest.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/dashboard")}
            className="gap-2 text-base"
          >
            Launch App <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
