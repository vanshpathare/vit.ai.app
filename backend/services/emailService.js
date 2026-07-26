import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// 1. Create the Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465, // SSL Port (Bypasses Render port blocks)
  secure: true, // Force SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Your 16-character Google App Password
  },
  tls: {
    rejectUnauthorized: false, // Prevents connection hangs on production
  },
});

// 2. Export Helper (Named sendOTPEmail with 3 parameters to match authController)
export const sendOTPEmail = async (toEmail, name, otpCode) => {
  try {
    // 💻 AUTOMATED DEVELOPMENT STREAM: Log OTP to terminal when testing locally
    if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
      console.log("\n========================================================");
      console.log("🛠️  [DEV ENVIRONMENT ACTIVE - SIMULATING EMAIL]");
      console.log(`📬 Outgoing Mail To : ${toEmail}`);
      console.log(`👤 Recipient Name   : ${name}`);
      console.log(`🔑 VERIFICATION OTP : ${otpCode}`);
      console.log("========================================================\n");

      return true; // Bypass sending actual email in dev
    }

    // 🌐 LIVE PRODUCTION TRANSMISSION PIPELINE
    const info = await transporter.sendMail({
      from: `"VIT LangAI Portal" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Verify Your VIT LangAI Account",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 500px; margin: 0 auto; rounded: 8px;">
          <h2 style="color: #4f46e5;">Welcome to LangAI, ${name}!</h2>
          <p style="color: #334155; font-size: 14px;">Use the following One-Time Password (OTP) to complete your verification:</p>
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 15px; text-align: center; margin: 20px 0; border-radius: 6px;">
            <h1 style="font-family: monospace; letter-spacing: 6px; color: #4f46e5; margin: 0;">${otpCode}</h1>
          </div>
          <p style="color: #64748b; font-size: 12px;">This validation code will expire in exactly 10 minutes.</p>
        </div>
      `,
    });

    console.log(
      `✅ Production Email Sent Successfully. MessageId: ${info.messageId}`,
    );
    return true;
  } catch (error) {
    console.error(`❌ Nodemailer Email Gateway Exception: ${error.message}`);
    return false;
  }
};

// import { Resend } from "resend";
// import dotenv from "dotenv";

// dotenv.config();

// const resend = process.env.RESEND_API_KEY
//   ? new Resend(process.env.RESEND_API_KEY)
//   : null;

// // 🟢 UPDATED: Reads the "From" address from an env var instead of the hardcoded
// // Resend test sender (onboarding@resend.dev). Once your domain is verified in Resend
// // (see the domain setup steps), set RESEND_FROM_EMAIL to an address on that domain,
// // e.g. "LangAI Verification <noreply@yourdomain.com>". Falls back to the Resend test
// // sender if the env var isn't set yet, so nothing breaks mid-setup.
// const FROM_ADDRESS =
//   process.env.RESEND_FROM_EMAIL ||
//   "LangAI Verification <onboarding@resend.dev>";

// export const sendOTPEmail = async (toEmail, name, otpCode) => {
//   try {
//     // 💻 AUTOMATED DEVELOPMENT STREAM
//     if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
//       console.log("\n========================================================");
//       console.log("🛠️  [DEV ENVIRONMENT ACTIVE - SIMULATING EMAIL]");
//       console.log(`📬 Outgoing Mail To : ${toEmail}`);
//       console.log(`👤 Recipient Name   : ${name}`);
//       console.log(`🔑 VERIFICATION OTP : ${otpCode}`);
//       console.log("========================================================\n");

//       return true; // Stops execution here so it prints to terminal and skips Resend network
//     }

//     // 🌐 LIVE PRODUCTION TRANSMISSION PIPELINE
//     if (!resend) {
//       console.error(
//         "❌ Production Error: Resend API Key is missing in environment variables.",
//       );
//       return false;
//     }

//     const data = await resend.emails.send({
//       from: FROM_ADDRESS,
//       to: toEmail,
//       subject: "Verify Your VIT LangAI Account",
//       html: `
//         <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 500px;">
//           <h2>Welcome to LangAI, ${name}!</h2>
//           <p>Use the following secure One-Time Password (OTP) to complete your verification sequence:</p>
//           <h1 style="background: #f4f4f4; padding: 10px; text-align: center; letter-spacing: 5px; color: #333;">${otpCode}</h1>
//           <p style="color: #666; font-size: 12px;">This validation checkpoint code will expire in exactly 10 minutes.</p>
//         </div>
//       `,
//     });

//     return !!data;
//   } catch (error) {
//     console.error(
//       `❌ Email Gateway Infrastructure Exception: ${error.message}`,
//     );
//     return false;
//   }
// };
