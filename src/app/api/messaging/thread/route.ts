import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { patientId } = body;

    if (!patientId) {
      return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
    }

    const thread = await prisma.thread.create({
      data: {
        patientId,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Thread created",
      data: thread,
    });
  } catch (err) {
    console.error("Thread creation error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
