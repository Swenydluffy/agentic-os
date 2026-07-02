import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tok = process.env.NOTES_TOKEN ?? "notes-wynneops-2026";
  try {
    // Fetch the two-lights status from VPS notes server
    const res = await fetch("https://notes.wynneops.com/api/cost", {
      cache: "no-store",
      headers: { "x-notes-token": tok },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({
        hermesBrain: "red",
        obsidianBrain: "red",
        error: "HTTP " + res.status,
      });
    }

    const data = await res.json();

    // Transform from notes_server format to StatusStrip format
    const hermesBrain = data.hermes_brain?.status === "GREEN" ? "green" : "red";
    const obsidianBrain = data.obsidian_brain?.status === "GREEN" ? "green" : "red";

    return NextResponse.json(
      { hermesBrain, obsidianBrain },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (e) {
    return NextResponse.json({
      hermesBrain: "red",
      obsidianBrain: "red",
      error: String(e),
    });
  }
}
