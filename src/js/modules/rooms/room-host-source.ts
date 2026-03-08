import { decodeBase64 } from "../../constants/index.js";

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export function decodeRoomHostSource(source: string): string {
  const trimmed = source.trim();
  if (trimmed === "") {
    return "";
  }

  const looksLikeBase64 = trimmed.length % 4 === 0 && BASE64_PATTERN.test(trimmed);
  if (looksLikeBase64 === false) {
    return source;
  }

  const decoded = decodeBase64(trimmed);
  return decoded.trim() !== "" ? decoded : source;
}
