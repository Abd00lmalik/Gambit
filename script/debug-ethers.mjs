import { ethers } from "ethers";
import "dotenv/config";

const RPC = process.env.RPC_URL;
const PK_B = process.env.PRIVATE_KEY_B;
const B_ADDR = "0x0022EC010030158cC27B283BA640706eDBa6080f";

const provider = new ethers.JsonRpcProvider(RPC);
const walletB = new ethers.Wallet(PK_B, provider);

// Latest clone from fresh-flow2.sh
const CLONE = "0x2CC3d33F37bFadD5f3B8b131022609EE6Afa5e5b";

const WAGER_ABI = [
  "function join() external",
  "function state() view returns (uint8)",
  "function playerA() view returns (address)",
  "function playerB() view returns (address)",
  "function stakeAmount() view returns (uint256)",
  "function joinDeadline() view returns (uint256)",
  "function deposits(address) view returns (uint256)",
  "function getPot() view returns (uint256)",
  "function factory() view returns (address)",
  "function marketAddress() view returns (address)",
];

async function main() {
  const wager = new ethers.Contract(CLONE, WAGER_ABI, walletB);

  console.log("=== State Check ===");
  console.log("state:", await wager.state());
  console.log("playerA:", await wager.playerA());
  console.log("playerB:", await wager.playerB());
  console.log("stakeAmount:", (await wager.stakeAmount()).toString());
  console.log("joinDeadline:", (await wager.joinDeadline()).toString());
  console.log("B deposit:", (await wager.deposits(B_ADDR)).toString());
  console.log("pot:", (await wager.getPot()).toString());
  console.log("factory:", await wager.factory());

  const now = Math.floor(Date.now() / 1000);
  const deadline = await wager.joinDeadline();
  console.log("now:", now, "deadline:", deadline.toString(), "valid:", now <= Number(deadline));

  console.log("\n=== Try join() ===");
  try {
    const tx = await wager.join({ gasLimit: 500000 });
    console.log("TX sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Status:", receipt.status);
    console.log("Gas used:", receipt.gasUsed.toString());
  } catch (e) {
    console.error("TX error:", e.message?.substring(0, 200));
  }

  // Try callStatic first
  console.log("\n=== Try callStatic join() ===");
  try {
    await wager.join.staticCall();
    console.log("callStatic: SUCCESS");
  } catch (e) {
    console.error("callStatic failed:", e.message?.substring(0, 200));
  }

  console.log("\n=== State after ===");
  console.log("state:", await wager.state());
  console.log("playerB:", await wager.playerB());
}

main().catch(console.error);
