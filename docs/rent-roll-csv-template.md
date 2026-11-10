# Rent-roll CSV template

Upload one CSV per community per month on the community's **Renewals** tab. Miyora uses it to work out the
**Renewal rate by engagement** tile on Insights. Download a starter file from the tab ("Template CSV"), or export
from your property-management system and upload it as-is — the column names below are recognised automatically.

Only three things are saved: **unit**, **lease end date** and **renewal outcome**. Every other column (resident
names, rent, emails, balances) is ignored and never leaves your computer.

## Columns

| What | Required | Accepted column names (any case, spaces/punctuation ignored) |
|---|---|---|
| Unit | Yes | `Unit`, `Unit Number`, `Unit No`, `Unit #`, `Unit ID`, `Apt`, `Apt Number`, `Apartment`, `Bldg/Unit`, `Space` |
| Lease end date | Yes | `Lease End Date`, `Lease End`, `Lease Expiration Date`, `Lease Expiration`, `Lease Expires`, `Lease To`, `Expiration Date`, `End Date`. If none of these exist, `Move-out Date` / `Move Out` is used instead. |
| Renewal outcome | No | `Outcome`, `Renewal Outcome`, `Renewal Status`, `Renewal`. Without this column every lease is saved as pending. |

A plain `Status` or `Lease Status` column is **not** read as the outcome: in most exports it means occupancy
(Current / Notice / Vacant), not whether the lease renewed. Rename or add a `Renewal Outcome` column.

### Unit

Matched to the unit a resident entered in the Miyora app. Before matching, both sides are tidied the same way:
uppercase, a leading `Apartment` / `Apt` / `Unit` / `Suite` / `Ste` word is dropped, then anything that isn't a
letter or digit, then leading zeros. So `Apt 0101`, `Unit #101` and `101` all match `101`; `4-B` matches `4B`.
Building prefixes are kept (`Bldg 2 - 105` becomes `BLDG2105`), so use the same unit format residents use in
the app.

### Lease end date

`YYYY-MM-DD` (preferred), `YYYY/MM/DD`, `MM/DD/YYYY` or `MM/DD/YY` (read as 20YY). Day-first dates like
`31/05/2026` are rejected rather than guessed. Dates are calendar dates, no time zone.

### Renewal outcome

| Saved as | Accepted values |
|---|---|
| Renewed | `Renewed`, `Renewal`, `Renew`, `Renewal Signed`, `Signed Renewal` |
| Moved out | `Moved Out`, `Move Out`, `Vacated`, `Not Renewed`, `Non-renewal`, `Did Not Renew` |
| Pending | blank, `Pending`, `Undecided`, `Open` |

Anything else (for example `Month-to-month` or `Notice`) is skipped with an error, so you can decide what it
means and fix it in the file. Pending leases are left out of the renewal rate.

**Record the outcome on the old lease.** When a resident renews, many systems show the new lease (with a new
end date) and drop the old one. If you only ever upload the new lease, the old one stays "pending" and never
counts as a renewal. Before exporting, make sure leases that ended this month carry `Renewed` or `Moved out`.

## Rows that are skipped

The preview lists every skipped row with its row number before anything is saved:

- unit missing, or nothing left after tidying;
- lease end date missing, not a date, or a year before 2000 / more than 5 years ahead;
- an outcome that isn't in the list above;
- the same unit and lease end date as an earlier row (the first one is kept).

A file can have up to 5,000 rows and 5 MB.

## Uploading again

- **Same month again:** replaces that month's upload completely (rows that aren't in the new file are dropped
  for that month). Other months are never changed.
- **A new month:** a lease that's in several monthly files (same unit and lease end date) uses the outcome from
  the newest month, e.g. pending in October → renewed in November. Re-uploading an older month never overrides a
  newer month's outcome.

## Example

```csv
Unit,Lease End Date,Renewal Outcome
101,2026-03-31,Renewed
102,03/31/2026,Moved out
103,2026-04-30,Pending
```

A messier export-style example (with ignored columns and rows that get skipped) is in
[`docs/samples/rent-roll-sample.csv`](samples/rent-roll-sample.csv).
