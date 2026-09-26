// ============================================================
// DAILY TASK MANAGER
// API: Register Admin
// Version 3.0.0
//
// Features:
// - 6-digit email OTP
// - Resend cooldown
// - OTP expiry
// - Maximum verification attempts
// - Hashed OTP storage
// - Firebase Auth admin creation
// - Firestore admin profile creation
// - No Firebase Storage required
// ============================================================

import crypto from "crypto";

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


/* =========================================================
   FIREBASE ADMIN INITIALIZATION
========================================================= */

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
          serviceAccount.private_key.replace(
            /\\n/g,
            "\n"
          )

      })

  });

}


/* =========================================================
   CONSTANTS
========================================================= */

const OTP_EXPIRY_MS =
  10 * 60 * 1000;

const RESEND_COOLDOWN_MS =
  30 * 1000;

const MAX_ATTEMPTS =
  5;


/* =========================================================
   HELPERS
========================================================= */

function clean(value) {

  return String(
    value ?? ""
  ).trim();

}


function normalizeEmail(email) {

  return clean(email)
    .toLowerCase();

}


function isValidEmail(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);

}


function hashValue(value) {

  const secret =
    process.env.OTP_HASH_SECRET ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    "daily-task-manager-otp-secret";


  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(String(value))
    .digest("hex");

}


function generateOTP() {

  return crypto
    .randomInt(
      100000,
      1000000
    )
    .toString();

}


function safeCompare(
  value1,
  value2
) {

  const a =
    Buffer.from(
      String(value1),
      "utf8"
    );

  const b =
    Buffer.from(
      String(value2),
      "utf8"
    );


  if (
    a.length !==
    b.length
  ) {

    return false;

  }


  return crypto.timingSafeEqual(
    a,
    b
  );

}


function validateRegistrationData(
  name,
  email,
  password
) {

  if (
    !name ||
    !email ||
    !password
  ) {

    return (
      "Name, email and password are required."
    );

  }


  if (
    name.length < 2
  ) {

    return (
      "Please enter a valid name."
    );

  }


  if (
    !isValidEmail(email)
  ) {

    return (
      "Please enter a valid email address."
    );

  }


  if (
    password.length < 6
  ) {

    return (
      "Password must contain at least 6 characters."
    );

  }


  return null;

}


/* =========================================================
   SEND EMAIL THROUGH RESEND
========================================================= */

