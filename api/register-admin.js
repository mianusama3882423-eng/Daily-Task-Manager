// ============================================================
// DAILY TASK MANAGER
// Admin Registration + Email OTP
// Version 3.1.0
// ============================================================

import crypto from "node:crypto";

import {
  getApps,
  initializeApp,
  cert
} from "firebase-admin/app";

import {
  getAuth
} from "firebase-admin/auth";

import {
  getFirestore,
  FieldValue
} from "firebase-admin/firestore";


// ============================================================
// FIREBASE ADMIN
// ============================================================

function getAdminApp() {

  if (getApps().length) {
    return getApps()[0];
  }

  const rawKey =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!rawKey) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is missing in Vercel."
    );
  }

  let serviceAccount;

  try {

    serviceAccount =
      JSON.parse(rawKey);

  } catch (error) {

    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON."
    );

  }

  if (
    !serviceAccount.project_id ||
    !serviceAccount.client_email ||
    !serviceAccount.private_key
  ) {

    throw new Error(
      "Firebase service account JSON is incomplete."
    );

  }

  return initializeApp({

    credential:
      cert({

        projectId:
          serviceAccount.project_id,

        clientEmail:
          serviceAccount.client_email,

        privateKey:
          serviceAccount.private_key
            .replace(/\\n/g, "\n")

      })

  });

}


// ============================================================
// HELPERS
// ============================================================

function clean(value) {

  return String(
    value ?? ""
  ).trim();

}


function normalizeEmail(value) {

  return clean(value)
    .toLowerCase();

}


function emailIsValid(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);

}


function generateOTP() {

  return crypto
    .randomInt(
      100000,
      1000000
    )
    .toString();

}


function hashValue(value) {

  const secret =
    process.env.OTP_HASH_SECRET ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(value)
    .digest("hex");

}


function emailDocumentId(email) {

  return crypto
    .createHash("sha256")
    .update(email)
    .digest("hex");

}


function safeEqual(a, b) {

  const first =
    Buffer.from(
      String(a),
      "utf8"
    );

  const second =
    Buffer.from(
      String(b),
      "utf8"
    );

  if (
    first.length !==
    second.length
  ) {

    return false;

  }

  return crypto.timingSafeEqual(
    first,
    second
  );

}


// ============================================================
// SEND OTP EMAIL
// ============================================================

