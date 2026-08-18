export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("RESEND_API_KEY is not configured");
      return false;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "ZAITX MEDIA <noreply@zaitxmedia.com>",
        to,
        subject,
        html
      })
    });
    
    const data = await res.json();
    if (!res.ok) {
      console.error("Resend API Error:", data);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send email", err);
    return false;
  }
}

export const adminEmail = "admin@zaitxmedia.com";
