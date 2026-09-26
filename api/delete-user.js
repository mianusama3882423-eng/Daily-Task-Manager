import {
  getApps,
  initializeApp,
  cert
} from "firebase-admin/app";

import { getAuth } from "firebase-admin/auth";

import {
  getFirestore
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

    const authHeader =
      req.headers.authorization ||
      "";

    if (
      !authHeader.startsWith(
        "Bearer "
      )
    ) {

      return res.status(401).json({
        success: false,
        message:
          "Authentication required."
      });
    }


    const app =
      getAdminApp();

    const adminAuth =
      getAuth(app);

    const db =
      getFirestore(app);


    const token =
      authHeader.substring(7);

    const decoded =
      await adminAuth.verifyIdToken(
        token
      );


    const requesterSnap =
      await db
        .collection("users")
        .doc(decoded.uid)
        .get();


    if (
      !requesterSnap.exists
    ) {

      return res.status(403).json({
        success: false,
        message:
          "Requester profile not found."
      });
    }


    const requester =
      requesterSnap.data();


    const studentId =
      String(
        req.body?.studentId ||
        ""
      ).trim();


    if (!studentId) {

      return res.status(400).json({
        success: false,
        message:
          "Student ID is required."
      });
    }


    const studentRef =
      db
        .collection("users")
        .doc(studentId);


    const studentSnap =
      await studentRef.get();


    if (
      !studentSnap.exists
    ) {

      return res.status(404).json({
        success: false,
        message:
          "Student not found."
      });
    }


    const student =
      studentSnap.data();


    if (
      student.role !==
      "student"
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Only student accounts can be deleted here."
      });
    }


    const allowed =
      requester.role ===
        "superadmin" ||

      (
        requester.role ===
          "admin" &&
        student.adminId ===
          requester.uid
      );


    if (!allowed) {

      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to delete this student."
      });
    }


    const collections = [
      "tasks",
      "assignments",
      "tests"
    ];


    for (
      const collectionName
      of collections
    ) {

      const snap =
        await db
          .collection(
            collectionName
          )
          .where(
            "studentId",
            "==",
            studentId
          )
          .get();


      let batch =
        db.batch();

      let count = 0;

      for (
        const item
        of snap.docs
      ) {

        batch.delete(
          item.ref
        );

        count++;

        if (count === 450) {

          await batch.commit();

          batch =
            db.batch();

          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }
    }


    try {

      await adminAuth
        .deleteUser(
          studentId
        );

    } catch (error) {

      if (
        error.code !==
        "auth/user-not-found"
      ) {
        throw error;
      }
    }


    await studentRef.delete();


    return res.status(200).json({

      success:
        true,

      message:
        "Student account and related records deleted successfully."

    });


  } catch (error) {

    console.error(
      "DELETE USER ERROR:",
      error
    );

    return res.status(500).json({

      success:
        false,

      message:
        error.message ||
        "Unable to delete student account."

    });
  }
      }
