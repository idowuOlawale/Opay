import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
    const token = process.env.ANTHROPIC_AUTH_TOKEN;
    if (!token) return NextResponse.json({ error: "ANTHROPIC_AUTH_TOKEN is not configured." }, { status: 500 });
    const baseUrl = (process.env.ANTHROPIC_BASE_URL || "https://agentrouter.org").replace(/\/$/, "");
    const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-6";
    const upstream = await fetch(`${baseUrl}/v1/messages`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: 1024, messages: messages.map((m: { role: string; content: string }) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })) }) });
    const raw = await upstream.text();
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return NextResponse.json({ error: `AgentRouter returned HTTP ${upstream.status} with a non-JSON response.` }, { status: 502 }); }
    if (!upstream.ok) {
      const message = typeof data === "object" && data !== null && "error" in data ? String((data as { error?: unknown }).error) : `AgentRouter request failed with HTTP ${upstream.status}.`;
      return NextResponse.json({ error: message }, { status: upstream.status });
    }
    const content = typeof data === "object" && data !== null && Array.isArray((data as { content?: unknown }).content) ? (data as { content: Array<{ type?: string; text?: string }> }).content : [];
    const text = content.filter((block) => block?.type === "text" && typeof block.text === "string").map((block) => block.text).join("\n");
    if (!text) return NextResponse.json({ error: "AgentRouter returned no text content." }, { status: 502 });
    return NextResponse.json({ message: text });
  } catch (error) {
    console.error("AgentRouter error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "AgentRouter request failed." }, { status: 500 });
  }
}
