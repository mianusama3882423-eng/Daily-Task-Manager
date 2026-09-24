import {
  getApps,
  initializeApp,
  cert
} from "firebase-admin/app";

import { getAuth } from "firebase-admin/auth";

import { getFirestore } from "firebase-admin/firestore";


function getAdminApp() {

  if (getApps().length) {
    return getApps()[0];
  }

  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!rawKey) {
    throw new Error("Firebase service account is not configured.");
  }

  const serviceAccount = JSON.parse(rawKey);

  return initializeApp({
    credential: cert(serviceAccount)
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

    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {

      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }


    const token = authHeader.substring(7);

    const app = getAdminApp();

    const adminAuth = getAuth(app);
    const db = getFirestore(app);


    const decoded =
      await adminAuth.verifyIdToken(token);


    const requesterDoc = await db
      .collection("users")
      .doc(decoded.uid)
      .get();


    if (!requesterDoc.exists) {

      return res.status(403).json({
        success: false,
        message: "Requester profile not found."
      });
    }


    const requester = requesterDoc.data();

    const studentId = String(
      req.body?.studentId || ""
    ).trim();


    if (!studentId) {

      return res.status(400).json({
        success: false,
        message: "Student ID is required."
      });
    }


    const studentRef =
      db.collection("users").doc(studentId);

    const studentDoc =
      await studentRef.get();


    if (!studentDoc.exists) {

      return res.status(404).json({
        success: false,
        message: "Student not found."
      });
    }


    const student = studentDoc.data();


    if (student.role !== "student") {

      return res.status(400).json({
        success: false,
        message: "Only student accounts can be deleted here."
      });
    }


    const allowed =
      requester.role === "superadmin" ||
      (
        requester.role === "admin" &&
        student.adminId === requester.uid
      );


    if (!allowed) {

      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this student."
      });
    }


    await adminAuth.deleteUser(studentId);

    await studentRef.delete();


    return res.status(200).json({

      success: true,

      message: "Student account deleted successfully."
    });


  } catch (error) {

    console.error("DELETE USER ERROR:", error);


    return res.status(400).json({

      success: false,

      message:
        error.code === "auth/user-not-found"
          ? "Student authentication account was not found."
          : "Unable to delete student account."
    });
  }
}
