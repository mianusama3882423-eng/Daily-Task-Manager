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

  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!rawKey) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is missing in Vercel."
    );
  }

  let serviceAccount;

  try {
    serviceAccount = JSON.parse(rawKey);
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
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(
        /\\n/g,
        "\n"
      )
    })
  });
}


export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed."
    });
  }

  try {

    const {
      name,
      email,
      password
    } = req.body || {};

    const cleanName =
      String(name || "").trim();

    const cleanEmail =
      String(email || "").trim().toLowerCase();

    const cleanPassword =
      String(password || "");


    if (!cleanName || !cleanEmail || !cleanPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required."
      });
    }


    if (cleanName.length < 2) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a valid name."
      });
    }


    if (cleanPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 6 characters."
      });
    }


    // Firebase Admin SDK
    const app = getAdminApp();

    const adminAuth = getAuth(app);
    const db = getFirestore(app);


    // Create Firebase Authentication account
    const user =
      await adminAuth.createUser({
        email: cleanEmail,
        password: cleanPassword,
        displayName: cleanName
      });


    // Create Firestore profile
    await db
      .collection("users")
      .doc(user.uid)
      .set({

        uid: user.uid,

        name: cleanName,

        email: cleanEmail,

        role: "admin",

        active: true,

        createdAt:
          FieldValue.serverTimestamp()
      });


    return res.status(201).json({

      success: true,

      message:
        "Admin account created successfully.",

      uid: user.uid
    });


  } catch (error) {

    console.error(
      "REGISTER ADMIN ERROR:",
      error
    );


    // Known Firebase Auth errors

    if (
      error.code ===
      "auth/email-already-exists"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This email is already registered."
      });
    }


    if (
      error.code ===
      "auth/invalid-email"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please enter a valid email address."
      });
    }


    if (
      error.code ===
      "auth/weak-password"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 6 characters."
      });
    }


    // Configuration problems

    if (
      error.message?.includes(
        "FIREBASE_SERVICE_ACCOUNT_KEY is missing"
      )
    ) {
      return res.status(500).json({
        success: false,
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
        success: false,
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
        success: false,
        message:
          "Firebase service account configuration is incomplete."
      });
    }


    // Temporary diagnostic response
    return res.status(500).json({

      success: false,

      message:
        "Unable to create admin account.",

      errorCode:
        error.code || "UNKNOWN_ERROR",

      errorMessage:
        error.message ||
        "Unknown server error."
    });

  }
      }
