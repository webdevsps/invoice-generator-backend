
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function money(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function calculateTotals(invoice) {
  const items = (invoice.items || []).map((item) => {
    const quantity = Number(item.quantity);
    const unitPriceCents = Math.round(Number(item.unitPrice) * 100);

    return {
      description: item.description || "Item",
      quantity,
      unitPriceCents,
      lineTotalCents: Math.round(quantity * unitPriceCents),
    };
  });

  const subtotalCents = items.reduce(
    (sum, item) => sum + item.lineTotalCents,
    0
  );

  const discountCents = Math.min(
    Math.round(Number(invoice.discount || 0) * 100),
    subtotalCents
  );

  const taxableCents = subtotalCents - discountCents;
  const taxCents = Math.round(
    taxableCents * Number(invoice.taxRate || 0) / 100
  );

  return {
    items,
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: taxableCents + taxCents,
  };
}

async function sendInvoiceEmail(invoice) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.FROM_EMAIL;
  const senderName = process.env.FROM_NAME || "Invoice Generator";

  if (!apiKey || !senderEmail) {
    throw new Error(
      "Brevo is not configured. Check BREVO_API_KEY and FROM_EMAIL."
    );
  }

  const totals = calculateTotals(invoice);

  const itemRows = totals.items.map((item) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee">
        ${escapeHtml(item.description)}
      </td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #eee">
        ${item.quantity}
      </td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #eee">
        ${money(item.unitPriceCents)}
      </td>
      <td style="padding:10px;text-align:right;border-bottom:1px solid #eee">
        ${money(item.lineTotalCents)}
      </td>
    </tr>
  `).join("");

  const textItems = totals.items.map((item) =>
    `${item.description} | Qty: ${item.quantity} | ${money(item.lineTotalCents)}`
  ).join("\n");

  const businessName = invoice.businessName || senderName;

  const textContent = `
Hello ${invoice.customerName || "Customer"},

Here are the details of invoice ${invoice.invoiceNumber}.

From: ${businessName}
Issue date: ${invoice.issueDate || "Not specified"}
Due date: ${invoice.dueDate || "Not specified"}

${textItems}

Subtotal: ${money(totals.subtotalCents)}
Discount: -${money(totals.discountCents)}
Tax (${Number(invoice.taxRate || 0)}%): ${money(totals.taxCents)}
Total: ${money(totals.totalCents)}

${invoice.notes ? `Notes: ${invoice.notes}` : ""}

Thank you,
${businessName}
  `.trim();

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;color:#1f2937;max-width:700px;margin:auto">
      <h2>Invoice ${escapeHtml(invoice.invoiceNumber)}</h2>

      <p>Hello ${escapeHtml(invoice.customerName || "Customer")},</p>
      <p>Please find your invoice details below.</p>

      <p>
        <strong>From:</strong> ${escapeHtml(businessName)}<br>
        <strong>Customer:</strong> ${escapeHtml(invoice.customerName || "")}<br>
        <strong>Issue date:</strong> ${escapeHtml(invoice.issueDate || "Not specified")}<br>
        <strong>Due date:</strong> ${escapeHtml(invoice.dueDate || "Not specified")}
      </p>

      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f3f4f6;text-align:left">
            <th style="padding:10px">Description</th>
            <th style="padding:10px;text-align:right">Qty</th>
            <th style="padding:10px;text-align:right">Price</th>
            <th style="padding:10px;text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div style="margin-top:20px;text-align:right">
        <p>Subtotal: ${money(totals.subtotalCents)}</p>
        <p>Discount: -${money(totals.discountCents)}</p>
        <p>Tax (${Number(invoice.taxRate || 0)}%): ${money(totals.taxCents)}</p>
        <h3>Total: ${money(totals.totalCents)}</h3>
      </div>

      ${invoice.notes
        ? `<p><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</p>`
        : ""}

      <p>Thank you,<br>${escapeHtml(businessName)}</p>
    </div>
  `;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: invoice.customerEmail,
          ...(invoice.customerName
            ? { name: invoice.customerName }
            : {}),
        },
      ],
      subject: `Invoice ${invoice.invoiceNumber} from ${businessName}`,
      textContent,
      htmlContent,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Brevo API error:", response.status, result);

    throw new Error(
      result.message ||
      `Brevo rejected the email request (HTTP ${response.status}).`
    );
  }

  return { messageId: result.messageId };
}

module.exports = { sendInvoiceEmail };
