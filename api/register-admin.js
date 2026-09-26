import {
  getApps,
  initializeApp,
  cert
} from "firebase-admin/app";

import { getAuth } from "firebase-admin/auth";

import {
  getFirestore,
  FieldValue
} from "firebase-admin/firestore";


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

  } catch {

    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON."
    );
  }

  return initializeApp({
    credential: cert({
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


function generateOTP() {

  return String(
    Math.floor(
      100000 +
      Math.random() * 900000
    )
  );
}


function pendingId(email) {

  return email
    .replace(
      /[^\w.-]/g,
      "_"
    );
}


async function sendEmailOTP(
  email,
  code
) {

  const apiKey =
    process.env.RESEND_API_KEY;

  const fromEmail =
    process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {

    throw new Error(
      "Email verification is not configured in Vercel."
    );
  }

  const response =
    await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",

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
              "Daily Task Manager - Verification Code",

            html: `
              <div style="
                font-family:Arial;
                max-width:520px;
                margin:auto;
                padding:25px;
              ">

                <h2>
                  Daily Task Manager
                </h2>

                <p>
                  Your admin verification code is:
                </p>

                <div style="
                  font-size:34px;
                  font-weight:bold;
                  letter-spacing:8px;
                  text-align:center;
                  padding:20px;
                  background:#f3f4ff;
                  border-radius:12px;
                ">
                  ${code}
                </div>

                <p>
                  This code expires in
                  <b>10 minutes</b>.
                </p>

                <p>
                  If you did not request this,
                  ignore this email.
                </p>

              </div>
            `
          })
      }
    );

  if (!response.ok) {

    const text =
      await response.text();

    console.error(
      "RESEND ERROR:",
      text
    );

    throw new Error(
      "Unable to send verification email."
    );
  }
}


export default async function handler(
  req,
  res
) {

  if (
    req.method !== "POST"
  ) {

    return res.status(405).json({
      success: false,
      message:
        "Method not allowed."
    });
  }

  try {

    const body =
      req.body || {};

    const action =
      body.action ||
      "send-code";

    const app =
      getAdminApp();

    const adminAuth =
      getAuth(app);

    const db =
      getFirestore(app);


    /* =====================================================
       SEND CODE
    ===================================================== */

    if (
      action ===
      "send-code"
    ) {

      const name =
        String(
          body.name || ""
        ).trim();

      const email =
        String(
          body.email || ""
        )
        .trim()
        .toLowerCase();

      const password =
        String(
          body.password || ""
        );

      if (
        !name ||
        !email ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Name, email and password are required."
        });
      }

      if (
        name.length < 2
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid name."
        });
      }

      if (
        password.length < 6
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Password must contain at least 6 characters."
        });
      }

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailPattern.test(
          email
        )
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid email address."
        });
      }


      try {

        await adminAuth
          .getUserByEmail(
            email
          );

        return res.status(400).json({
          success: false,
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


      const id =
        pendingId(email);

      const oldRef =
        db
          .collection(
            "pendingAdminRegistrations"
          )
          .doc(id);

      const old =
        await oldRef.get();

      if (old.exists) {

        const oldData =
          old.data();

        if (
          oldData.lastSentAt
        ) {

          const last =
            oldData.lastSentAt
              .toDate()
              .getTime();

          if (
            Date.now() -
            last <
            60000
          ) {

            return res.status(429).json({
              success: false,
              message:
                "Please wait 60 seconds before requesting another code."
            });
          }
        }

        await oldRef.delete();
      }


      const code =
        generateOTP();

      await sendEmailOTP(
        email,
        code
      );


      await oldRef.set({

        name,

        email,

        password,

        otpHash:
          code,

        attempts:
          0,

        lastSentAt:
          FieldValue.serverTimestamp(),

        expiresAt:
          new Date(
            Date.now() +
            10 * 60 * 1000
          ),

        createdAt:
          FieldValue.serverTimestamp()

      });


      return res.status(200).json({
        success: true,
        message:
          "Verification code sent to your email."
      });
    }


    /* =====================================================
       VERIFY CODE
    ===================================================== */

    if (
      action ===
      "verify-code"
    ) {

      const email =
        String(
          body.email || ""
        )
        .trim()
        .toLowerCase();

      const code =
        String(
          body.code || ""
        ).trim();

      if (
        !email ||
        !code
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Email and verification code are required."
        });
      }

      if (
        !/^\d{6}$/.test(
          code
        )
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Verification code must contain 6 digits."
        });
      }


      const ref =
        db
          .collection(
            "pendingAdminRegistrations"
          )
          .doc(
            pendingId(email)
          );

      const snap =
        await ref.get();

      if (!snap.exists) {

        return res.status(400).json({
          success: false,
          message:
            "Verification code expired. Request a new code."
        });
      }

      const pending =
        snap.data();


      if (
        pending.expiresAt &&
        pending.expiresAt
          .toDate()
          .getTime() <
        Date.now()
      ) {

        await ref.delete();

        return res.status(400).json({
          success: false,
          message:
            "Verification code has expired."
        });
      }


      if (
        Number(
          pending.attempts || 0
        ) >= 5
      ) {

        await ref.delete();

        return res.status(429).json({
          success: false,
          message:
            "Too many incorrect attempts. Request a new code."
        });
      }


      if (
        pending.otpHash !==
        code
      ) {

        await ref.update({

          attempts:
            FieldValue.increment(1)

        });

        return res.status(400).json({
          success: false,
          message:
            "Incorrect verification code."
        });
      }


      try {

        await adminAuth
          .getUserByEmail(
            email
          );

        await ref.delete();

        return res.status(400).json({
          success: false,
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


      const user =
        await adminAuth.createUser({

          email:
            pending.email,

          password:
            pending.password,

          displayName:
            pending.name,

          emailVerified:
            true

        });


      await db
        .collection("users")
        .doc(user.uid)
        .set({

          uid:
            user.uid,

          name:
            pending.name,

          email:
            pending.email,

          role:
            "admin",

          active:
            true,

          storageAllocationMB:
            500,

          storageUsedBytes:
            0,

          emailVerified:
            true,

          createdAt:
            FieldValue.serverTimestamp()

        });


      await ref.delete();


      return res.status(201).json({

        success:
          true,

        message:
          "Admin account created successfully.",

        uid:
          user.uid

      });
    }


    return res.status(400).json({
      success: false,
      message:
        "Invalid registration action."
    });


  } catch (error) {

    console.error(
      "REGISTER ADMIN ERROR:",
      error
    );

    return res.status(500).json({

      success:
        false,

      message:
        error.message ||
        "Unable to process registration."

    });
  }
        }
