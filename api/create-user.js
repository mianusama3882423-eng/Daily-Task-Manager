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

    const authHeader =
      req.headers.authorization || "";


    if (!authHeader.startsWith("Bearer ")) {

      return res.status(401).json({

        success: false,

        message: "Authentication required."

      });
    }


    const idToken =
      authHeader.substring(7);


    const app = getAdminApp();

    const adminAuth = getAuth(app);

    const db = getFirestore(app);


    const decodedToken =
      await adminAuth.verifyIdToken(idToken);


    const requesterDoc =
      await db
        .collection("users")
        .doc(decodedToken.uid)
        .get();


    if (!requesterDoc.exists) {

      return res.status(403).json({

        success: false,

        message: "User profile not found."

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
          "Only Admin or Super Admin can create users."

      });
    }



    const {
      name,
      email,
      password,
      age,
      className
    } = req.body || {};



    if (!name || !email || !password) {

      return res.status(400).json({

        success: false,

        message:
          "Name, email and password are required."

      });
    }



    if (password.length < 6) {

      return res.status(400).json({

        success: false,

        message:
          "Password must contain at least 6 characters."

      });
    }



    const cleanName =
      name.trim();

    const cleanEmail =
      email.trim().toLowerCase();



    const student =
      await adminAuth.createUser({

        email: cleanEmail,

        password,

        displayName: cleanName

      });



    await db
      .collection("users")
      .doc(student.uid)
      .set({

        uid: student.uid,

        name: cleanName,

        email: cleanEmail,

        age:
          age !== null &&
          age !== undefined &&
          age !== ""
            ? Number(age)
            : null,

        role: "student",

        adminId:
          requester.role === "admin"
            ? requester.uid
            : null,

        className:
          className || "",

        active: true,

        createdAt:
          FieldValue.serverTimestamp()

      });



    return res.status(201).json({

      success: true,

      message:
        "Student account created successfully.",

      uid: student.uid

    });



  } catch (error) {

    console.error(error);


    return res.status(400).json({

      success: false,

      message:
        error.code ===
        "auth/email-already-exists"

          ? "This email is already registered."

          : error.message

    });

  }
}