async function sendOTPEmail(
  email,
  name,
  code
) {

  const apiKey =
    process.env.RESEND_API_KEY;

  const fromEmail =
    process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {

    throw new Error(
      "RESEND_API_KEY is missing in Vercel."
    );

  }

  if (!fromEmail) {

    throw new Error(
      "RESEND_FROM_EMAIL is missing in Vercel."
    );

  }


  const response =
    await fetch(
      "https://api.resend.com/emails",
      {

        method:
          "POST",

        headers: {

          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify({

            from:
              fromEmail,

            to:
              [email],

            subject:
              "Daily Task Manager - Email Verification Code",

            html: `

              <!DOCTYPE html>

              <html>

              <head>

                <meta charset="UTF-8">

                <meta
                  name="viewport"
                  content="width=device-width,initial-scale=1"
                >

              </head>

              <body
                style="
                  margin:0;
                  padding:0;
                  background:#f4f7fb;
                  font-family:Arial,sans-serif;
                "
              >

                <div
                  style="
                    max-width:520px;
                    margin:40px auto;
                    background:#ffffff;
                    border-radius:20px;
                    overflow:hidden;
                    box-shadow:0 10px 35px rgba(0,0,0,.08);
                  "
                >

                  <div
                    style="
                      background:linear-gradient(
                        135deg,
                        #4f46e5,
                        #7c3aed
                      );
                      padding:30px;
                      color:white;
                      text-align:center;
                    "
                  >

                    <h1
                      style="
                        margin:0;
                        font-size:25px;
                      "
                    >
                      Daily Task Manager
                    </h1>

                    <p
                      style="
                        margin:8px 0 0;
                        opacity:.9;
                      "
                    >
                      Email Verification
                    </p>

                  </div>


                  <div
                    style="
                      padding:35px 28px;
                      text-align:center;
                    "
                  >

                    <p
                      style="
                        font-size:17px;
                        color:#1f2937;
                      "
                    >
                      Hello ${name},
                    </p>

                    <p
                      style="
                        color:#6b7280;
                        line-height:1.6;
                      "
                    >
                      Use the verification code below
                      to complete your administrator
                      registration.
                    </p>


                    <div
                      style="
                        margin:28px 0;
                        padding:20px;
                        background:#f3f4ff;
                        border-radius:14px;
                      "
                    >

                      <div
                        style="
                          font-size:36px;
                          font-weight:800;
                          letter-spacing:9px;
                          color:#4f46e5;
                        "
                      >
                        ${code}
                      </div>

                    </div>


                    <p
                      style="
                        color:#6b7280;
                        font-size:14px;
                      "
                    >
                      This code expires in
                      <strong>10 minutes</strong>.
                    </p>

                    <p
                      style="
                        color:#9ca3af;
                        font-size:12px;
                        margin-top:28px;
                      "
                    >
                      If you did not request this
                      verification code, you can
                      safely ignore this email.
                    </p>

                  </div>

                </div>

              </body>

              </html>

            `

          })

      });


  const result =
    await response.json();


  if (!response.ok) {

    console.error(
      "RESEND ERROR:",
      result
    );

    throw new Error(
      result?.message ||
      result?.error ||
      "Unable to send verification email."
    );

  }

  return result;

}


// ============================================================
// SEND CODE
// ============================================================

async function sendCode(
  req,
  res
) {

  const {
    name,
    email,
    password
  } =
    req.body || {};


  const cleanName =
    clean(name);

  const cleanEmail =
    normalizeEmail(email);

  const cleanPassword =
    String(password || "");


  if (
    !cleanName ||
    !cleanEmail ||
    !cleanPassword
  ) {

    return res.status(400).json({

      success:false,

      message:
        "Name, email and password are required."

    });

  }


  if (
    cleanName.length < 2
  ) {

    return res.status(400).json({

      success:false,

      message:
        "Please enter a valid name."

    });

  }


  if (
    !emailIsValid(cleanEmail)
  ) {

    return res.status(400).json({

      success:false,

      message:
        "Please enter a valid email address."

    });

  }


  if (
    cleanPassword.length < 6
  ) {

    return res.status(400).json({

      success:false,

      message:
        "Password must contain at least 6 characters."

    });

  }


  const app =
    getAdminApp();

  const adminAuth =
    getAuth(app);

  const db =
    getFirestore(app);


  // ----------------------------------------------------------
  // CHECK EXISTING AUTH USER
  // ----------------------------------------------------------

  try {

    await adminAuth
      .getUserByEmail(
        cleanEmail
      );

    return res.status(400).json({

      success:false,

      message:
        "This email is already registered."

    });

  } catch (error) {

    if (
      error.code !==
      "auth/user-not-found"
    ) {

      throw error;

    }

  }


  const otpDocId =
    emailDocumentId(
      cleanEmail
    );

  const otpRef =
    db
      .collection(
        "adminRegistrationOtps"
      )
      .doc(otpDocId);


  const existing =
    await otpRef.get();


  const now =
    Date.now();


  if (existing.exists) {

    const old =
      existing.data();

    const sentAt =
      Number(
        old?.sentAtMs || 0
      );

    const secondsPassed =
      Math.floor(
        (now - sentAt) /
        1000
      );


    if (
      secondsPassed < 30
    ) {

      return res.status(429).json({

        success:false,

        message:
          `Please wait ${
            30 - secondsPassed
          } seconds before requesting another code.`,

        resendAfterSeconds:
          30 - secondsPassed

      });

    }

  }


  const code =
    generateOTP();


  const otpHash =
    hashValue(
      code
    );


  await otpRef.set({

    email:
      cleanEmail,

    name:
      cleanName,

    otpHash,

    expiresAtMs:
      now +
      10 * 60 * 1000,

    sentAtMs:
      now,

    attempts:
      0,

    createdAtMs:
      now

  });


  try {

    await sendOTPEmail(
      cleanEmail,
      cleanName,
      code
    );

  } catch (error) {

    await otpRef.delete();

    throw error;

  }


  return res.status(200).json({

    success:true,

    message:
      "Verification code sent to your email.",

    expiresInSeconds:
      600,

    resendAfterSeconds:
      30

  });

}


// ============================================================
// VERIFY CODE
// ============================================================

async function verifyCode(
  req,
  res
) {

  const {
    name,
    email,
    password,
    code
  } =
    req.body || {};


  const cleanName =
    clean(name);

  const cleanEmail =
    normalizeEmail(email);

  const cleanPassword =
    String(password || "");

  const cleanCode =
    clean(code);


  if (
    !cleanName ||
    !cleanEmail ||
    !cleanPassword ||
    !cleanCode
  ) {

    return res.status(400).json({

      success:false,

      message:
        "Registration details and verification code are required."

    });

  }


  if (
    !/^\d{6}$/.test(
      cleanCode
    )
  ) {

    return res.status(400).json({

      success:false,

      message:
        "Enter the 6-digit verification code."

    });

  }


  const app =
    getAdminApp();

  const adminAuth =
    getAuth(app);

  const db =
    getFirestore(app);


  const otpDocId =
    emailDocumentId(
      cleanEmail
    );

  const otpRef =
    db
      .collection(
        "adminRegistrationOtps"
      )
      .doc(otpDocId);


  const snap =
    await otpRef.get();


  if (!snap.exists) {

    return res.status(400).json({

      success:false,

      message:
        "No active verification code. Please request a new code."

    });

  }


  const otp =
    snap.data();


  if (
    otp.email !==
    cleanEmail
  ) {

    return res.status(400).json({

      success:false,

      message:
        "Verification session is invalid."

    });

  }


  const now =
    Date.now();


  if (
    now >
    Number(
      otp.expiresAtMs || 0
    )
  ) {

    await otpRef.delete();

    return res.status(400).json({

      success:false,

      message:
        "Verification code expired. Please request a new code."

    });

  }


  const attempts =
    Number(
      otp.attempts || 0
    );


  if (
    attempts >= 5
  ) {

    await otpRef.delete();

    return res.status(429).json({

      success:false,

      message:
        "Too many incorrect attempts. Please request a new code."

    });

  }


  const suppliedHash =
    hashValue(
      cleanCode
    );


  const valid =
    safeEqual(
      suppliedHash,
      otp.otpHash
    );


  if (!valid) {

    await otpRef.update({

      attempts:
        FieldValue.increment(1)

    });


    const remaining =
      Math.max(
        0,
        4 - attempts
      );


    return res.status(400).json({

      success:false,

      message:
        remaining > 0
          ? `Incorrect verification code. ${remaining} attempt(s) remaining.`
          : "Incorrect verification code. Please request a new code."

    });

  }


  // ----------------------------------------------------------
  // CREATE FIREBASE AUTH USER
  // ----------------------------------------------------------

  let user;


  try {

    user =
      await adminAuth.createUser({

        email:
          cleanEmail,

        password:
          cleanPassword,

        displayName:
          cleanName,

        emailVerified:
          true

      });

  } catch (error) {

    if (
      error.code ===
      "auth/email-already-exists"
    ) {

      await otpRef.delete();

      return res.status(400).json({

        success:false,

        message:
          "This email is already registered."

      });

    }


    if (
      error.code ===
      "auth/invalid-email"
    ) {

      return res.status(400).json({

        success:false,

        message:
          "Please enter a valid email address."

      });

    }


    if (
      error.code ===
      "auth/weak-password"
    ) {

      return res.status(400).json({

        success:false,

        message:
          "Password must contain at least 6 characters."

      });

    }

    throw error;

  }


  // ----------------------------------------------------------
  // CREATE FIRESTORE PROFILE
  // ----------------------------------------------------------

  try {

    await db
      .collection("users")
      .doc(user.uid)
      .set({

        uid:
          user.uid,

        name:
          cleanName,

        email:
          cleanEmail,

        role:
          "admin",

        active:
          true,

        createdAt:
          FieldValue.serverTimestamp()

      });


  } catch (error) {

    // Cleanup Auth account if profile creation fails.

    try {

      await adminAuth
        .deleteUser(
          user.uid
        );

    } catch (
      cleanupError
    ) {

      console.error(
        "AUTH CLEANUP ERROR:",
        cleanupError
      );

    }

    throw error;

  }


  await otpRef.delete();


  return res.status(201).json({

    success:true,

    message:
      "Email verified. Your account has been created.",

    uid:
      user.uid

  });

}


// ============================================================
// MAIN HANDLER
// ============================================================

export default async function handler(
  req,
  res
) {

  if (
    req.method !==
    "POST"
  ) {

    return res.status(405).json({

      success:false,

      message:
        "Method not allowed."

    });

  }


  try {

    const action =
      clean(
        req.body?.action
      );


    if (
      action ===
      "send-code"
    ) {

      return await sendCode(
        req,
        res
      );

    }


    if (
      action ===
      "verify-code"
    ) {

      return await verifyCode(
        req,
        res
      );

    }


    return res.status(400).json({

      success:false,

      message:
        "Invalid registration action."

    });


  } catch (error) {

    console.error(
      "REGISTER ADMIN ERROR:",
      error
    );


    if (
      error.message?.includes(
        "FIREBASE_SERVICE_ACCOUNT_KEY is missing"
      )
    ) {

      return res.status(500).json({

        success:false,

        message:
          "Firebase server configuration is missing. Check Vercel Environment Variables."

      });

    }


    if (
      error.message?.includes(
        "not valid JSON"
      )
    ) {

      return res.status(500).json({

        success:false,

        message:
          "Firebase server configuration is invalid."

      });

    }


    if (
      error.message?.includes(
        "service account JSON is incomplete"
      )
    ) {

      return res.status(500).json({

        success:false,

        message:
          "Firebase service account configuration is incomplete."

      });

    }


    if (
      error.message?.includes(
        "RESEND_API_KEY"
      )
    ) {

      return res.status(500).json({

        success:false,

        message:
          "Email service is not configured. Check RESEND_API_KEY in Vercel."

      });

    }


    if (
      error.message?.includes(
        "RESEND_FROM_EMAIL"
      )
    ) {

      return res.status(500).json({

        success:false,

        message:
          "Email sender is not configured. Check RESEND_FROM_EMAIL in Vercel."

      });

    }


    return res.status(500).json({

      success:false,

      message:
        error.message ||
        "Unable to process registration."

    });

  }

    }
