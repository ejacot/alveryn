package com.alveryn.api.auth.email;

final class AlverynEmailTemplate {
  private AlverynEmailTemplate() {}

  static String render(
      String subject, String heading, String introduction, String code, String securityNote) {
    return """
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>%s</title>
          </head>
          <body style="margin:0;padding:0;background:#f4f5f3;color:#151715;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="display:none;max-height:0;overflow:hidden;opacity:0;">%s</div>
            <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f5f3;">
              <tr>
                <td align="center" style="padding:40px 16px;">
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="width:100%%;max-width:560px;">
                    <tr>
                      <td style="padding:0 4px 24px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td align="center" valign="middle" style="width:38px;height:38px;border-radius:12px;background:#111311;">
                              <img src="https://alveryn.com/brand/alveryn-mark.png" width="28" height="28" alt="" style="display:block;width:28px;height:28px;margin:5px;border:0;object-fit:contain;">
                            </td>
                            <td style="padding-left:11px;color:#151515;font-family:Sora,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12.5px;font-weight:600;line-height:1;letter-spacing:3.5px;text-transform:uppercase;">ALVERYN</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="background:#ffffff;border:1px solid #e2e5e1;border-radius:22px;padding:40px 40px 36px;box-shadow:0 8px 30px rgba(21,23,21,0.05);">
                        <div style="display:inline-block;margin-bottom:22px;padding:7px 11px;border-radius:999px;background:#e8f5ef;color:#17734b;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Secure account action</div>
                        <h1 style="margin:0 0 14px;color:#151715;font-size:30px;line-height:1.2;font-weight:750;letter-spacing:-0.8px;">%s</h1>
                        <p style="margin:0;color:#626762;font-size:16px;line-height:1.65;">%s</p>
                        <div style="margin:30px 0;padding:23px 16px;border:1px solid #dfe4df;border-radius:16px;background:#f7f8f6;text-align:center;">
                          <div style="margin-bottom:9px;color:#777d77;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">Your verification code</div>
                          <div style="color:#111311;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:34px;font-weight:700;line-height:1.2;letter-spacing:8px;">%s</div>
                        </div>
                        <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td style="border-left:3px solid #22845a;padding:2px 0 2px 14px;color:#747974;font-size:13px;line-height:1.55;">%s</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:24px 20px 0;color:#8a8f8a;font-size:12px;line-height:1.6;">
                        <span style="color:#555a55;font-family:Sora,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:10px;font-weight:600;letter-spacing:2.3px;text-transform:uppercase;">ALVERYN</span> &nbsp;·&nbsp; Work, clearly.<br>
                        This is an automated message. Please do not reply.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
        """
        .formatted(
            escape(subject),
            escape(introduction),
            escape(heading),
            escape(introduction),
            escape(code),
            escape(securityNote));
  }

  private static String escape(String value) {
    return value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;");
  }
}
