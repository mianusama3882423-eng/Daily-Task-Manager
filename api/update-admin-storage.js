// ============================================================
// DAILY TASK MANAGER
// API: UPDATE ADMIN STORAGE
// Version: 3.0.0
// ============================================================

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

import {
  getStorage
} from "firebase-admin/storage";


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

  } catch (error) {

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

    }),

    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      "daily-task-manager-6c31b.firebasestorage.app"

  });

}


/* ============================================================
   AUTH TOKEN
============================================================ */

async function verifyToken(req, adminAuth) {

  const header =
    req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    throw new Error(
      "Authentication token is missing."
    );
  }

  const token =
    header.substring(7);

  return await adminAuth.verifyIdToken(
    token
  );

}


/* ============================================================
   GET STORAGE USAGE
============================================================ */

async function getStorageUsage(
  bucket,
  adminId
) {

  const prefix =
    `admins/${adminId}/`;

  const [files] =
    await bucket.getFiles({
      prefix
    });

  let usedBytes = 0;

  for (const file of files) {

    const size =
      Number(
        file.metadata?.size || 0
      );

    usedBytes += size;

  }

  return usedBytes;

}


/* ============================================================
   STORAGE LABEL
============================================================ */

function storageLabel(bytes) {

  const MB =
    1024 * 1024;

  const GB =
    1024 * MB;

  if (bytes % GB === 0) {

    return (
      `${bytes / GB} GB`
    );

  }

  if (bytes % MB === 0) {

    return (
      `${bytes / MB} MB`
    );

  }

  return (
    `${(
      bytes / MB
    ).toFixed(2)} MB`
  );

}


/* ============================================================
   MAIN HANDLER
============================================================ */

export default async function handler(
  req,
  res
) {

  if (req.method !== "POST") {

    return res.status(405).json({

      success: false,

      message:
        "Method not allowed."

    });

  }


  try {

    const app =
      getAdminApp();

    const adminAuth =
      getAuth(app);

    const db =
      getFirestore(app);

    const storage =
      getStorage(app);

    const bucket =
      storage.bucket();


    /* --------------------------------------------
       VERIFY REQUESTER
    --------------------------------------------- */

    const decoded =
      await verifyToken(
        req,
        adminAuth
      );

    const requesterUid =
      decoded.uid;


    /* --------------------------------------------
       GET REQUESTER PROFILE
    --------------------------------------------- */

    const requesterSnapshot =
      await db
        .collection("users")
        .doc(requesterUid)
        .get();


    if (!requesterSnapshot.exists) {

      return res.status(403).json({

        success: false,

        message:
          "Your user profile was not found."

      });

    }


    const requester =
      requesterSnapshot.data();


    /* --------------------------------------------
       ONLY SUPER ADMIN
    --------------------------------------------- */

    if (
      requester.role !==
      "superadmin"
    ) {

      return res.status(403).json({

        success: false,

        message:
          "Only Super Admin can change storage allocation."

      });

    }


    const body =
      req.body || {};


    const adminId =
      String(
        body.adminId || ""
      ).trim();


    const allocationBytes =
      Number(
        body.allocationBytes
      );


    if (!adminId) {

      return res.status(400).json({

        success: false,

        message:
          "Admin ID is required."

      });

    }


    if (
      !Number.isFinite(
        allocationBytes
      ) ||
      !Number.isInteger(
        allocationBytes
      )
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Invalid storage allocation."

      });

    }


    /* --------------------------------------------
       LIMITS
       Minimum = 500 MB
       Maximum = 100 GB
    --------------------------------------------- */

    const MIN_STORAGE =
      500 *
      1024 *
      1024;


    const MAX_STORAGE =
      100 *
      1024 *
      1024 *
      1024;


    if (
      allocationBytes <
      MIN_STORAGE
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Minimum storage allocation is 500 MB."

      });

    }


    if (
      allocationBytes >
      MAX_STORAGE
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Maximum storage allocation is 100 GB."

      });

    }


    /* --------------------------------------------
       GET TARGET ADMIN
    --------------------------------------------- */

    const adminRef =
      db
        .collection("users")
        .doc(adminId);


    const adminSnapshot =
      await adminRef.get();


    if (!adminSnapshot.exists) {

      return res.status(404).json({

        success: false,

        message:
          "Admin account was not found."

      });

    }


    const adminData =
      adminSnapshot.data();


    if (
      adminData.role !==
      "admin"
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Selected user is not an Admin."

      });

    }


    /* --------------------------------------------
       CHECK CURRENT USAGE
    --------------------------------------------- */

    const usedBytes =
      await getStorageUsage(
        bucket,
        adminId
      );


    /* --------------------------------------------
       DO NOT ALLOW LIMIT BELOW USAGE
    --------------------------------------------- */

    if (
      allocationBytes <
      usedBytes
    ) {

      return res.status(400).json({

        success: false,

        message:
          `Storage cannot be reduced below current usage of ${storageLabel(usedBytes)}.`,

        usedBytes,

        requestedBytes:
          allocationBytes

      });

    }


    /* --------------------------------------------
       UPDATE ADMIN PROFILE
    --------------------------------------------- */

    await adminRef.update({

      storageLimitBytes:
        allocationBytes,

      storageLimitLabel:
        storageLabel(
          allocationBytes
        ),

      storageUpdatedAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp()

    });


    return res.status(200).json({

      success: true,

      message:
        "Admin storage allocation updated successfully.",

      adminId,

      allocationBytes,

      allocationLabel:
        storageLabel(
          allocationBytes
        ),

      usedBytes

    });


  } catch (error) {

    console.error(
      "UPDATE ADMIN STORAGE ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message ||
        "Unable to update admin storage."

    });

  }

}
