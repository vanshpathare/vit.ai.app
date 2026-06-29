// import { Resend } from "resend";
// import dotenv from "dotenv";

// dotenv.config();

// const resend = new Resend(process.env.RESEND_API_KEY);

// export const sendOTPEmail = async (email, name, otp) => {
//   try {
//     const data = await resend.emails.send({
//       from: process.env.EMAIL_FROM,
//       to: email,
//       subject: "Verify Your Account - One-Time Password (OTP)",
//       html: `
//         <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px;">
//           <h2 style="color: #2563eb; text-align: center;">Account Verification Required</h2>
//           <p>Hello <strong>${name}</strong>,</p>
//           <p>Thank you for registering. Please use the following One-Time Password (OTP) to complete your identity layer activation:</p>
//           <div style="background: #f1f5f9; padding: 15px; font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center; color: #0f172a; border-radius: 8px; margin: 20px 0;">
//             ${otp}
//           </div>
//           <p style="font-size: 13px; color: #64748b; text-align: center;">This security validation sequence expires in exactly 10 minutes.</p>
//         </div>
//       `,
//     });
//     console.log(`✉️ Resend system accepted request: ${data.data?.id}`);
//     return true;
//   } catch (error) {
//     console.error(`❌ Email Delivery Error: ${error.message}`);
//     return false;
//   }
// };

import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

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
      from: "LangAI Verification <onboarding@resend.dev>",
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