async function sendOTPEmail(
  email,
  name,
  otp
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

        method: "POST",

        headers: {

          "Authorization":
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

                <meta
                  charset="UTF-8"
                >

                <meta
                  name="viewport"
                  content="width=device-width, initial-scale=1.0"
                >

              </head>

              <body
                style="
                  margin:0;
                  padding:0;
                  background:#f4f5fb;
                  font-family:Arial,sans-serif;
                "
              >

                <div
                  style="
                    max-width:520px;
                    margin:40px auto;
                    background:#ffffff;
                    border-radius:16px;
                    padding:30px;
                    box-shadow:0 8px 30px rgba(0,0,0,.08);
                  "
                >

                  <h2
                    style="
                      margin-top:0;
                      color:#5b54d9;
                    "
                  >
                    Daily Task Manager
                  </h2>

                  <p>
                    Hello
                    <strong>
                      ${escapeHtml(name)}
                    </strong>,
                  </p>

                  <p>
                    Your email verification code is:
                  </p>

                  <div
                    style="
                      margin:25px 0;
                      padding:18px;
                      text-align:center;
                      background:#f0efff;
                      border-radius:12px;
                    "
                  >

                    <span
                      style="
                        font-size:34px;
                        font-weight:bold;
                        letter-spacing:8px;
                        color:#5149d8;
                      "
                    >
                      ${otp}
                    </span>

                  </div>

                  <p>
                    This code will expire in
                    <strong>
                      10 minutes
                    </strong>.
                  </p>

                  <p
                    style="
                      color:#777;
                      font-size:13px;
                    "
                  >
                    If you did not request this code,
                    you can safely ignore this email.
                  </p>

                </div>

              </body>

              </html>
            `

          })

      }
    );


  let data = {};

  try {

    data =
      await response.json();

  } catch {

    data = {};

  }


  if (!response.ok) {

    console.error(
      "RESEND ERROR:",
      data
    );


    throw new Error(
      data?.message ||
      "Unable to send verification email."
    );

  }


  return data;

}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================================
   SEND OTP
========================================================= */

async function sendCode(
  req,
  res,
  db,
  adminAuth
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
    String(
      password || ""
    );


  const validationError =
    validateRegistrationData(
      cleanName,
      cleanEmail,
      cleanPassword
    );


  if (validationError) {

    return res.status(400).json({

      success:
        false,

      message:
        validationError

    });

  }


  /* ---------------------------------------------------------
     CHECK ENVIRONMENT
  --------------------------------------------------------- */

  if (
    !process.env.RESEND_API_KEY ||
    !process.env.RESEND_FROM_EMAIL
  ) {

    return res.status(500).json({

      success:
        false,

      message:
        "Email verification is not configured. Check RESEND_API_KEY and RESEND_FROM_EMAIL in Vercel."

    });

  }


  /* ---------------------------------------------------------
     CHECK EXISTING FIREBASE USER
  --------------------------------------------------------- */

  try {

    await adminAuth
      .getUserByEmail(
        cleanEmail
      );


    return res.status(400).json({

      success:
        false,

      message:
        "This email is already registered."

    });

  } catch (error) {

    if (
      error.code !==
      "auth/user-not-found"
    ) {

      console.error(
        "CHECK USER ERROR:",
        error
      );


      return res.status(500).json({

        success:
          false,

        message:
          "Unable to check email registration."

      });

    }

  }


  /* ---------------------------------------------------------
     OTP DOCUMENT
  --------------------------------------------------------- */

  const emailKey =
    hashValue(
      cleanEmail
    );


  const otpRef =
    db
      .collection(
        "adminRegistrationOtps"
      )
      .doc(emailKey);


  const existing =
    await otpRef.get();


  if (existing.exists) {

    const oldData =
      existing.data();


    const sentAt =
      Number(
        oldData?.sentAtMs ||
        0
      );


    const elapsed =
      Date.now() -
      sentAt;


    if (
      elapsed <
      RESEND_COOLDOWN_MS
    ) {

      const remaining =
        Math.ceil(
          (
            RESEND_COOLDOWN_MS -
            elapsed
          ) / 1000
        );


      return res.status(429).json({

        success:
          false,

        message:
          `Please wait ${remaining} seconds before requesting another code.`,

        resendAfterSeconds:
          remaining

      });

    }

  }


  /* ---------------------------------------------------------
     GENERATE OTP
  --------------------------------------------------------- */

  const otp =
    generateOTP();


  const otpHash =
    hashValue(
      otp
    );


  const now =
    Date.now();


  const expiresAtMs =
    now +
    OTP_EXPIRY_MS;


  /* ---------------------------------------------------------
     SAVE OTP
     
     IMPORTANT:
     Password is NOT stored.
  --------------------------------------------------------- */

  await otpRef.set({

    email:
      cleanEmail,

    name:
      cleanName,

    otpHash,

    sentAtMs:
      now,

    expiresAtMs,

    attempts:
      0,

    used:
      false

  });


  /* ---------------------------------------------------------
     SEND EMAIL
  --------------------------------------------------------- */

  try {

    await sendOTPEmail(
      cleanEmail,
      cleanName,
      otp
    );


  } catch (error) {

    console.error(
      "SEND OTP EMAIL ERROR:",
      error
    );


    await otpRef.delete();


    return res.status(500).json({

      success:
        false,

      message:
        error.message ||
        "Unable to send verification email."

    });

  }


  return res.status(200).json({

    success:
      true,

    message:
      "Verification code sent successfully.",

    expiresInSeconds:
      Math.floor(
        OTP_EXPIRY_MS /
        1000
      ),

    resendAfterSeconds:
      Math.floor(
        RESEND_COOLDOWN_MS /
        1000
      )

  });

}


/* =========================================================
   VERIFY OTP
========================================================= */

async function verifyCode(
  req,
  res,
  db,
  adminAuth
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
    String(
      password || ""
    );

  const cleanCode =
    clean(code);


  const validationError =
    validateRegistrationData(
      cleanName,
      cleanEmail,
      cleanPassword
    );


  if (validationError) {

    return res.status(400).json({

      success:
        false,

      message:
        validationError

    });

  }


  if (
    !/^\d{6}$/.test(
      cleanCode
    )
  ) {

    return res.status(400).json({

      success:
        false,

      message:
        "Please enter a valid 6-digit verification code."

    });

  }


  /* ---------------------------------------------------------
     FIND OTP
  --------------------------------------------------------- */

  const emailKey =
    hashValue(
      cleanEmail
    );


  const otpRef =
    db
      .collection(
        "adminRegistrationOtps"
      )
      .doc(emailKey);


  const otpSnap =
    await otpRef.get();


  if (!otpSnap.exists) {

    return res.status(400).json({

      success:
        false,

      message:
        "Verification code not found. Please request a new code."

    });

  }


  const otpData =
    otpSnap.data();


  /* ---------------------------------------------------------
     CHECK USED
  --------------------------------------------------------- */

  if (
    otpData.used ===
    true
  ) {

    return res.status(400).json({

      success:
        false,

      message:
        "This verification code has already been used."

    });

  }


  /* ---------------------------------------------------------
     CHECK EXPIRY
  --------------------------------------------------------- */

  const expiresAtMs =
    Number(
      otpData.expiresAtMs ||
      0
    );


  if (
    Date.now() >
    expiresAtMs
  ) {

    await otpRef.delete();


    return res.status(400).json({

      success:
        false,

      message:
        "This verification code has expired. Please request a new code."

    });

  }


  /* ---------------------------------------------------------
     CHECK ATTEMPTS
  --------------------------------------------------------- */

  const attempts =
    Number(
      otpData.attempts ||
      0
    );


  if (
    attempts >=
    MAX_ATTEMPTS
  ) {

    await otpRef.delete();


    return res.status(429).json({

      success:
        false,

      message:
        "Too many incorrect attempts. Please request a new code."

    });

  }


  /* ---------------------------------------------------------
     CHECK CODE
  --------------------------------------------------------- */

  const submittedHash =
    hashValue(
      cleanCode
    );


  const valid =
    safeCompare(
      submittedHash,
      otpData.otpHash
    );


  if (!valid) {

    const newAttempts =
      attempts + 1;


    if (
      newAttempts >=
      MAX_ATTEMPTS
    ) {

      await otpRef.delete();


      return res.status(429).json({

        success:
          false,

        message:
          "Too many incorrect attempts. Please request a new code."

      });

    }


    await otpRef.update({

      attempts:
        newAttempts

    });


    return res.status(400).json({

      success:
        false,

      message:
        `Incorrect verification code. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`

    });

  }


  /* ---------------------------------------------------------
     RE-CHECK EMAIL
     
     Another account could have been created
     while OTP was active.
  --------------------------------------------------------- */

  try {

    await adminAuth
      .getUserByEmail(
        cleanEmail
      );


    await otpRef.delete();


    return res.status(400).json({

      success:
        false,

      message:
        "This email is already registered."

    });

  } catch (error) {

    if (
      error.code !==
      "auth/user-not-found"
    ) {

      console.error(
        "RECHECK USER ERROR:",
        error
      );


      return res.status(500).json({

        success:
          false,

        message:
          "Unable to verify account status."

      });

    }

  }


  /* ---------------------------------------------------------
     CREATE FIREBASE AUTH USER
  --------------------------------------------------------- */

  let createdUser = null;


  try {

    createdUser =
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

    console.error(
      "CREATE AUTH USER ERROR:",
      error
    );


    if (
      error.code ===
      "auth/email-already-exists"
    ) {

      await otpRef.delete();


      return res.status(400).json({

        success:
          false,

        message:
          "This email is already registered."

      });

    }


    return res.status(500).json({

      success:
        false,

      message:
        "Unable to create Firebase account.",

      errorCode:
        error.code ||
        "UNKNOWN_ERROR"

    });

  }


  /* ---------------------------------------------------------
     CREATE FIRESTORE PROFILE
  --------------------------------------------------------- */

  try {

    await db
      .collection(
        "users"
      )
      .doc(
        createdUser.uid
      )
      .set({

        uid:
          createdUser.uid,

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

    console.error(
      "CREATE PROFILE ERROR:",
      error
    );


    /* -------------------------------------------------------
       CLEANUP AUTH USER IF PROFILE CREATION FAILS
    ------------------------------------------------------- */

    try {

      await adminAuth
        .deleteUser(
          createdUser.uid
        );

    } catch (
      cleanupError
    ) {

      console.error(
        "AUTH CLEANUP ERROR:",
        cleanupError
      );

    }


    return res.status(500).json({

      success:
        false,

      message:
        "Account creation failed while saving your profile."

    });

  }


  /* ---------------------------------------------------------
     OTP ONE-TIME USE
  --------------------------------------------------------- */

  await otpRef.delete();


  /* ---------------------------------------------------------
     SUCCESS
  --------------------------------------------------------- */

  return res.status(201).json({

    success:
      true,

    message:
      "Admin account created successfully.",

    uid:
      createdUser.uid

  });

}


/* =========================================================
   MAIN HANDLER
========================================================= */

export default async function handler(
  req,
  res
) {

  if (
    req.method !==
    "POST"
  ) {

    return res.status(405).json({

      success:
        false,

      message:
        "Method not allowed."

    });

  }


  try {

    const app =
      getAdminApp();


    const adminAuth =
      getAuth(app);


    const db =
      getFirestore(app);


    const action =
      clean(
        req.body?.action
      );


    /* -------------------------------------------------------
       SEND CODE
    ------------------------------------------------------- */

    if (
      action ===
      "send-code"
    ) {

      return await sendCode(
        req,
        res,
        db,
        adminAuth
      );

    }


    /* -------------------------------------------------------
       VERIFY CODE
    ------------------------------------------------------- */

    if (
      action ===
      "verify-code"
    ) {

      return await verifyCode(
        req,
        res,
        db,
        adminAuth
      );

    }


    return res.status(400).json({

      success:
        false,

      message:
        "Invalid registration action."

    });


  } catch (error) {

    console.error(
      "REGISTER ADMIN API ERROR:",
      error
    );


    if (
      error.message?.includes(
        "FIREBASE_SERVICE_ACCOUNT_KEY is missing"
      )
    ) {

      return res.status(500).json({

        success:
          false,

        message:
          "Firebase server configuration is missing. Check FIREBASE_SERVICE_ACCOUNT_KEY in Vercel."

      });

    }


    if (
      error.message?.includes(
        "not valid JSON"
      )
    ) {

      return res.status(500).json({

        success:
          false,

        message:
          "Firebase server configuration is invalid. Check FIREBASE_SERVICE_ACCOUNT_KEY."

      });

    }


    if (
      error.message?.includes(
        "service account JSON is incomplete"
      )
    ) {

      return res.status(500).json({

        success:
          false,

        message:
          "Firebase service account configuration is incomplete."

      });

    }


    return res.status(500).json({

      success:
        false,

      message:
        error.message ||
        "Unable to process registration.",

      errorCode:
        error.code ||
        "UNKNOWN_ERROR"

    });

  }

                    }
