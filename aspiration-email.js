const nodemailer = require("nodemailer");

function createAspirationTransporter(environment = process.env) {
  const host = environment.SMTP_HOST?.trim();
  const user = environment.SMTP_USER?.trim();
  const password = environment.SMTP_PASS;
  const configured = Boolean(host || user || password);
  if (!configured) return null;

  const missing = [
    !host && "SMTP_HOST",
    !user && "SMTP_USER",
    !password && "SMTP_PASS",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Konfigurasi email belum lengkap: ${missing.join(", ")}.`);
  }

  const port = environment.SMTP_PORT ? Number(environment.SMTP_PORT) : 587;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT harus berupa nomor port yang valid.");
  }
  const secureSetting = environment.SMTP_SECURE?.trim().toLowerCase();
  if (secureSetting && !["true", "false"].includes(secureSetting)) {
    throw new Error("SMTP_SECURE harus bernilai true atau false.");
  }

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: secureSetting ? secureSetting === "true" : port === 465,
      auth: { user, pass: password },
      tls: { minVersion: "TLSv1.2" },
    }),
    from: environment.SMTP_FROM?.trim() || user,
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

function aspirationDetails(aspiration) {
  const fields = [
    ["Nama lengkap", aspiration.fullName],
    ["Perguruan tinggi", aspiration.campus],
    ["Email", aspiration.email],
    ["Topik", aspiration.topic],
    ["Aspirasi", aspiration.message],
  ];
  const text = fields.map(([label, value]) => `${label}:\n${value}`).join("\n\n");
  const html = `<dl>${fields
    .map(
      ([label, value]) =>
        `<dt><strong>${escapeHtml(label)}</strong></dt><dd>${escapeHtml(value).replace(/\r?\n/g, "<br>")}</dd>`,
    )
    .join("")}</dl>`;
  return { text, html };
}

async function sendAspirationEmails({ transporter, from, aspiration, adminEmails }) {
  const details = aspirationDetails(aspiration);
  const safeName = aspiration.fullName.replace(/[\r\n]+/g, " ").slice(0, 120);
  const messages = [
    {
      to: aspiration.email,
      from,
      subject: "Terima kasih telah menyampaikan aspirasi — DPM KM UNNES",
      text: `Halo ${aspiration.fullName},\n\nTerima kasih telah menyampaikan aspirasi kepada DPM KM UNNES. Aspirasi Anda telah kami terima dan akan ditindaklanjuti.\n\n${details.text}\n\nSalam,\nDPM KM UNNES`,
      html: `<p>Halo ${escapeHtml(aspiration.fullName)},</p><p>Terima kasih telah menyampaikan aspirasi kepada DPM KM UNNES. Aspirasi Anda telah kami terima dan akan ditindaklanjuti.</p>${details.html}<p>Salam,<br>DPM KM UNNES</p>`,
    },
    ...adminEmails.map((email) => ({
      to: email,
      from,
      replyTo: { name: safeName, address: aspiration.email },
      subject: `Aspirasi baru dari ${safeName} — ${aspiration.topic}`,
      text: `Aspirasi baru diterima melalui situs DPM KM UNNES.\n\n${details.text}`,
      html: `<p>Aspirasi baru diterima melalui situs DPM KM UNNES.</p>${details.html}`,
    })),
  ];

  const results = await Promise.allSettled(
    messages.map(({ ...message }) =>
      Promise.resolve().then(() => transporter.sendMail(message)),
    ),
  );
  return {
    senderSent: results[0].status === "fulfilled",
    adminsSent: results.slice(1).filter((result) => result.status === "fulfilled").length,
    adminsTotal: adminEmails.length,
  };
}

module.exports = { createAspirationTransporter, sendAspirationEmails };
