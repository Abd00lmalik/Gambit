// Decode Solidity `Error(string)` revert data (0x08c379a0…) into the human
// message. Used to surface the CONTRACT's own revert reason (e.g.
// "stale market record") in the UI instead of a generic failure.
//
// Verified against the real failed cashout tx
// 0x8c5ac5ba034c34658e22ba2e6d1c14b04db0874faf14de17c3932d87c1d9b954,
// whose eth_call returns exactly this payload with "stale market record".
export function decodeRevertReason(data: unknown): string | null {
  if (typeof data !== "string") return null;
  const hex = data.toLowerCase().replace(/^0x/, "");
  // keccak256("Error(string)") selector
  if (!hex.startsWith("08c379a0")) return null;
  const body = hex.slice(8);
  if (body.length < 64) return null;
  // offset (bytes32) — expect 0x20
  // let offset = Number(BigInt("0x" + body.slice(0, 64)));  // not needed for standard layout
  const length = Number(BigInt("0x" + body.slice(64, 128)));
  if (!Number.isFinite(length) || length <= 0 || length > 1024) return null;
  const strHex = body.slice(128, 128 + length * 2);
  if (strHex.length < length * 2) return null;
  try {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) bytes[i] = parseInt(strHex.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Best-effort revert reason extraction from any viem/RPC error shape. */
export function revertReasonFromError(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  const err = e as any;
  // viem ContractFunctionExecutionError: .data / .cause.data hold the revert data
  for (const candidate of [err.data, err.cause?.data, err.cause?.cause?.data, err.shortMessage]) {
    const decoded = decodeRevertReason(candidate);
    if (decoded) return decoded;
  }
  // raw RPC error message ("execution reverted: stale market record")
  if (typeof err.message === "string" && err.message.includes("reverted:")) {
    return err.message.split("reverted:")[1].trim() || null;
  }
  return null;
}
