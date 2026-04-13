# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Mobile app
npx expo start          # Start dev server (scan QR with Expo Go on device)
npx expo start --android
npx expo start --ios
npx expo start --web
npx tsc --noEmit        # Type-check the mobile app

# Use npx expo install (NOT npm install) for native packages — ensures SDK-compatible versions
npx expo install <package-name>

# Cloud Functions (from functions/ directory)
cd functions
npm run build           # tsc compile to lib/
npm run deploy          # build + firebase deploy --only functions
firebase functions:config:set stripe.secret="sk_test_..."  # Set Stripe secret key
```

## Architecture

**Stack:** Expo (React Native) + TypeScript + Firebase Firestore + Firebase Cloud Functions + Stripe

**Data flow:** All bill state lives in Firestore (`bills/{billId}`). Local `AsyncStorage` stores only an array of bill IDs (`billIds`) so each device remembers which bills it has created or joined. There is no auth — bills are identified by a short random 6-char alphanumeric code that users share out-of-band (via the native Share sheet).

**Firestore document shape (`bills/{billId}`):**
```
{
  code: string,           // 6-char uppercase code for joining
  title: string,
  totalAmount: number,
  createdAt: number,      // Unix ms
  takeoutApp?: 'doordash' | 'ubereats' | 'grubhub' | 'instacart' | 'other',
  orderLink?: string,     // tracking URL from takeout app
  eta?: number,           // Unix ms timestamp for delivery arrival
  participants: [{
    id: string,
    name: string,
    percentage: number,
    paid: boolean,
    paymentIntentId?: string   // set after successful Stripe charge
  }]
}
```
Participants are stored as an array inside the bill document (not a subcollection). Marking someone paid = rewriting the full `participants` array via `updateDoc`.

**Stripe payment flow:**
1. User taps "Pay $X.XX" in `BillDetailScreen`
2. App calls the `createPaymentIntent` Cloud Function (passing `billId` + `participantId`)
3. Cloud Function fetches bill from Firestore, calculates amount in cents, creates a Stripe PaymentIntent server-side (secret key never leaves the function), returns `clientSecret`
4. App initializes Stripe payment sheet with `initPaymentSheet`, presents it with `presentPaymentSheet`
5. On success, app writes `paid: true` + `paymentIntentId` to Firestore

The Cloud Function's Stripe secret key is stored via Firebase config (`functions.config().stripe.secret`), never in source code. The mobile app only holds the publishable key in [src/config.ts](src/config.ts).

**Key files:**
- [firebase.ts](firebase.ts) — Firebase init; exports `db`
- [src/config.ts](src/config.ts) — Stripe publishable key
- [src/navigation.ts](src/navigation.ts) — `RootStackParamList` type; add new screens here
- [src/types.ts](src/types.ts) — `Bill`, `Participant`, `TakeoutApp` interfaces
- [functions/src/index.ts](functions/src/index.ts) — `createPaymentIntent` Cloud Function

**Screens:**
- `HomeScreen` — reads `billIds` from AsyncStorage, fetches each by Firestore doc ID via `onSnapshot`
- `CreateBillScreen` — takeout app chips, order link input, ETA panel (quick buttons + custom), % or $ toggle per participant, validates percentages sum to 100%, saves to Firestore + AsyncStorage
- `BillDetailScreen` — live `onSnapshot`; ETA countdown with color urgency (purple → amber <15min → red <5min → green on arrival); Stripe payment sheet per participant
- `JoinBillScreen` — queries Firestore by `code` field, saves found doc ID to AsyncStorage

**`react-native-get-random-values` must be imported first** — it is imported at the top of [App.tsx](App.tsx) before anything else to polyfill `crypto.getRandomValues` for `uuid`.

## Deployment notes

- Cloud Functions require the Firebase **Blaze** (pay-as-you-go) plan to deploy
- After deploying functions, set the Stripe secret: `firebase functions:config:set stripe.secret="sk_test_..."`
- Test payments with Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC
