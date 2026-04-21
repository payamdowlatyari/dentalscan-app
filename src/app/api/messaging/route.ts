import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * CHALLENGE: MESSAGING SYSTEM
 *
 * Your goal is to build a basic communication channel between the Patient and Dentist.
 * 1. Implement the POST handler to save a new message into a Thread.
 * 2. Implement the GET handler to retrieve message history for a given thread.
 * 3. Focus on data integrity and proper relations.
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get("threadId");
    const scanId = searchParams.get("scanId");

    if (!threadId && !scanId) {
      return NextResponse.json(
        { error: "Missing threadId or scanId" },
        { status: 400 },
      );
    }

    const thread = await prisma.thread.findUnique({
      where: threadId ? { id: threadId } : { scanId: scanId! },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    return NextResponse.json({ messages: thread.messages });
  } catch (err) {
    console.error("Messaging API Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { threadId, content, sender } = body;

    if (!threadId || !content || !sender) {
      return NextResponse.json(
        { error: "Missing threadId, content, or sender" },
        { status: 400 },
      );
    }

    if (sender !== "patient" && sender !== "dentist") {
      return NextResponse.json(
        { error: "Sender must be either 'patient' or 'dentist'" },
        { status: 400 },
      );
    }

    const thread = await prisma.thread.findUnique({
      where: {
        id: threadId,
      },
    });

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const message = await prisma.message.create({
      data: {
        content,
        sender,
        threadId,
      },
    });

    await prisma.thread.update({
      where: {
        id: threadId,
      },
      data: {
        lastMessageAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Message sent successfully",
      data: message,
    });
  } catch (err) {
    console.error("Messaging API Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
