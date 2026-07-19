import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const dashboard = await prisma.dashboard.create({
      data: {
        name: body.name,
        description: body.description,
        businessUnitId: body.businessUnitId || "default",
        createdById: (session.user as any).id,
        layout: "[]",
      },
    });

    return NextResponse.json({ dashboard }, { status: 201 });
  } catch (error) {
    console.error("Error creating dashboard:", error);
    return NextResponse.json({ error: "Failed to create dashboard" }, { status: 500 });
  }
}
