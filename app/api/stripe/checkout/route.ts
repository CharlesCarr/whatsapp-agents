import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db/client";
import { log } from "@/lib/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export async function POST(req: NextRequest) {
  const { clubId, priceId } = (await req.json()) as {
    clubId: string;
    priceId: string;
  };

  if (!clubId || !priceId) {
    return NextResponse.json(
      { error: "Missing clubId or priceId" },
      { status: 400 }
    );
  }

  const { data: club } = await db
    .from("clubs")
    .select("id, name, stripe_customer_id")
    .eq("id", clubId)
    .single();

  if (!club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const origin =
    req.headers.get("origin") ?? "https://whatsapp-agents.vercel.app";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: club.stripe_customer_id ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { club_id: clubId },
    success_url: `${origin}/billing?success=1`,
    cancel_url: `${origin}/billing?canceled=1`,
  });

  log.info("[stripe] checkout session created", {
    clubId,
    sessionId: session.id,
  });
  return NextResponse.json({ url: session.url });
}
