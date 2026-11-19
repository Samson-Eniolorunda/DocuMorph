# Owner setup

These are the steps only you can do, in order. Each gives the exact place the value goes. Values are secrets: put them
in the Vercel dashboard (Settings, Environment Variables, tick Production and Preview), never in the repository or in a
message. The names below are the only thing the code reads.

Before you start you need: a Google account with billing enabled, an Adobe account, an Upstash account, a Resend
account, a Buy Me a Coffee page, and a Vercel project connected to this repository.

## 1. Upstash (shared counts; required for every server tool)

Without this store no server conversion runs, because the daily and monthly caps must be exact.

1. Sign in at upstash.com and choose Create Database (Redis).
2. Name it `documorph`, choose the free plan, and pick the region closest to your Vercel functions (the default
   Vercel region is Washington, D.C., so `us-east-1`; choose a European region if you set Vercel to Frankfurt or Paris).
3. Open the database, then the REST API section.
4. Copy the REST URL into `UPSTASH_REDIS_REST_URL` and the REST token into `UPSTASH_REDIS_REST_TOKEN`.

## 2. Gotenberg on Cloud Run (Word and Excel to PDF)

1. Follow `infra/gotenberg/README.md` from the top, steps 1 to 6: create the project, mirror the image, store the
   login, deploy with 2 GiB, 1 CPU, concurrency 1, minimum 0, maximum 2 instances in `europe-west1`, and run the two
   `curl` checks (401 without the login, 200 and a PDF with it).
2. Step 7 of that guide creates the budget alert (£5, with e-mails at 50 %, 90 % and 100 %). Do not skip it: it is the
   only warning you get if the service is abused. The site-wide daily cap (`CONVERT_DAILY_SITE_CAP`, default 200) is the
   other protection.
3. Put the Service URL (it must start with `https://`) into `GOTENBERG_URL`, the username into `GOTENBERG_USERNAME`
   and the password into `GOTENBERG_PASSWORD`.
4. Time the first conversion after a quiet period. Cloud Run wakes from zero in several seconds; if that is too slow,
   set `--min-instances=1` (it then costs a small amount each month).

## 3. Adobe PDF Services (PDF to Word and PDF to Excel)

1. Sign in at developer.adobe.com, open the Console, and create a project with the **PDF Services API**.
2. Copy the Client ID into `PDF_SERVICES_CLIENT_ID` and the Client Secret into `PDF_SERVICES_CLIENT_SECRET`.
3. **Check how conversions are counted.** On the project's page and in Adobe's PDF Services licensing and pricing
   terms, read: (a) the free allowance (the code assumes 500 transactions a month) and whether it is permanent or a
   time-limited trial; (b) whether an export job counts as one transaction per call or per block of pages; (c) what
   happens at the limit (refusal or a charge). Confirm the usage figure in the console after your first test
   conversions: convert one one-page PDF and one many-page PDF, and see how far the counter moves.
4. The site keeps its own count: `ADOBE_MONTHLY_CAP` (default 450) and `ADOBE_DAILY_CAP` (default 25). If large files
   count per block of pages, lower the monthly cap accordingly. If the allowance is a trial that ends, remove PDF to
   Word and PDF to Excel rather than pay by accident.
5. Confirm in Adobe's terms that uploaded files and results are deleted after processing; the privacy page says so.

## 4. Resend (feedback e-mail)

1. Create a Resend account **using the e-mail address that should receive feedback**.
2. Create an API key with sending access and put it in `RESEND_API_KEY`.
3. Put that same address in `FEEDBACK_TO_EMAIL`. Without a verified domain Resend delivers only to the account's own
   address, which is exactly this use.
4. Send one test message from the live feedback form and check it arrives (and check the spam folder once).

## 5. Buy Me a Coffee and portfolio links

1. Create your Buy Me a Coffee page and put its full `https://` address in `NEXT_PUBLIC_BUYMEACOFFEE_URL`.
2. Put your portfolio's full `https://` address in `NEXT_PUBLIC_PORTFOLIO_URL`.
3. Until each is set, its link is simply absent (the portfolio name in the footer is plain text).

## 6. Site address

Put the public address of the site, for example `https://documorph.vercel.app`, in `NEXT_PUBLIC_SITE_URL`. A `*.vercel.app`
address is fine. It is required: a production build stops without it. It must be set for Production **and** Preview,
and a preview needs its own preview address (or leave Preview pointing at the production address, which only affects
canonical links and share images). Changing it needs a new build, because it is read at build time.

## 7. Vercel environment variable names

| Name                                                        | Value from  | Needed for                    |
| ----------------------------------------------------------- | ----------- | ----------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                      | step 6      | Required for the build        |
| `NEXT_PUBLIC_PORTFOLIO_URL`, `NEXT_PUBLIC_BUYMEACOFFEE_URL` | step 5      | Optional links                |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`        | step 1      | Every server tool             |
| `GOTENBERG_URL`, `GOTENBERG_USERNAME`, `GOTENBERG_PASSWORD` | step 2      | Word and Excel to PDF         |
| `PDF_SERVICES_CLIENT_ID`, `PDF_SERVICES_CLIENT_SECRET`      | step 3      | PDF to Word and PDF to Excel  |
| `ADOBE_MONTHLY_CAP`, `ADOBE_DAILY_CAP`                      | step 3      | Optional; defaults 450 and 25 |
| `RESEND_API_KEY`, `FEEDBACK_TO_EMAIL`                       | step 4      | Feedback                      |
| `CONVERT_DAILY_PER_VISITOR`, `CONVERT_DAILY_SITE_CAP`       | your choice | Optional; defaults 10 and 200 |

Not used any more, remove them if set: `CONVERTAPI_SECRET`, `BLOB_READ_WRITE_TOKEN`, `FORMSPREE_ENDPOINT` and every
`WALLET_*` name.

## 8. First check on a preview

Deploy the branch as a **preview**, not production. Then convert one Word file, one Excel file, one PDF to Word and one
PDF to Excel; send one feedback message; check the Upstash database shows the counts; check the Cloud Run and Adobe
usage pages; and open the site on a real iPhone and a real Android phone. Only then promote it.
