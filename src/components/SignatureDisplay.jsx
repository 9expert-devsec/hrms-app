"use client";

export default function SignatureDisplay({
  signature,
  label = "Signature",
  signerName,
  signedAt,
}) {
  const formattedDate = signedAt
    ? new Date(signedAt).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontWeight: 600, color: "#0D1B2A", fontSize: 14 }}>
        {label}
      </span>

      {signature ? (
        <div
          style={{
            border: "1px solid rgba(0,92,255,0.20)",
            borderRadius: 12,
            padding: 8,
            background: "#FFFFFF",
            display: "inline-block",
          }}
        >
          <img
            src={signature}
            alt={label}
            style={{
              width: 400,
              maxWidth: "100%",
              height: "auto",
              display: "block",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            width: 400,
            maxWidth: "100%",
            height: 100,
            border: "2px dashed #D1D5DB",
            borderRadius: 12,
            background: "#F9FAFB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#5E6A7E", fontSize: 13 }}>Not signed</span>
        </div>
      )}

      {(signerName || formattedDate) && (
        <div
          style={{
            display: "flex",
            gap: 12,
            fontSize: 12,
            color: "#5E6A7E",
          }}
        >
          {signerName && <span>{signerName}</span>}
          {formattedDate && <span>{formattedDate}</span>}
        </div>
      )}
    </div>
  );
}
