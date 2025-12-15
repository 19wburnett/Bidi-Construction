/**
 * Bidi Email Templates - Base Layout
 * 
 * Shared styles and layout components for all Bidi emails.
 * Uses inline styles for maximum email client compatibility.
 */

// Bidi Brand Colors
export const BRAND_COLORS = {
  orange: '#EB5023',
  orangeLight: '#FEF3EC',
  black: '#1E1D1E',
  darkGray: '#404042',
  mediumGray: '#777878',
  lightGray: '#F3F4F6',
  white: '#FFFFFF',
}

// Bidi Logo as Base64 SVG Data URI for email compatibility
export const BIDI_LOGO_BASE64 = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjYiIGhlaWdodD0iOTMiIHZpZXdCb3g9IjAgMCA2NiA5MyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgZmlsdGVyPSJ1cmwoI2ZpbHRlcjBfZF8yNF8zKSI+CjxwYXRoIGQ9Ik00MS45MDY3IDI4Ljg5NjZMMzMuMjg3MSAzNEwyMi45NTA1IDI4LjVMMzIuNzEyOSAyM0w0MS45MDY3IDI4Ljg5NjZaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMzMuODYxNCAwTDYyIDE3TDQxLjkwNjcgMjkuNUwzMi45OTE1IDIzLjkwMzVMMjQuMTM0OSAyOUw0IDE4TDMzLjg2MTQgMFoiIGZpbGw9IiMxRTFEMUUiLz4KPHBhdGggZD0iTTMzLjI4NzEgNjQuNVY1OC41TDQuNTc0MjYgNDJWNDcuNUwzMy4yODcxIDY0LjVaIiBmaWxsPSIjRjFBRDZGIi8+CjxwYXRoIGQ9Ik0zMy4yODcxIDg1VjYzLjk0NTlMNC41NzQyNiA0N1Y2OC4wNTQxTDMzLjI4NzEgODVaIiBmaWxsPSIjRUI1MDIzIi8+CjxwYXRoIGQ9Ik00LjU3NDI2IDQyTDMzLjI4NzEgNTguNVYzNEw0IDE4TDQuNTc0MjYgNDJaIiBmaWxsPSIjNDA0MDQyIi8+CjxwYXRoIGQ9Ik0zMy4yODcxIDg1VjY0TDYyIDQ3VjY4LjVMMzMuMjg3MSA4NVoiIGZpbGw9IiNGNThEMjIiLz4KPHBhdGggZD0iTTYyIDQxLjVMMzMuMjg3MSA1OC4zNjY3VjY0TDYyIDQ3LjYzMzNWNDEuNVoiIGZpbGw9IiNGMUNEQTIiLz4KPHBhdGggZD0iTTYyIDQyTDMzLjI4NzEgNTguNVYzNEw2MiAxN1Y0MloiIGZpbGw9IiM3Nzc4NzgiLz4KPC9nPgo8ZGVmcz4KPGZpbHRlciBpZD0iZmlsdGVyMF9kXzI0XzMiIHg9IjAiIHk9IjAiIHdpZHRoPSI2NiIgaGVpZ2h0PSI5MyIgZmlsdGVyVW5pdHM9InVzZXJTcGFjZU9uVXNlIiBjb2xvci1pbnRlcnBvbGF0aW9uLWZpbHRlcnM9InNSR0IiPgo8ZmVGbG9vZCBmbG9vZC1vcGFjaXR5PSIwIiByZXN1bHQ9IkJhY2tncm91bmRJbWFnZUZpeCIvPgo8ZmVDb2xvck1hdHJpeCBpbj0iU291cmNlQWxwaGEiIHR5cGU9Im1hdHJpeCIgdmFsdWVzPSIwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAxMjcgMCIgcmVzdWx0PSJoYXJkQWxwaGEiLz4KPGZlT2Zmc2V0IGR5PSI0Ii8+CjxmZUdhdXNzaWFuQmx1ciBzdGREZXZpYXRpb249IjIiLz4KPGZlQ29tcG9zaXRlIGluMj0iaGFyZEFscGhhIiBvcGVyYXRvcj0ib3V0Ii8+CjxmZUNvbG9yTWF0cml4IHR5cGU9Im1hdHJpeCIgdmFsdWVzPSIwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwIDAgMCAwLjI1IDAiLz4KPGZlQmxlbmQgbW9kZT0ibm9ybWFsIiBpbjI9IkJhY2tncm91bmRJbWFnZUZpeCIgcmVzdWx0PSJlZmZlY3QxX2Ryb3BTaGFkb3dfMjRfMyIvPgo8ZmVCbGVuZCBtb2RlPSJub3JtYWwiIGluPSJTb3VyY2VHcmFwaGljIiBpbjI9ImVmZmVjdDFfZHJvcFNoYWRvd18yNF8zIiByZXN1bHQ9InNoYXBlIi8+CjwvZmlsdGVyPgo8L2RlZnM+Cjwvc3ZnPgo=`

// Common inline styles for email compatibility
export const EMAIL_STYLES = {
  // Container styles
  wrapper: `
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: ${BRAND_COLORS.black};
    background-color: ${BRAND_COLORS.white};
  `,
  
  // Header styles
  header: `
    background-color: ${BRAND_COLORS.black};
    padding: 24px 32px;
    text-align: center;
  `,
  
  headerAccent: `
    height: 4px;
    background-color: ${BRAND_COLORS.orange};
  `,
  
  logo: `
    height: 50px;
    width: auto;
  `,
  
  headerTitle: `
    color: ${BRAND_COLORS.white};
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 12px 0 0 0;
  `,
  
  // Content styles
  content: `
    padding: 32px;
    background-color: ${BRAND_COLORS.white};
  `,
  
  title: `
    font-size: 24px;
    font-weight: 700;
    color: ${BRAND_COLORS.black};
    margin: 0 0 8px 0;
  `,
  
  subtitle: `
    font-size: 16px;
    color: ${BRAND_COLORS.mediumGray};
    margin: 0 0 24px 0;
  `,
  
  paragraph: `
    font-size: 15px;
    color: ${BRAND_COLORS.darkGray};
    margin: 0 0 16px 0;
    line-height: 1.7;
  `,
  
  // Info box styles
  infoBox: `
    background-color: ${BRAND_COLORS.lightGray};
    border-radius: 8px;
    padding: 20px;
    margin: 24px 0;
  `,
  
  infoBoxHighlight: `
    background-color: ${BRAND_COLORS.orangeLight};
    border-left: 4px solid ${BRAND_COLORS.orange};
    border-radius: 0 8px 8px 0;
    padding: 20px;
    margin: 24px 0;
  `,
  
  infoLabel: `
    font-size: 12px;
    font-weight: 600;
    color: ${BRAND_COLORS.mediumGray};
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0 0 4px 0;
  `,
  
  infoValue: `
    font-size: 16px;
    font-weight: 600;
    color: ${BRAND_COLORS.black};
    margin: 0;
  `,
  
  // Button styles
  buttonPrimary: `
    display: inline-block;
    background-color: ${BRAND_COLORS.orange};
    color: ${BRAND_COLORS.white};
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
    padding: 14px 28px;
    border-radius: 6px;
    margin: 8px 0;
  `,
  
  buttonSecondary: `
    display: inline-block;
    background-color: ${BRAND_COLORS.white};
    color: ${BRAND_COLORS.orange};
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
    padding: 12px 26px;
    border-radius: 6px;
    border: 2px solid ${BRAND_COLORS.orange};
    margin: 8px 0;
  `,
  
  // Table styles
  table: `
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
  `,
  
  tableHeader: `
    background-color: ${BRAND_COLORS.lightGray};
    padding: 12px 16px;
    text-align: left;
    font-size: 13px;
    font-weight: 600;
    color: ${BRAND_COLORS.darkGray};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 2px solid ${BRAND_COLORS.orange};
  `,
  
  tableCell: `
    padding: 12px 16px;
    border-bottom: 1px solid ${BRAND_COLORS.lightGray};
    font-size: 14px;
    color: ${BRAND_COLORS.darkGray};
  `,
  
  // Divider
  divider: `
    height: 1px;
    background-color: ${BRAND_COLORS.lightGray};
    margin: 24px 0;
  `,
  
  // Footer styles
  footer: `
    background-color: ${BRAND_COLORS.lightGray};
    padding: 24px 32px;
    text-align: center;
  `,
  
  footerText: `
    font-size: 13px;
    color: ${BRAND_COLORS.mediumGray};
    margin: 0 0 8px 0;
  `,
  
  footerLink: `
    color: ${BRAND_COLORS.orange};
    text-decoration: none;
    font-weight: 500;
  `,
  
  // List styles
  list: `
    margin: 16px 0;
    padding-left: 20px;
  `,
  
  listItem: `
    font-size: 15px;
    color: ${BRAND_COLORS.darkGray};
    margin: 8px 0;
    line-height: 1.6;
  `,
}

/**
 * Generates the base email wrapper with header and footer
 */
export function generateEmailWrapper(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Bidi</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    td { padding: 0; }
  </style>
  <![endif]-->
  <style>
    @media only screen and (max-width: 600px) {
      .wrapper { width: 100% !important; padding: 0 16px !important; }
      .content { padding: 24px 16px !important; }
      .header { padding: 20px 16px !important; }
      .footer { padding: 20px 16px !important; }
      .button { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND_COLORS.lightGray};">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND_COLORS.lightGray};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" class="wrapper" cellpadding="0" cellspacing="0" style="${EMAIL_STYLES.wrapper}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Orange Accent Bar -->
          <tr>
            <td style="${EMAIL_STYLES.headerAccent}"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td class="header" style="${EMAIL_STYLES.header}">
              <img src="${BIDI_LOGO_BASE64}" alt="Bidi" style="${EMAIL_STYLES.logo}">
              <p style="${EMAIL_STYLES.headerTitle}">Construction Bidding</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="content" style="${EMAIL_STYLES.content}">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="footer" style="${EMAIL_STYLES.footer}">
              <p style="${EMAIL_STYLES.footerText}">
                This email was sent by <strong>Bidi</strong> on behalf of a general contractor.
              </p>
              <p style="${EMAIL_STYLES.footerText}">
                Simply reply to this email to respond.
              </p>
              <p style="${EMAIL_STYLES.footerText}; margin-top: 16px; font-size: 12px;">
                © ${new Date().getFullYear()} Bidi. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

/**
 * Formats a date for display in emails
 */
export function formatEmailDate(date: string | Date | null): string {
  if (!date) return 'Not specified'
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Formats currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}













