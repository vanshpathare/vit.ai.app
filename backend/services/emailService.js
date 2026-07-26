import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// 🟢 UPDATED: Reads the "From" address from an env var instead of the hardcoded
// Resend test sender (onboarding@resend.dev). Once your domain is verified in Resend
// (see the domain setup steps), set RESEND_FROM_EMAIL to an address on that domain,
// e.g. "LangAI Verification <noreply@yourdomain.com>". Falls back to the Resend test
// sender if the env var isn't set yet, so nothing breaks mid-setup.
const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL ||
  "LangAI Verification <onboarding@resend.dev>";

export const sendOTPEmail = async (toEmail, name, otpCode) => {
  try {
    // 💻 AUTOMATED DEVELOPMENT STREAM
    if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
      console.log("\n========================================================");
      console.log("🛠️  [DEV ENVIRONMENT ACTIVE - SIMULATING EMAIL]");
      console.log(`📬 Outgoing Mail To : ${toEmail}`);
      console.log(`👤 Recipient Name   : ${name}`);
      console.log(`🔑 VERIFICATION OTP : ${otpCode}`);
      console.log("========================================================\n");

      return true; // Stops execution here so it prints to terminal and skips Resend network
    }

    // 🌐 LIVE PRODUCTION TRANSMISSION PIPELINE
    if (!resend) {
      console.error(
        "❌ Production Error: Resend API Key is missing in environment variables.",
      );
      return false;
    }

    const data = await resend.emails.send({
      from: FROM_ADDRESS,
      to: toEmail,
      subject: "Verify Your VIT LangAI Account",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 500px;">
          <h2>Welcome to LangAI, ${name}!</h2>
          <p>Use the following secure One-Time Password (OTP) to complete your verification sequence:</p>
          <h1 style="background: #f4f4f4; padding: 10px; text-align: center; letter-spacing: 5px; color: #333;">${otpCode}</h1>
          <p style="color: #666; font-size: 12px;">This validation checkpoint code will expire in exactly 10 minutes.</p>
        </div>
      `,
    });

    return !!data;
  } catch (error) {
    console.error(
      `❌ Email Gateway Infrastructure Exception: ${error.message}`,
    );
    return false;
  }
};
