import { NextResponse } from "next/server";

export async function GET() {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;color:#333;}</style></head><body>
<p>Connecté !</p>
<script>window.close();</script>
</body></html>`;

    return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}
