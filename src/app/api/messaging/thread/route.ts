import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
    }

    const threads = await prisma.thread.findMany({
      where: {
        patientId,
      },
      orderBy: {
        lastMessageAt: "desc",
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    const results = threads.map(thread => ({
      id: thread.id,
      patientId: thread.patientId,
      scanId: thread.scanId,
      status: thread.status,
      updatedAt: thread.updatedAt,
      lastMessageAt: thread.lastMessageAt,
      messageCount: thread._count.messages,
      latestMessage: thread.messages[0] ?? null,
    }));

    return NextResponse.json({
      ok: true,
      data: results,
    });
  } catch (err) {
    console.error("Thread listing error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { patientId, scanId } = body;

    if (!patientId || !scanId) {
      return NextResponse.json(
        { error: "Missing patientId or scanId" },
        { status: 400 },
      );
    }

    const existingThread = await prisma.thread.findUnique({
      where: {
        scanId,
      },
    });

    if (existingThread) {
      return NextResponse.json({
        ok: true,
        message: "Thread already exists for this scan",
        data: existingThread,
      });
    }

    const thread = await prisma.thread.create({
      data: {
        patientId,
        scanId,
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
