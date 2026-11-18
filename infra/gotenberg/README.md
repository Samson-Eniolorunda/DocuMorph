# Gotenberg on Google Cloud Run

DocuMorph converts Word and Excel files to PDF with [Gotenberg](https://gotenberg.dev) (an open-source wrapper around
LibreOffice). You run it yourself on Cloud Run, which scales to zero, so it costs nothing while nobody is using it and
stays inside Cloud Run's free tier for the traffic of a small tool.

> **Check before you rely on this.** These steps were written without access to Gotenberg's or Google's websites from
> the build environment, so the flag and variable names come from Gotenberg's documented configuration
> (`--api-enable-basic-auth`, `GOTENBERG_API_BASIC_AUTH_USERNAME`, `GOTENBERG_API_BASIC_AUTH_PASSWORD`,
> `--api-timeout`) as confirmed by third-party deployment guides, not read from the official page. Step 6 proves the
> login works; if it does not, compare the names with <https://gotenberg.dev/docs/configuration>.

You need a Google Cloud account with billing enabled (the free tier still requires a billing account) and the
[`gcloud` CLI](https://cloud.google.com/sdk/docs/install), signed in with `gcloud auth login`.

## 1. Choose the names

```bash
export PROJECT_ID="documorph-convert"        # a new, unique project id
export REGION="europe-west1"                  # a Tier 1 region, eligible for the free tier
export SERVICE="gotenberg"
export BILLING_ACCOUNT="XXXXXX-XXXXXX-XXXXXX" # gcloud billing accounts list
```

## 2. Create the project and turn on the services

```bash
gcloud projects create "$PROJECT_ID"
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  billingbudgets.googleapis.com
```

## 3. Make the official image available to Cloud Run

Cloud Run pulls from Google's Artifact Registry. A remote repository mirrors Docker Hub's official
`gotenberg/gotenberg:8` image without copying it by hand:

```bash
gcloud artifacts repositories create dockerhub \
  --repository-format=docker --location="$REGION" \
  --mode=remote-repository --remote-docker-repo=DOCKER-HUB \
  --description="Docker Hub mirror"

export IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/dockerhub/gotenberg/gotenberg:8"
```

The image is about 1 GB; Artifact Registry's storage beyond its small free amount costs a few pence a month.

## 4. Store the login

Choose a username and a long random password. They are the values you later give to Vercel as `GOTENBERG_USERNAME` and
`GOTENBERG_PASSWORD`.

```bash
export GOTENBERG_USERNAME="documorph"
export GOTENBERG_PASSWORD="$(openssl rand -base64 36 | tr -d '\n/+=')"
echo "$GOTENBERG_PASSWORD"   # copy it now, then clear your terminal history

printf '%s' "$GOTENBERG_USERNAME" | gcloud secrets create gotenberg-username --data-file=-
printf '%s' "$GOTENBERG_PASSWORD" | gcloud secrets create gotenberg-password --data-file=-

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
for s in gotenberg-username gotenberg-password; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

## 5. Deploy

```bash
gcloud run deploy "$SERVICE" \
  --image="$IMAGE" \
  --region="$REGION" \
  --memory=2Gi --cpu=1 \
  --concurrency=1 \
  --min-instances=0 --max-instances=2 \
  --port=3000 \
  --timeout=60 \
  --args="--api-enable-basic-auth,--api-timeout=55s" \
  --set-secrets="GOTENBERG_API_BASIC_AUTH_USERNAME=gotenberg-username:latest,GOTENBERG_API_BASIC_AUTH_PASSWORD=gotenberg-password:latest" \
  --allow-unauthenticated
```

What each setting does:

| Setting                   | Why                                                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--memory=2Gi --cpu=1`    | LibreOffice needs memory; 2 GiB converts ordinary documents reliably.                                                                               |
| `--concurrency=1`         | One conversion per instance at a time. LibreOffice is single-threaded per document.                                                                 |
| `--min-instances=0`       | Scales to zero: no cost while idle. The first request after idle takes several seconds; the DocuMorph server module retries once to allow for this. |
| `--max-instances=2`       | A hard ceiling on cost and on abuse.                                                                                                                |
| `--port=3000`             | Gotenberg listens on port 3000.                                                                                                                     |
| `--args`                  | `--api-enable-basic-auth` makes every conversion route require the login. `--api-timeout` stops a stuck conversion before Cloud Run's own limit.    |
| `--allow-unauthenticated` | Cloud Run itself is open to the internet; Gotenberg's basic authentication is the lock. Only the DocuMorph server holds the password.               |

The command prints a **Service URL**, for example `https://gotenberg-abc123-ew.a.run.app`. That is `GOTENBERG_URL`.

## 6. Prove it works

```bash
export GOTENBERG_URL="https://gotenberg-abc123-ew.a.run.app"   # your Service URL

# Without the login: expect 401.
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$GOTENBERG_URL/forms/libreoffice/convert"

# With the login and a small .docx: expect 200 and a PDF.
curl -s -u "$GOTENBERG_USERNAME:$GOTENBERG_PASSWORD" \
  -F files=@sample.docx "$GOTENBERG_URL/forms/libreoffice/convert" -o sample.pdf -w "%{http_code}\n"
file sample.pdf   # PDF document
```

The service's `/health` route is deliberately open so Cloud Run can check it.

## 7. Add a billing budget alert

A small budget e-mails you well before any charge becomes meaningful. This sets £5 with alerts at 50 %, 90 % and 100 %:

```bash
gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT" \
  --display-name="DocuMorph conversions" \
  --budget-amount=5GBP \
  --filter-projects="projects/$PROJECT_ID" \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0
```

A budget alerts; it does not stop spending. `--max-instances=2` is what limits it. To stop the service at once:
`gcloud run services delete "$SERVICE" --region="$REGION"`.

## 8. Give the values to Vercel

In the Vercel project, under Settings, Environment Variables, add (names only here):

- `GOTENBERG_URL`: the Service URL, with no trailing path
- `GOTENBERG_USERNAME`
- `GOTENBERG_PASSWORD`

Then redeploy. Word to PDF and Excel to PDF now work.

## Updating and rotating

- New Gotenberg release: run step 5 again; the `:8` tag follows the current 8.x release.
- New password: add a new version of the `gotenberg-password` secret, redeploy the service, and update Vercel.
