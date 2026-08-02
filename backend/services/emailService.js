import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Export Helper (Named sendOTPEmail with 3 parameters matching authController)
// export const sendOTPEmail = async (toEmail, name, otpCode) => {
//   try {
//     // 💻 AUTOMATED DEVELOPMENT STREAM: Log OTP to terminal when testing locally
//     if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
//       console.log("\n========================================================");
//       console.log("🛠️  [DEV ENVIRONMENT ACTIVE - SIMULATING EMAIL]");
//       console.log(`📬 Outgoing Mail To : ${toEmail}`);
//       console.log(`👤 Recipient Name   : ${name}`);
//       console.log(`🔑 VERIFICATION OTP : ${otpCode}`);
//       console.log("========================================================\n");

//       return true; // Bypass sending actual email in dev
//     }

//     // 🌐 LIVE PRODUCTION TRANSMISSION PIPELINE (Via Brevo HTTPS API)
//     if (!process.env.BREVO_API_KEY || !process.env.SENDER_EMAIL) {
//       console.error(
//         "❌ Production Error: BREVO_API_KEY or SENDER_EMAIL is missing in environment variables.",
//       );
//       return false;
//     }

//     const response = await axios.post(
//       "https://api.brevo.com/v3/smtp/email",
//       {
//         sender: {
//           name: "VIT LangAI Portal",
//           email: process.env.SENDER_EMAIL, // Your verified Brevo account email
//         },
//         to: [{ email: toEmail, name: name }],
//         subject: "Verify Your VIT LangAI Account",
//         htmlContent: `
//           <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 500px; margin: 0 auto; border-radius: 8px;">
//             <h2 style="color: #4f46e5;">Welcome to LangAI, ${name}!</h2>
//             <p style="color: #334155; font-size: 14px;">Use the following One-Time Password (OTP) to complete your verification sequence:</p>
//             <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 15px; text-align: center; margin: 20px 0; border-radius: 6px;">
//               <h1 style="font-family: monospace; letter-spacing: 6px; color: #4f46e5; margin: 0;">${otpCode}</h1>
//             </div>
//             <p style="color: #64748b; font-size: 12px;">This validation checkpoint code will expire in exactly 10 minutes.</p>
//           </div>
//         `,
//       },
//       {
//         headers: {
//           "api-key": process.env.BREVO_API_KEY,
//           "Content-Type": "application/json",
//         },
//       },
//     );

//     console.log(
//       `✅ Brevo API Email Sent Successfully. MessageId: ${response.data.messageId}`,
//     );
//     return true;
//   } catch (error) {
//     console.error(
//       `❌ Brevo API Email Exception: ${error.response?.data?.message || error.message}`,
//     );
//     return false;
//   }
// };
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

    // 🌐 LIVE PRODUCTION TRANSMISSION PIPELINE (Via Brevo HTTPS API)
    if (!process.env.BREVO_API_KEY || !process.env.SENDER_EMAIL) {
      console.error(
        "❌ Production Error: BREVO_API_KEY or SENDER_EMAIL is missing in environment variables.",
      );
      return false;
    }

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "AssignBuddy",
          email: process.env.SENDER_EMAIL, // Your verified Brevo account email
        },
        to: [{ email: toEmail, name: name }],
        subject: "Verify Your AssignBuddy Account",
        htmlContent: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; background-color: #ffffff; border: 1px solid #fed7aa; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.08);">
            
            <!-- Header Accent Bar -->
            <div style="background: linear-gradient(135deg, #ea580c 0%, #f59e0b 100%); padding: 24px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                AssignBuddy
              </h1>
              <p style="color: #ffedd5; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                Account Verification
              </p>
            </div>

            <!-- Main Content Area -->
            <div style="padding: 28px 24px; text-align: center;">
              <h2 style="color: #1e293b; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 8px;">
                Welcome aboard, ${name}!
              </h2>
              <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;">
                Use the verification code below to complete your sign-in sequence and unlock your workspace:
              </p>

              <!-- OTP Display Box -->
              <div style="background-color: #fff7ed; border: 2px dashed #fdba74; padding: 18px; border-radius: 12px; margin: 0 auto 24px auto; max-width: 320px;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #ea580c; display: block; margin-left: 8px;">
                  ${otpCode}
                </span>
              </div>

              <!-- Expiry Warning Badge -->
              <div style="background-color: #fffbebe6; border-left: 3px solid #f59e0b; padding: 10px 14px; border-radius: 0 8px 8px 0; text-align: left; margin-bottom: 20px;">
                <p style="color: #b45309; font-size: 12px; margin: 0; font-weight: 600;">
                  ⚠️ Security Notice: This OTP will expire in exactly <strong>10 minutes</strong>.
                </p>
              </div>

              <p style="color: #94a3b8; font-size: 11px; margin: 0; line-height: 1.4;">
                If you didn't request this verification code, you can safely ignore this email.
              </p>
            </div>

            <!-- Footer Strip -->
            <div style="background-color: #fff7ed; padding: 14px; text-align: center; border-top: 1px solid #ffedd5;">
              <p style="color: #9a3412; font-size: 11px; font-weight: 600; margin: 0;">
                © AssignBuddy • Automated System Notification
              </p>
            </div>

          </div>
        `,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      },
    );

    console.log(
      `✅ Brevo API Email Sent Successfully. MessageId: ${response.data.messageId}`,
    );
    return true;
  } catch (error) {
    console.error(
      `❌ Brevo API Email Exception: ${error.response?.data?.message || error.message}`,
    );
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
