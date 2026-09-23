import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  getFirestore,
  FieldValue
} from "firebase-admin/firestore";


function getAdminApp() {

  if (getApps().length) {
    return getApps()[0];
  }

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  );

  return initializeApp({
    credential: cert(serviceAccount)
  });
}


export default async function handler(req, res) {

  if (req.method !== "POST") {

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }


  try {

    const {
      name,
      email,
      password
    } = req.body || {};


    if (!name || !email || !password) {

      return res.status(400).json({
        success: false,
        message: "Name, email and password are required."
      });
    }


    if (password.length < 6) {

      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters."
      });
    }


    const app = getAdminApp();

    const adminAuth = getAuth(app);
    const db = getFirestore(app);


    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();


    const user = await adminAuth.createUser({

      email: cleanEmail,

      password,

      displayName: cleanName
    });


    await db
      .collection("users")
      .doc(user.uid)
      .set({

        uid: user.uid,

        name: cleanName,

        email: cleanEmail,

        role: "admin",

        active: true,

        createdAt: FieldValue.serverTimestamp()
      });


    return res.status(201).json({

      success: true,

      message: "Admin account created successfully.",

      uid: user.uid
    });


  } catch (error) {

    console.error(error);


    return res.status(400).json({

      success: false,

      message:
        error.code === "auth/email-already-exists"

          ? "This email is already registered."

          : error.message
    });
  }
}
