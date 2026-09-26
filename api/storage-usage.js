
// ============================================================
// DAILY TASK MANAGER
// API: STORAGE USAGE
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
  getFirestore
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
   VERIFY TOKEN
============================================================ */

async function verifyToken(
  req,
  adminAuth
) {

  const header =
    req.headers.authorization || "";


  if (
    !header.startsWith(
      "Bearer "
    )
  ) {

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
   STORAGE LABEL
============================================================ */

function storageLabel(bytes) {

  const MB =
    1024 * 1024;

  const GB =
    1024 * MB;


  if (
    bytes >= GB
  ) {

    return (
      `${(
        bytes / GB
      ).toFixed(2)} GB`
    );

  }


  if (
    bytes >= MB
  ) {

    return (
      `${(
        bytes / MB
      ).toFixed(2)} MB`
    );

  }


  const KB =
    1024;


  if (
    bytes >= KB
  ) {

    return (
      `${(
        bytes / KB
      ).toFixed(2)} KB`
    );

  }


  return (
    `${bytes} B`
  );

}


/* ============================================================
   GET ACTUAL STORAGE USAGE
============================================================ */

async function calculateUsage(
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


  const fileDetails = [];


  for (
    const file of files
  ) {

    const size =
      Number(
        file.metadata?.size ||
        0
      );


    usedBytes += size;


    fileDetails.push({

      name:
        file.name,

      size,

      sizeLabel:
        storageLabel(size)

    });

  }


  return {

    usedBytes,

    fileCount:
      files.length,

    files:
      fileDetails

  };

}


/* ============================================================
   MAIN HANDLER
============================================================ */

export default async function handler(
  req,
  res
) {

  if (
    req.method !==
    "GET" &&
    req.method !==
    "POST"
  ) {

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
       VERIFY USER
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


    if (
      !requesterSnapshot.exists
    ) {

      return res.status(403).json({

        success: false,

        message:
          "User profile was not found."

      });

    }


    const requester =
      requesterSnapshot.data();


    let targetAdminId =
      requesterUid;


    /* --------------------------------------------
       SUPER ADMIN CAN REQUEST
       ANOTHER ADMIN'S USAGE
    --------------------------------------------- */

    if (
      requester.role ===
      "superadmin"
    ) {

      const requestedId =
        req.method === "GET"

          ? req.query.adminId

          : req.body?.adminId;


      targetAdminId =
        String(
          requestedId ||
          ""
        ).trim();


      if (!targetAdminId) {

        return res.status(400).json({

          success: false,

          message:
            "Admin ID is required."

        });

      }


      const targetSnapshot =
        await db
          .collection("users")
          .doc(targetAdminId)
          .get();


      if (
        !targetSnapshot.exists
      ) {

        return res.status(404).json({

          success: false,

          message:
            "Admin was not found."

        });

      }


      if (
        targetSnapshot.data().role !==
        "admin"
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Selected user is not an Admin."

        });

      }

    }

    else if (
      requester.role ===
      "admin"
    ) {

      /* Admin can only see own storage */

      targetAdminId =
        requesterUid;

    }

    else {

      return res.status(403).json({

        success: false,

        message:
          "You are not allowed to view storage usage."

      });

    }


    /* --------------------------------------------
       CALCULATE ACTUAL STORAGE
    --------------------------------------------- */

    const usage =
      await calculateUsage(
        bucket,
        targetAdminId
      );


    /* --------------------------------------------
       GET ALLOCATION
    --------------------------------------------- */

    const targetProfile =
      await db
        .collection("users")
        .doc(targetAdminId)
        .get();


    const targetData =
      targetProfile.data();


    const defaultLimit =
      500 *
      1024 *
      1024;


    const allocationBytes =
      Number(
        targetData?.storageLimitBytes ||
        defaultLimit
      );


    const usedBytes =
      usage.usedBytes;


    const remainingBytes =
      Math.max(
        allocationBytes -
        usedBytes,
        0
      );


    let usedPercent = 0;


    if (
      allocationBytes >
      0
    ) {

      usedPercent =
        (
          usedBytes /
          allocationBytes
        ) *
        100;

    }


    usedPercent =
      Math.min(
        Math.max(
          usedPercent,
          0
        ),
        100
      );


    let status =
      "normal";


    if (
      usedPercent >=
      100
    ) {

      status =
        "full";

    }

    else if (
      usedPercent >=
      90
    ) {

      status =
        "almost-full";

    }

    else if (
      usedPercent >=
      80
    ) {

      status =
        "warning";

    }


    return res.status(200).json({

      success: true,

      adminId:
        targetAdminId,

      usedBytes,

      usedLabel:
        storageLabel(
          usedBytes
        ),

      allocationBytes,

      allocationLabel:
        storageLabel(
          allocationBytes
        ),

      remainingBytes,

      remainingLabel:
        storageLabel(
          remainingBytes
        ),

      usedPercent:
        Number(
          usedPercent.toFixed(2)
        ),

      fileCount:
        usage.fileCount,

      status

    });


  } catch (error) {

    console.error(
      "STORAGE USAGE ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message ||
        "Unable to calculate storage usage."

    });

  }

}
