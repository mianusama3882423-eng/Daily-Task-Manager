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


function getAdminApp() {

  if (getApps().length) {
    return getApps()[0];
  }

  const rawKey =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!rawKey) {
    throw new Error(
      "Firebase service account is not configured."
    );
  }

  const serviceAccount =
    JSON.parse(rawKey);

  return initializeApp({
    credential:
      cert(serviceAccount)
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
      String(email || "")
        .trim()
        .toLowerCase();

    const cleanPassword =
      String(password || "");


    if (
      !cleanName ||
      !cleanEmail ||
      !cleanPassword
    ) {

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


    const app = getAdminApp();

    const adminAuth =
      getAuth(app);

    const db =
      getFirestore(app);


    const user =
      await adminAuth.createUser({
        email: cleanEmail,
        password: cleanPassword,
        displayName: cleanName
      });


    try {

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

    } catch (firestoreError) {

      try {
        await adminAuth.deleteUser(user.uid);
      } catch (_) {}

      throw firestoreError;
    }


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

    let message =
      "Unable to create admin account.";


    if (
      error.code ===
      "auth/email-already-exists"
    ) {
      message =
        "This email is already registered.";
    }


    if (
      error.code ===
      "auth/invalid-email"
    ) {
      message =
        "Please enter a valid email address.";
    }


    if (
      error.code ===
      "auth/weak-password"
    ) {
      message =
        "Password is too weak.";
    }


    return res.status(400).json({
      success: false,
      message
    });
  }
}
