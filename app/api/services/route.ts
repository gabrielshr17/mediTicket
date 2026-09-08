import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";

export async function GET() {
  try {
    const services = await getServices();
    return NextResponse.json({ services });
  } catch (error) {
    console.error("[api/services] failed to load services", error);
    return NextResponse.json(
      { error: "Unable to load services" },
      { status: 500 }
    );
  }
}
