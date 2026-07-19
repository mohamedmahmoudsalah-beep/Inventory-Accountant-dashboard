import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const createDatasetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["GOOGLE_SHEETS", "GOOGLE_DRIVE", "EXCEL", "CSV"]),
  sourceConfig: z.string(), // JSON string
  businessUnitId: z.string(),
  refreshInterval: z.number().optional(),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const businessUnitId = searchParams.get("businessUnitId");

  try {
    const datasets = await prisma.dataset.findMany({
      where: businessUnitId ? { businessUnitId } : {},
      include: {
        businessUnit: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
        _count: { select: { widgets: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ datasets });
  } catch (error) {
    console.error("Error fetching datasets:", error);
    return NextResponse.json({ error: "Failed to fetch datasets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = createDatasetSchema.parse(body);

    const dataset = await prisma.dataset.create({
      data: {
        ...validated,
        createdById: (session.user as any).id,
      },
    });

    return NextResponse.json({ dataset }, { status: 201 });
  } catch (error) {
    console.error("Error creating dataset:", error);
    return NextResponse.json({ error: "Failed to create dataset" }, { status: 500 });
  }
}
