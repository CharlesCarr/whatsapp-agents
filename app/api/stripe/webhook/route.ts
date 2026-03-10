import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db/client";
import { log } from "@/lib/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    log.warn("[stripe] webhook signature verification failed", { err: String(err) });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;
    const isActive = sub.status === "active" || sub.status === "trialing";

    await db
      .from("clubs")
      .update({ stripe_subscription_id: sub.id, is_active: isActive })
      .eq("stripe_customer_id", customerId);

    log.info("[stripe] subscription updated", {
      customerId,
      subId: sub.id,
      status: sub.status,
    });
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;

    await db
      .from("clubs")
      .update({ stripe_subscription_id: null, is_active: false })
      .eq("stripe_customer_id", customerId);

    log.info("[stripe] subscription deleted", { customerId });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = session.customer as string;
    const clubId = session.metadata?.club_id;

    if (clubId) {
      await db
        .from("clubs")
        .update({ stripe_customer_id: customerId, is_active: true })
        .eq("id", clubId);

      log.info("[stripe] checkout completed", { clubId, customerId });
    }
  }

  return NextResponse.json({ received: true });
}
