import type { IncomingMessage, ServerResponse } from "node:http";
import {
  bodyLimitBytes,
  maxJsonDepth,
  type ErrorCode,
} from "../../../../gaia-protocol/v1/src/schema.ts";
import { SessionError } from "./session.ts";

const statuses = {
  invalid_packet: 400,
  not_authorized: 403,
  media_type: 415,
  too_large: 413,
  session_expired: 409,
  session_busy: 409,
  sequence_conflict: 409,
  rate_limited: 429,
  unavailable: 503,
} satisfies Record<ErrorCode, number>;

export class RequestError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly retryAfterMs?: number
  ) {
    super(code);
  }
}

export function reply(res: ServerResponse, status: number, object?: unknown, wait?: number) {
  if (res.destroyed || res.writableEnded) return;
  const body = object === undefined ? "" : JSON.stringify(object);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    connection: "close",
    ...(wait === undefined ? {} : { "retry-after": String(Math.max(1, Math.ceil(wait / 1000))) }),
  });
  res.end(body);
}

export function replyError(res: ServerResponse, error: unknown) {
  const failure =
    error instanceof SessionError || error instanceof RequestError
      ? error
      : new RequestError("unavailable");
  reply(
    res,
    statuses[failure.code],
    { v: 1, error: failure.code },
    failure.retryAfterMs ?? (failure.code === "unavailable" ? 1000 : undefined)
  );
}

function invalid(): never {
  throw new RequestError("invalid_packet");
}

// Keep the bytes' UTF-8 spelling for B4, including whitespace and escapes. The key set
// belongs to each object so an escaped spelling cannot hide a second member.
export function decodeFieldBody(bytes: Buffer) {
  if (bytes.length > bodyLimitBytes) throw new RequestError("too_large");
  let body: string;
  try {
    body = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return invalid();
  }
  const tokens =
    /[ \n\t\r]*("(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[[\]{}:,])/y;
  let index = 0;
  function token(): string {
    tokens.lastIndex = index;
    const match = tokens.exec(body);
    if (!match) return invalid();
    index = tokens.lastIndex;
    return match[1]!;
  }
  function value(raw: string, depth: number): unknown {
    if (raw === "{" || raw === "[") {
      if (depth === maxJsonDepth) return invalid();
      const array = raw === "[";
      const end = array ? "]" : "}";
      const items: unknown[] = [];
      const obj: Record<string, unknown> = Object.create(null);
      let next = token();
      if (next !== end) {
        for (;;) {
          if (array) items.push(value(next, depth + 1));
          else {
            if (!next.startsWith('"')) return invalid();
            const key = JSON.parse(next) as string;
            if (
              Object.hasOwn(obj, key) ||
              ["__proto__", "prototype", "constructor"].includes(key) ||
              token() !== ":"
            )
              return invalid();
            obj[key] = value(token(), depth + 1);
          }
          const delimiter = token();
          if (delimiter === end) break;
          if (delimiter !== ",") return invalid();
          next = token();
        }
      }
      return array ? items : obj;
    }
    if (raw.startsWith('"')) return JSON.parse(raw) as string;
    if (raw === "true") return true;
    if (raw === "false") return false;
    if (raw === "null") return null;
    const number = Number(raw);
    if (!Number.isFinite(number)) return invalid();
    if (Number.isInteger(number)) {
      if (!Number.isSafeInteger(number)) return invalid();
      // Reject a fraction rounded to an integer (including underflow) before a B1
      // integer field can accept it. Equivalent decimal/exponent spellings remain valid.
      const [mantissa, exponent] = raw.toLowerCase().split("e");
      const fraction = mantissa!.split(".")[1] ?? "";
      const digits = mantissa!.replace(/[-.]/g, "");
      const scale = fraction.length - Number(exponent ?? 0);
      if (scale > 0 && /[1-9]/.test(digits.slice(-scale))) return invalid();
    }
    return number;
  }
  try {
    const packet = value(token(), 0);
    if (!/^[ \r\n\t]*$/.test(body.slice(index))) return invalid();
    return { body, packet };
  } catch {
    return invalid();
  }
}

export async function readFieldBody(req: IncomingMessage) {
  const headers = req.headersDistinct;
  const type = headers["content-type"];
  if (
    type?.length !== 1 ||
    !/^application\/json(?:\s*;\s*charset=(?:utf-8|"utf-8"))?$/i.test(type[0]!) ||
    headers["content-encoding"]
  )
    throw new RequestError("media_type");
  const length = headers["content-length"];
  const transfer = headers["transfer-encoding"];
  if (
    headers["expect"] ||
    headers["trailer"] ||
    headers["upgrade"] ||
    (transfer
      ? length || transfer.length !== 1 || transfer[0]?.toLowerCase() !== "chunked"
      : length?.length !== 1 || !/^\d+$/.test(length[0]!))
  )
    return invalid();
  if (length && Number(length[0]) > bodyLimitBytes) throw new RequestError("too_large");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    const bytes = chunk as Buffer;
    size += bytes.length;
    if (size > bodyLimitBytes) throw new RequestError("too_large");
    chunks.push(bytes);
  }
  if (!req.complete || req.rawTrailers.length || (length && size !== Number(length[0])))
    return invalid();
  return decodeFieldBody(Buffer.concat(chunks, size));
}
