import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * CHALLENGE: NOTIFICATION SYSTEM
 *
 * Your goal is to implement a robust notification logic.
 * 1. When a scan is "completed", create a record in the Notification table.
 * 2. Return a success status to the client.
 * 3. Bonus: Handle potential errors (e.g., database connection issues).
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scanId, status, userId } = body;

    if (!scanId || !status) {
      return NextResponse.json(
        { error: "Missing scanId or status" },
        { status: 400 },
      );
    }

    if (status !== "completed") {
      return NextResponse.json(
        { error: "Scan status must be 'completed' to trigger notification" },
        { status: 400 },
      );
    }

    const notification = await prisma.notification.create({
      data: {
        userId: userId ?? "unknown",
        scanId: scanId,
        title: "Scan Completed",
        message: `Your dental scan with ID ${scanId} has been completed and is ready for review.`,
      },
    });

    console.log(
      `[STUB] Notification created for scan ${scanId}:`,
      notification,
    );

    return NextResponse.json({
      ok: true,
      message: `Notification created for scan ${scanId}:`,
      notification,
    });
  } catch (err) {
    console.error("Notification API Error:", err);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
