import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

admin.initializeApp();

// Set your Stripe secret key via:
//   firebase functions:config:set stripe.secret="sk_test_YOUR_KEY"
function getStripe(): Stripe {
  const secret = functions.config().stripe?.secret;
  if (!secret) throw new Error('Stripe secret key not configured. Run: firebase functions:config:set stripe.secret="sk_test_..."');
  return new Stripe(secret, { apiVersion: '2024-06-20' });
}

/**
 * Creates a Stripe PaymentIntent for a specific participant's share of a bill.
 * Called from the mobile app before presenting the payment sheet.
 */
export const createPaymentIntent = functions.https.onCall(async (data) => {
  const { billId, participantId } = data as { billId: string; participantId: string };

  if (!billId || !participantId) {
    throw new functions.https.HttpsError('invalid-argument', 'billId and participantId are required');
  }

  const stripe = getStripe();

  const billDoc = await admin.firestore().collection('bills').doc(billId).get();
  if (!billDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Bill not found');
  }

  const bill = billDoc.data()!;
  const participant = (bill.participants as any[]).find((p) => p.id === participantId);

  if (!participant) {
    throw new functions.https.HttpsError('not-found', 'Participant not found');
  }
  if (participant.paid) {
    throw new functions.https.HttpsError('failed-precondition', 'This participant has already paid');
  }

  const amountCents = Math.round((bill.totalAmount * participant.percentage) / 100 * 100);

  if (amountCents < 50) {
    throw new functions.https.HttpsError('invalid-argument', 'Amount is too small to charge (minimum $0.50)');
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: { billId, participantId, billTitle: bill.title, participantName: participant.name },
  });

  return { clientSecret: paymentIntent.client_secret };
});
