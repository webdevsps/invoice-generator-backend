
const { z } = require("zod");

const numericValue = z.coerce.number().finite();

const lineItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().max(1000).default(""),
  quantity: numericValue.min(0),
  unitPrice: numericValue.min(0),
});

const customFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().max(200),
  value: z.string().max(2000),
  visible: z.boolean(),
});

const invoiceSchema = z.object({
  businessName: z.string().max(200).default(""),
  businessEmail: z.string().max(320).default(""),
  businessAddress: z.string().max(2000).default(""),

  customerName: z.string().max(200).default(""),
  customerEmail: z.string().max(320).default(""),
  customerAddress: z.string().max(2000).default(""),

  invoiceNumber: z.string().min(1).max(100),
  issueDate: z.string().max(30).default(""),
  dueDate: z.string().max(30).default(""),
  notes: z.string().max(5000).default(""),

  items: z.array(lineItemSchema).min(1).max(500),
  discount: numericValue.min(0),
  taxRate: numericValue.min(0).max(100),

  customFields: z.array(customFieldSchema).max(100).default([]),
}).superRefine((invoice, ctx) => {
  const subtotalCents = invoice.items.reduce((sum, item) => {
    const lineCents = Math.round(
      item.quantity * Math.round(item.unitPrice * 100)
    );

    return sum + lineCents;
  }, 0);

  if (Math.round(invoice.discount * 100) > subtotalCents) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discount"],
      message: "Discount cannot exceed the subtotal.",
    });
  }

  for (const field of ["businessEmail", "customerEmail"]) {
    const email = invoice[field];

    if (email && !z.string().email().safeParse(email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: "Enter a valid email address.",
      });
    }
  }
});

module.exports = { invoiceSchema };
