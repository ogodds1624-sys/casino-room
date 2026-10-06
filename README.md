# Casino Room

A responsive casino dashboard for game outcome predictions, user management, payment tracking, and referrals.

## Partner earnings

Partner earnings are confirmed referral revenue minus the partner's commission:
`commission amount = gross earnings * commission percentage / 100`;
`net earnings = gross earnings - commission amount`, rounded to two decimal places.
For example, 1,000 gross earnings with a 20% commission displays 800.

This applies to total and daily earnings for both Ghana (GHS) and Nigeria (NGN).
Gross revenue remains unchanged. The portal reloads each partner's current commission
every three seconds, so saved commission changes automatically update their earnings.

## Partner payouts

Partners can open **Payouts** to request yesterday's net confirmed referral earnings.
GHS and NGN are requested separately, using the previous calendar day in Accra and
Lagos respectively. The server calculates the amount; partners cannot enter their
own payout totals. Requests save the gross amount, commission and net amount at
submission, so later commission changes do not alter requests already submitted.

Only one pending or paid request is allowed per partner, earnings date and currency.
Rejected requests remain in history and may be resubmitted while that earnings date
is still yesterday. No payout is available for zero earnings or 100% commission.
Payout history is visible only to its partner or a verified payout admin.

Admins can open **Partner Payouts**, filter pending/paid/rejected requests, record a
payment reference, mark a request paid, or reject it with a required reason.
**Mark paid does not transfer money**: send the payment manually first.
Both payout areas refresh every three seconds. Migration
`0007_partner_payouts.sql` stores the requests durably on the configured database.
Local embedded preview data remains in memory, as before.
The payout service refreshes pending migrations once when it initializes, so a
new payout migration is applied to an already-running local preview without
restarting it or losing its in-memory accounts.

### Admin configuration

Set the server-only **ADMIN_PASSCODE** environment variable to a strong private
passcode in your deployment settings (and local server environment when developing).
The old browser-only admin passcode and local unlock flag no longer grant access.
No default passcode is embedded in the app; missing configuration is shown explicitly.
Admin sign-in creates an eight-hour signed session, stored in session storage.
Every payout admin query and mutation verifies that session on the server.
Changing ADMIN_PASSCODE invalidates existing admin sessions.
Existing non-payout admin server functions retain their previous access behavior;
this change does not retrofit access checks across those unrelated functions.

### Receiving details and transfer history

Both Ghana and Nigeria requests use one shared Ghana receiving-details form:
account holder name plus MTN Mobile Money, Telecel Cash, AirtelTigo Money or a Ghana
bank account. Wallet numbers are 10 digits starting with 0 and bank accounts accept
6 to 20 digits. Nigeria earnings remain in NGN; no automatic currency conversion
or funds transfer is performed. Each request saves a separate copy of the form,
and existing request destinations are never rewritten when the form changes.
Numbers are stored as text to preserve leading zeros. Never provide account PINs,
passwords or card security codes.

The receiving method, bank/provider, account holder and number are saved on the
individual request, not a mutable partner profile. Verified admins see those details
on the payout card. Partners see only their own requests. Details are not saved in
browser storage, and changing details on a new request does not rewrite old history.

Marking a payout paid requires a transfer reference after the admin manually sends
the money. Partner history and the admin Paid filter retain the receiving details,
amount, earnings date, submitted commission, request/review timestamps, transfer
reference and admin note. Paid records cannot be reviewed again or removed through
the payout workflow. Rejected attempts also remain in history.

Migration `0008_payout_receiving_details.sql` leaves older records intact. Legacy
requests without receiving details remain visible; pending legacy requests must
be rejected and resubmitted with details (if their earnings date is still yesterday)
before they can be marked paid.
