import { NextResponse } from "next/server";

/**
 * Teams API route handler
 * Open source implementation (feature not available)
 */
export async function GET() {
  return NextResponse.json(
    { error: "Teams feature is only available in the SAAS version" },
    { status: 404 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Teams feature is only available in the SAAS version" },
    { status: 404 }
  );
}
