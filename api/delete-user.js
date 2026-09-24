import {
  getApps,
  initializeApp,
  cert
} from "firebase-admin/app";

import {
  getAuth
} from "firebase-admin/auth";

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


/*
  Firestore batch limit is 500.

  We use 400 per batch to keep
  enough safety margin.
*/

async function deleteInChunks(
  db,
  snapshots
) {

  const items = snapshots
    .filter(Boolean);

  for (
    let start = 0;
    start < items.length;
    start += 400
  ) {

    const chunk =
      items.slice(
        start,
        start + 400
      );

    const batch =
      db.batch();

    chunk.forEach(snapshot => {
      batch.delete(snapshot.ref);
    });

    await batch.commit();
  }
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
        message:
          "Authentication required."
      });
    }


    const token =
      authHeader.substring(7);


    const app =
      getAdminApp();

    const adminAuth =
      getAuth(app);

    const db =
      getFirestore(app);


    const decoded =
      await adminAuth.verifyIdToken(
        token
      );


    const requesterDoc =
      await db
        .collection("users")
        .doc(decoded.uid)
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


    const studentId =
      String(
        req.body?.studentId || ""
      ).trim();


    if (!studentId) {

      return res.status(400).json({
        success: false,
        message:
          "Student ID is required."
      });
    }


    const studentRef =
      db.collection("users")
        .doc(studentId);


    const studentDoc =
      await studentRef.get();


    if (!studentDoc.exists) {

      return res.status(404).json({
        success: false,
        message:
          "Student not found."
      });
    }


    const student =
      studentDoc.data();


    if (student.role !== "student") {

      return res.status(400).json({
        success: false,
        message:
          "Only student accounts can be deleted here."
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
        message:
          "You are not allowed to delete this student."
      });
    }


    /*
      Find all records belonging
      to this student.
    */

    const tasksSnap =
      await db
        .collection("tasks")
        .where(
          "studentId",
          "==",
          studentId
        )
        .get();


    const assignmentsSnap =
      await db
        .collection("assignments")
        .where(
          "studentId",
          "==",
          studentId
        )
        .get();


    const testsSnap =
      await db
        .collection("tests")
        .where(
          "studentId",
          "==",
          studentId
        )
        .get();


    /*
      Delete authentication account.
    */

    try {

      await adminAuth.deleteUser(
        studentId
      );

    } catch (authError) {

      /*
        If Firebase Auth user is already
        gone, continue cleaning Firestore.
      */

      if (
        authError.code !==
        "auth/user-not-found"
      ) {
        throw authError;
      }
    }


    /*
      Delete all related records.
    */

    await deleteInChunks(
      db,
      tasksSnap.docs
    );

    await deleteInChunks(
      db,
      assignmentsSnap.docs
    );

    await deleteInChunks(
      db,
      testsSnap.docs
    );


    /*
      Finally delete profile.
    */

    await studentRef.delete();


    return res.status(200).json({
      success: true,
      message:
        "Student account and related records deleted successfully."
    });


  } catch (error) {

    console.error(
      "DELETE USER ERROR:",
      error
    );


    return res.status(400).json({
      success: false,
      message:
        "Unable to delete student account."
    });
  }
}
