# NFC review cards

NFC support reuses the existing, merchant-scoped QR/review engine. A physical NFC card is a standard NFC tag containing a **URL**. No NFC reader API or app installation is required on the customer's phone.

## Customer journey

1. Customer taps an NFC-enabled phone on a programmed card.
2. The phone opens `https://YOUR_PUBLIC_DOMAIN/n/TOKEN`.
3. The existing customer review flow starts a server-side, token-attributed session.
4. The customer selects an honest rating, optionally adds details, edits any generated text and chooses whether to open Google's review composer.
5. The customer explicitly submits on Google. Google posting is **not** automatic, and a composer open is not proof that a review was posted.

QR remains available as a fallback using `/r/TOKEN` and the existing SVG QR export. Both routes use the same token and location configuration.

## Set up a physical card

1. In the merchant workspace open **NFC cards** (the existing `/dashboard/qr-codes` page).
2. Open your dashboard using its **final production HTTPS domain**, not localhost or a temporary preview domain. Create a **separate touchpoint for each physical card** and choose its location. Name it something recognizable like `Reception Card 01`; optionally add a location/desk reference.
3. Select **Copy NFC URL**. The copied link uses the current app origin and `/n/TOKEN`.
4. In a trusted NFC writing app (for example an app offering a **Write → URL/URI** action), write the link as an NDEF URI record on a genuine writable NFC Forum Type 2 tag such as NTAG213, NTAG215 or NTAG216. Check the URL fits the tag's usable memory; use a larger-capacity tag for long domains.
5. **Read the tag back** and confirm it contains the correct, public HTTPS URL. Open it on a compatible phone and complete a test review session. Test both Android and iPhone devices you intend to support.
6. Print or attach the QR fallback, which still uses `/r/TOKEN`. The QR destination and the NFC destination point to the same review experience and count toward the same card touchpoint.

The dashboard **does not program an NFC card remotely**. Its copy action only copies the link to be written using an NFC-capable phone/writer. Do not lock a tag until you've verified its written URL, because locked tags often cannot be changed.

## Card lifecycle & reporting

- **Pause/Activate** applies to the underlying review asset, not to the NFC hardware. The programmed URL remains on a paused tag, but the server stops accepting new public review sessions when the asset is paused.
- Each card has a unique token: do not use one shared token for all cards if placement-level reporting matters.
- Current `QR_SCANNED` event and `scans` database field name are retained for backward compatibility. These count **review entry sessions**, including those coming from NFC `/n/` links. They are **not** hardware-verified RF taps.
- When NFC and QR backup use the same card token, the current analytics cannot tell which entry method started the session. Per-card totals remain meaningful; NFC-vs-QR channel splitting requires a separately persisted entry-channel field.
- This platform counts review drafts and Google composer opens, **not confirmed published Google reviews**.
- Never collect payments, store customer personal information, or store review text in the NFC tag. Only store the public link. Never reward or screen for positive ratings.

## Backward compatibility

All existing QR tokens, `/r/TOKEN` routes, SVG downloads, merchant roles, entitlements, pauses, session idempotency and customer review workflows remain in place. No database migration or external NFC API is necessary for this first NFC-compatible release.
