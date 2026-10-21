# Invoice Generator --- Backend API

A Node.js + Express API for validating, saving, retrieving, updating,
and emailing invoices.

## Features

-   REST API for invoice operations.
-   Invoice payload validation using Zod.
-   Supabase PostgreSQL persistence.
-   Transactional email delivery through the Brevo API.
-   Health endpoint for deployment checks.
-   Environment-based configuration for local and hosted environments.

## Technology

-   Node.js
-   Express
-   Supabase JavaScript client / PostgreSQL
-   Zod
-   Brevo transactional email API
-   dotenv

Nodemailer may remain in the installed dependencies from an earlier
implementation, but the current email flow uses the Brevo HTTP API.

## Requirements

-   Node.js and npm
-   A Supabase project
-   A Brevo account with an API key and a verified sender address

## Local setup

From the repository root:

``` bash
npm install
```

Create `backend/.env` using the following template and replace the
placeholders with your own values:

``` env
PORT=5000

SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

BREVO_API_KEY=YOUR_BREVO_API_KEY
FROM_EMAIL=verified-sender@example.com
FROM_NAME=Invoice Generator
```

Start the API using the script defined in `backend/package.json`. If the
project defines a `start` script, run:

``` bash
npm start
```

If a development script is configured, it can be used for local
development (for example, `npm run dev`).

The local API should be available at `http://localhost:5000` when using
`PORT=5000`.

## Environment variables

  -----------------------------------------------------------------------------
  Variable                      Required                Description
  ----------------------------- ----------------------- -----------------------
  `PORT`                        No                      Port for the API;
                                                        defaults may be
                                                        provided by the hosting
                                                        platform

  `SUPABASE_URL`                Yes for database        Supabase project URL
                                features                

  `SUPABASE_SERVICE_ROLE_KEY`   Yes for database        Server-side Supabase
                                features                service-role key

  `BREVO_API_KEY`               Yes for email           Brevo API key used to
                                                        authenticate
                                                        transactional email
                                                        requests

  `FROM_EMAIL`                  Yes for email           Sender email address
                                                        verified/configured in
                                                        Brevo

  `FROM_NAME`                   No                      Display name for
                                                        outgoing invoice
                                                        emails; defaults to
                                                        `Invoice Generator`
  -----------------------------------------------------------------------------

Do not put these backend variables in the frontend `.env` file. Do not
commit the real values to source control.

## Supabase database setup

1.  Create or open the Supabase project.
2.  Open the SQL Editor.
3.  Run the SQL from `supabase/schema.sql` in the repository.
4.  Add the Supabase project URL and service-role key to `backend/.env`.

The invoice table stores the invoice number, the invoice data as JSON,
and creation/update timestamps.

The service-role key bypasses normal Row Level Security policies, so it
must only be used by trusted server-side code. Never expose it in a
browser bundle or public repository.

## API endpoints

  -----------------------------------------------------------------------
  Method                  Endpoint                Purpose
  ----------------------- ----------------------- -----------------------
  `GET`                   `/api/health`           Returns API status and
                                                  whether the database is
                                                  configured

  `POST`                  `/api/invoices`         Validates and saves an
                                                  invoice

  `GET`                   `/api/invoices`         Lists recent saved
                                                  invoices

  `GET`                   `/api/invoices/:id`     Retrieves a saved
                                                  invoice by ID

  `PUT`                   `/api/invoices/:id`     Validates and updates a
                                                  saved invoice

  `POST`                  `/api/invoices/email`   Validates the invoice
                                                  and requests email
                                                  delivery through Brevo
  -----------------------------------------------------------------------

Invoice IDs are UUIDs. The email endpoint requires a valid customer
email address. A successful response means the email provider accepted
the request; it does not guarantee that the message reached the
recipient's inbox.

### Health check

Open the following URL in a browser or request it with a tool such as
curl:

``` text
https://YOUR-BACKEND.onrender.com/api/health
```

Use the actual Render service URL in place of the example.

## Brevo email configuration

1.  Generate an API key in the Brevo account.
2.  Verify/configure the sender email address or domain in Brevo.
3.  Set `BREVO_API_KEY`, `FROM_EMAIL`, and optionally `FROM_NAME` in the
    backend environment.
4.  Restart or redeploy the backend after changing environment
    variables.
5.  Send a test invoice and inspect the backend logs and Brevo
    transactional email logs if it fails.

Never log or commit the API key. If a key is accidentally exposed,
revoke it and create a replacement.

## Render deployment

The backend is deployed as a Render web service.

1.  Set the service's root directory to `backend` if the repository
    contains separate `frontend` and `backend` folders.
2.  Set the build command to `npm install`.
3.  Set the start command to the start script configured in
    `backend/package.json` (commonly `npm start`).
4.  Add the backend environment variables in **Render → Service →
    Environment**.
5.  Deploy/redeploy and check `/api/health`.
6.  Configure CORS to allow the deployed Vercel frontend origin.

Use Render's environment settings for secrets rather than committing a
populated `.env` file.

## Project structure

``` text
backend/
├── utils/
│   ├── emailService.js
│   └── invoiceValidation.js
├── index.js
├── package.json
├── .env.example
└── README.md

supabase/
└── schema.sql
```

The exact project layout may include additional files.

## Error handling and troubleshooting

-   **401 `Key not found` from Brevo:** confirm that `BREVO_API_KEY` is
    a Brevo API key (not an SMTP key), copy it completely, and
    redeploy/restart the backend.
-   **Email configuration error:** check that `BREVO_API_KEY` and
    `FROM_EMAIL` are set on the backend.
-   **Database unavailable:** check `SUPABASE_URL`,
    `SUPABASE_SERVICE_ROLE_KEY`, and whether the SQL schema has been
    applied.
-   **CORS error:** allow the deployed frontend origin in the backend's
    CORS configuration.
-   **Missing environment variables after a change:** save the variables
    and redeploy/restart the service.

## Security and production notes

-   Keep Supabase service-role keys and Brevo API keys private.
-   Do not commit `.env` files or secrets.
-   The API should have authentication and authorization/ownership
    checks before being used for sensitive or multi-user production
    workloads. The current assessment implementation should not be
    assumed to provide per-user access control unless it has been added
    and tested.
-   Validate all data on the server; frontend validation alone is not a
    security boundary.
