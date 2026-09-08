import { NextRequest, NextResponse } from "next/server";
import { getAppointmentById } from "@/lib/appointments";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const appointment = await getAppointmentById(id);

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    return NextResponse.json({ appointment });
  } catch (error) {
    console.error("[api/appointments/:id] failed to load appointment", error);
    return NextResponse.json({ error: "Unable to load appointment" }, { status: 500 });
  }
}
