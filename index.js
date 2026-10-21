
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { invoiceSchema } = require("./utils/invoiceValidation");
const { sendInvoiceEmail } = require("./utils/emailService");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
    "http://localhost:5173",
    "https://invoice-generator-frontend-six.vercel.app",
];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests without an Origin header, such as server-to-server calls.
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("Not allowed by CORS"));
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);
app.use(express.json({ limit: "1mb" }));

const supabaseReady =
    Boolean(process.env.SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = supabaseReady
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        }
    )
    : null;

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Invoice Generator API is running",
        databaseConfigured: supabaseReady,
    });
});

function requireDatabase(req, res, next) {
    if (!supabase) {
        return res.status(503).json({
            success: false,
            message: "Database is not configured. Set the server-side Supabase environment variables.",
        });
    }

    next();
}

function validateInvoice(req, res, next) {
    const result = invoiceSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            success: false,
            message: "Invoice validation failed.",
            errors: result.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            })),
        });
    }

    req.validatedInvoice = result.data;
    next();
}

function validId(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// Create an invoice
app.post(
    "/api/invoices",
    requireDatabase,
    validateInvoice,
    async (req, res, next) => {
        try {
            const invoice = req.validatedInvoice;

            const { data, error } = await supabase
                .from("invoices")
                .insert({
                    invoice_number: invoice.invoiceNumber,
                    invoice_data: invoice,
                })
                .select("id, invoice_number, created_at, updated_at")
                .single();

            if (error) throw error;

            res.status(201).json({
                success: true,
                invoice: {
                    id: data.id,
                    ...data,
                    data: invoice,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

// Retrieve an invoice by ID
app.get("/api/invoices/:id", requireDatabase, async (req, res, next) => {
    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid invoice ID.",
            });
        }

        const { data, error } = await supabase
            .from("invoices")
            .select("*")
            .eq("id", req.params.id)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found.",
            });
        }

        res.json({
            success: true,
            invoice: {
                id: data.id,
                invoiceNumber: data.invoice_number,
                data: data.invoice_data,
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Update an existing invoice
app.put(
    "/api/invoices/:id",
    requireDatabase,
    validateInvoice,
    async (req, res, next) => {
        try {
            if (!validId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid invoice ID.",
                });
            }

            const invoice = req.validatedInvoice;

            const { data, error } = await supabase
                .from("invoices")
                .update({
                    invoice_number: invoice.invoiceNumber,
                    invoice_data: invoice,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", req.params.id)
                .select("id, invoice_number, created_at, updated_at")
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                return res.status(404).json({
                    success: false,
                    message: "Invoice not found.",
                });
            }

            res.json({
                success: true,
                invoice: {
                    id: data.id,
                    ...data,
                    data: invoice,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);


app.get("/api/invoices", requireDatabase, async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from("invoices")
            .select("id, invoice_number, invoice_data, created_at, updated_at")
            .order("created_at", { ascending: false })
            .limit(100);

        if (error) throw error;

        return res.json({
            success: true,
            invoices: (data || []).map((row) => ({
                id: row.id,
                invoiceNumber: row.invoice_number,
                data: row.invoice_data,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            })),
        });
    } catch (error) {
        next(error);
    }
});


app.post("/api/invoices/email", async (req, res, next) => {
    try {
        const result = invoiceSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Please correct the invoice details before sending.",
                errors: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            });
        }

        const invoice = result.data;

        if (!invoice.customerEmail) {
            return res.status(400).json({
                success: false,
                message: "Enter the customer's email address first.",
            });
        }

        const emailResult = await sendInvoiceEmail(invoice);

        return res.json({
            success: true,
            message: "Brevo accepted the invoice email for sending.",
            messageId: emailResult.messageId,
        });
    } catch (error) {
        next(error);
    }
});



app.use((error, req, res, next) => {
    console.error("API error:", error.message);

    res.status(500).json({
        success: false,
        message: "An unexpected server error occurred.",
    });
});

app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});
