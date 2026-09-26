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
      "Firebase service account is not configured."
    );
  }

  const serviceAccount =
    JSON.parse(rawKey);

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


    const name =
      String(
        req.body?.name || ""
      ).trim();

    const email =
      String(
        req.body?.email || ""
      )
      .trim()
      .toLowerCase();

    const password =
      String(
        req.body?.password || ""
      );

    const className =
      String(
        req.body?.className || ""
      ).trim();

    const requestedAdminId =
      String(
        req.body?.adminId || ""
      ).trim();


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
      password.length < 6
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 6 characters."
      });
    }


    let age = null;


    if (
      req.body?.age !== "" &&
      req.body?.age !== null &&
      req.body?.age !== undefined
    ) {

      const parsedAge =
        Number(
          req.body.age
        );

      if (
        !Number.isInteger(
          parsedAge
        ) ||
        parsedAge < 3 ||
        parsedAge > 100
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid age."
        });
      }

      age =
        parsedAge;
    }


    let assignedAdminId =
      null;


    if (
      requester.role ===
      "admin"
    ) {

      assignedAdminId =
        requester.uid;

    } else {

      if (
        requestedAdminId
      ) {

        const adminSnap =
          await db
            .collection("users")
            .doc(
              requestedAdminId
            )
            .get();

        if (
          !adminSnap.exists ||
          adminSnap.data().role !==
            "admin"
        ) {

          return res.status(400).json({
            success: false,
            message:
              "Selected Admin was not found."
          });
        }

        assignedAdminId =
          requestedAdminId;
      }
    }


    let student;

    try {

      student =
        await adminAuth.createUser({

          email,

          password,

          displayName:
            name

        });

    } catch (error) {

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

      throw error;
    }


    try {

      await db
        .collection("users")
        .doc(student.uid)
        .set({

          uid:
            student.uid,

          name,

          email,

          age,

          className:
            className ||
            null,

          role:
            "student",

          adminId:
            assignedAdminId,

          active:
            true,

          createdAt:
            FieldValue.serverTimestamp()

        });

    } catch (error) {

      try {
        await adminAuth
          .deleteUser(
            student.uid
          );
      } catch {}

      throw error;
    }


    return res.status(201).json({

      success:
        true,

      message:
        "Student account created successfully.",

      uid:
        student.uid

    });


  } catch (error) {

    console.error(
      "CREATE USER ERROR:",
      error
    );

    return res.status(500).json({

      success:
        false,

      message:
        error.message ||
        "Unable to create student account."

    });
  }
}
