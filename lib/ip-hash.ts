import { createHash } from "node:crypto"

const SALT = process.env.IP_HASH_SALT ?? "status-watch-dev-salt"

export function ipHash(ip: string): string {
  return createHash("sha256")
    .update(SALT + "::" + (ip || "0.0.0.0"))
    .digest("hex")
}
