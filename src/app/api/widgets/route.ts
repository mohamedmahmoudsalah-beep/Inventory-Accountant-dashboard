import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dashboardId = searchParams.get("dashboardId");

  if (!dashboardId) {
    return NextResponse.json({ error: "dashboardId is required" }, { status: 400 });
  }

  try {
    const widgets = await prisma.widget.findMany({
      where: { dashboardId },
      include: { dataset: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ widgets });
  } catch (error) {
    console.error("Error fetching widgets:", error);
    return NextResponse.json({ error: "Failed to fetch widgets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const widget = await prisma.widget.create({
      data: body,
    });

    return NextResponse.json({ widget }, { status: 201 });
  } catch (error) {
    console.error("Error creating widget:", error);
    return NextResponse.json({ error: "Failed to create widget" }, { status: 500 });
  }
}
