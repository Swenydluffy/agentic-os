/**
 * Microsoft Edge "Read Aloud" Neural TTS client (server-only).
 *
 * Connects to the same public WebSocket endpoint that Microsoft Edge uses
 * internally for its Read Aloud feature — no API key, no Azure account. The
 * TrustedClientToken below is the constant baked into Edge itself; it is
 * publicly known and shared by every edge-tts library.
 *
 * Protocol overview:
 *   1. Open wss://… with the trusted client token.
 *   2. Send a `speech.config` text frame describing the audio format.
 *   3. Send an `ssml` text frame with the prompt.
 *   4. Receive binary frames carrying MP3 audio + text frames signalling
 *      `turn.start` / `turn.end`. Concatenate audio bytes until turn.end.
 *
 * Binary frames are framed: [uint16 BE header-length][text headers][audio bytes].
 */
import WebSocket, { type RawData } from "ws";
import { createHash, randomBytes } from "node:crypto";

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WS_HOST = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const AUDIO_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
// Current Edge identity; older strings get 403'd by the endpoint.
const EDGE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0";
const SEC_MS_GEC_VERSION = "1-138.0.3351.95";

/** Default voice — deep, calm, natural. */
export const DEFAULT_VOICE = "en-US-ChristopherNeural";

function connectionId(): string {
  return randomBytes(16).toString("hex").toUpperCase();
}

/**
 * Compute the Sec-MS-GEC anti-abuse token the Edge endpoint now requires.
 * It's SHA256 of `<windows-ticks rounded to 5-min window><trusted-token>`.
 * Mirrors the canonical algorithm used by python-edge-tts and friends.
 */
function secMsGec(): string {
  // Use BigInt() calls (not `n` literals) so this compiles with target=ES2017.
  const WIN_EPOCH = BigInt(11644473600); // seconds between 1601-01-01 and 1970-01-01
  const TICKS_PER_SEC = BigInt(10000000); // 100ns units per second
  const WINDOW_5MIN = BigInt(3000000000); // 300s * 1e7 (5-minute bucket)
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  let ticks = (nowSec + WIN_EPOCH) * TICKS_PER_SEC;
  ticks -= ticks % WINDOW_5MIN;
  return createHash("sha256")
    .update(`${ticks.toString()}${TRUSTED_CLIENT_TOKEN}`, "ascii")
    .digest("hex")
    .toUpperCase();
}

function buildWsUrl(connId: string): string {
  const params = new URLSearchParams({
    TrustedClientToken: TRUSTED_CLIENT_TOKEN,
    "Sec-MS-GEC": secMsGec(),
    "Sec-MS-GEC-Version": SEC_MS_GEC_VERSION,
    ConnectionId: connId,
  });
  return `${WS_HOST}?${params.toString()}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function configMessage(): string {
  const ts = new Date().toUTCString();
  const config = {
    context: {
      synthesis: {
        audio: {
          metadataoptions: {
            sentenceBoundaryEnabled: "false",
            wordBoundaryEnabled: "false",
          },
          outputFormat: AUDIO_FORMAT,
        },
      },
    },
  };
  return `X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify(config)}`;
}

function ssmlMessage(text: string, voice: string, connId: string): string {
  const ts = new Date().toUTCString();
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'>${escapeXml(text)}</voice></speak>`;
  return `X-RequestId:${connId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}\r\nPath:ssml\r\n\r\n${ssml}`;
}

function toBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data as ArrayBuffer);
}

/**
 * Synthesize speech from `text` using Edge TTS and return the resulting MP3
 * bytes (24kHz mono). Throws if the connection or synthesis fails / times out.
 */
export async function synthesizeEdgeTts(
  text: string,
  voice: string = DEFAULT_VOICE,
  timeoutMs = 30_000,
): Promise<Buffer> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty text");

  const connId = connectionId();
  const ws = new WebSocket(buildWsUrl(connId), {
    headers: { "User-Agent": EDGE_UA },
    handshakeTimeout: 8000,
  });

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;
    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      action();
    };

    const timer = setTimeout(() => {
      settle(() => reject(new Error(`Edge TTS timed out after ${timeoutMs}ms`)));
    }, timeoutMs);

    ws.on("open", () => {
      try {
        ws.send(configMessage());
        ws.send(ssmlMessage(trimmed, voice, connId));
      } catch (e) {
        settle(() => reject(e instanceof Error ? e : new Error(String(e))));
      }
    });

    ws.on("message", (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        const buf = toBuffer(data);
        if (buf.length < 2) return;
        const headerLen = buf.readUInt16BE(0);
        if (headerLen + 2 > buf.length) return;
        const headerText = buf.subarray(2, 2 + headerLen).toString("utf8");
        if (/Path\s*:\s*audio\b/i.test(headerText)) {
          chunks.push(buf.subarray(2 + headerLen));
        }
        return;
      }
      const textFrame = toBuffer(data).toString("utf8");
      if (/Path\s*:\s*turn\.end\b/i.test(textFrame)) {
        if (chunks.length === 0) {
          settle(() => reject(new Error("Edge TTS returned no audio")));
        } else {
          settle(() => resolve(Buffer.concat(chunks)));
        }
      }
      // turn.start, response, audio.metadata → ignored
    });

    ws.on("error", (err: Error) => {
      settle(() => reject(new Error(`Edge TTS connection error: ${err.message}`)));
    });

    ws.on("close", (code) => {
      // If we already settled (normal turn.end), this is just cleanup.
      // Otherwise the server closed before turn.end — surface it.
      settle(() => {
        if (chunks.length > 0) resolve(Buffer.concat(chunks));
        else reject(new Error(`Edge TTS closed without audio (code ${code})`));
      });
    });
  });
}
