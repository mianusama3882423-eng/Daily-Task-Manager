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

    const authHeader =
      req.headers.authorization || "";


    if (
      !authHeader.startsWith("Bearer ")
    ) {

      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }


    const idToken =
      authHeader.substring(7);


    const app =
      getAdminApp();

    const adminAuth =
      getAuth(app);

    const db =
      getFirestore(app);


    const decodedToken =
      await adminAuth.verifyIdToken(
        idToken
      );


    const requesterDoc =
      await db
        .collection("users")
        .doc(decodedToken.uid)
        .get();


    if (!requesterDoc.exists) {

      return res.status(403).json({
        success: false,
        message:
          "Requester profile not found."
      });
    }


    const requester =
      requesterDoc.data();


    if (
      requester.role !== "admin" &&
      requester.role !== "superadmin"
    ) {

      return res.status(403).json({
        success: false,
        message:
          "Only Admin or Super Admin can create students."
      });
    }


    const {
      name,
      email,
      password,
      age,
      className,
      adminId
    } = req.body || {};


    const cleanName =
      String(name || "").trim();

    const cleanEmail =
      String(email || "")
        .trim()
        .toLowerCase();

    const cleanPassword =
      String(password || "");

    const cleanClass =
      String(className || "").trim();


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
          "Please enter a valid student name."
      });
    }


    if (cleanPassword.length < 6) {

      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 6 characters."
      });
    }


    let cleanAge = null;


    if (
      age !== "" &&
      age !== null &&
      age !== undefined
    ) {

      const parsedAge =
        Number(age);


      if (
        !Number.isInteger(parsedAge) ||
        parsedAge < 3 ||
        parsedAge > 100
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid age."
        });
      }


      cleanAge = parsedAge;
    }


    /*
      IMPORTANT SECURITY RULE:

      Admin can only create students
      under himself.

      Super Admin may select a valid Admin.
    */

    let assignedAdminId = null;


    if (requester.role === "admin") {

      assignedAdminId =
        requester.uid;

    } else {

      const requestedAdminId =
        String(adminId || "").trim();


      if (requestedAdminId) {

        const adminDoc =
          await db
            .collection("users")
            .doc(requestedAdminId)
            .get();


        if (!adminDoc.exists) {

          return res.status(400).json({
            success: false,
            message:
              "Selected admin was not found."
          });
        }


        const selectedAdmin =
          adminDoc.data();


        if (
          selectedAdmin.role !== "admin"
        ) {

          return res.status(400).json({
            success: false,
            message:
              "Selected user is not an admin."
          });
        }


        if (
          selectedAdmin.active === false
        ) {

          return res.status(400).json({
            success: false,
            message:
              "Selected admin is inactive."
          });
        }


        assignedAdminId =
          requestedAdminId;
      }
    }


    const student =
      await adminAuth.createUser({
        email: cleanEmail,
        password: cleanPassword,
        displayName: cleanName
      });


    try {

      await db
        .collection("users")
        .doc(student.uid)
        .set({
          uid: student.uid,
          name: cleanName,
          email: cleanEmail,
          age: cleanAge,
          className:
            cleanClass || null,

          role: "student",

          adminId:
            assignedAdminId,

          active: true,

          createdAt:
            FieldValue.serverTimestamp()
        });

    } catch (firestoreError) {

      try {
        await adminAuth.deleteUser(
          student.uid
        );
      } catch (_) {}

      throw firestoreError;
    }


    return res.status(201).json({
      success: true,
      message:
        "Student account created successfully.",
      uid: student.uid
    });


  } catch (error) {

    console.error(
      "CREATE USER ERROR:",
      error
    );


    let message =
      "Unable to create student account.";


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
