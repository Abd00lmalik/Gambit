import { ethers } from "ethers";
import { execSync } from "child_process";
import "dotenv/config";
import fs from "fs";
import path from "path";

const RPC = process.env.RPC_URL;
const KEY_A = process.env.PRIVATE_KEY_A;
const KEY_B = process.env.PRIVATE_KEY_B;

const provider = new ethers.JsonRpcProvider(RPC);
const walletA = new ethers.Wallet(KEY_A, provider);
const walletB = new ethers.Wallet(KEY_B, provider);

const WAGER_ABI = [
  "function join() external",
  "function settle() external",
  "function state() view returns (uint8)",
  "function playerA() view returns (address)",
  "function playerB() view returns (address)",
  "function getPot() view returns (uint256)",
];

function loadArtifactBytecode(name) {
  const p = path.join("Gambit", "out", `${name}.sol`, `${name}.json`);
  const json = JSON.parse(fs.readFileSync(p, "utf8"));
  let bc = json.bytecode.object;
  while (bc.startsWith("0x0x")) bc = bc.slice(2);
  if (!bc.startsWith("0x")) bc = `0x${bc}`;
  return bc;
}

function castSend(args) {
  const cmd = `"/home/imaarm/.foundry/bin/cast" send --rpc-url "${RPC}" --private-key "${KEY_A}" ${args}`;
  const result = execSync(`wsl -d Ubuntu -- ${cmd}`, { encoding: "utf8" });
  // Parse the output
  const lines = result.split("\n").filter((l) => l.trim());
  const parsed = {};
  for (const line of lines) {
    const [key, ...rest] = line.split(/\s{2,}/);
    if (key && rest.length) parsed[key.trim()] = rest.join("  ").trim();
  }
  return parsed;
}

function castCall(to, sig) {
  const cmd = `"/home/imaarm/.foundry/bin/cast" call --rpc-url "${RPC}" "${to}" "${sig}"`;
  return execSync(`wsl -d Ubuntu -- ${cmd}`, { encoding: "utf8" }).trim();
}

function castSendRaw(args) {
  const cmd = `"/home/imaarm/.foundry/bin/cast" send --rpc-url "${RPC}" --private-key "${KEY_A}" ${args}`;
  return execSync(`wsl -d Ubuntu -- ${cmd}`, { encoding: "utf8" });
}

async function main() {
  console.log("=== GAMBIT DEPLOYMENT ===");
  console.log("Deployer (A):", walletA.address);
  console.log("Player B:", walletB.address);

  const balA = await provider.getBalance(walletA.address);
  console.log("Balance A:", ethers.formatEther(balA), "STT");

  // 1a. Deploy Wager implementation
  console.log("\n--- Step 1a: Deploy Wager Implementation ---");
  const wagerBytecode = loadArtifactBytecode("Wager");
  console.log("Wager bytecode length:", (wagerBytecode.length - 2) / 2, "bytes");

  const wagerResult = castSend(`--gas-limit 10000000 --create "${wagerBytecode}"`);
  console.log(wagerResult);

  const wagerImplAddr = wagerResult.contractAddress;
  const wagerCode = await provider.getCode(wagerImplAddr);
  console.log("Wager code length:", (wagerCode.length - 2) / 2, "bytes");

  if (wagerCode === "0x") {
    console.error("FATAL: Wager deployment failed - no code at address");
    process.exit(1);
  }

  // 1b. Deploy GambitFactory (constructor needs implementation address)
  console.log("\n--- Step 1b: Deploy GambitFactory ---");
  const factoryBytecode = loadArtifactBytecode("GambitFactory");

  // Constructor: (address _feeRecipient, uint256 _defaultFeeBps, uint256 _minStake, uint256 _maxStake, address _implementation)
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const constructorArgs = coder.encode(
    ["address", "uint256", "uint256", "uint256", "address"],
    [walletA.address, 250, ethers.parseEther("0.1"), ethers.parseEther("100"), wagerImplAddr]
  );
  const factoryDeployData = factoryBytecode + constructorArgs.slice(2);

  const factoryResult = castSend(`--gas-limit 15000000 --create "${factoryDeployData}"`);
  console.log(factoryResult);

  const factoryAddr = factoryResult.contractAddress;
  const factoryCode = await provider.getCode(factoryAddr);
  console.log("Factory code length:", (factoryCode.length - 2) / 2, "bytes");

  if (factoryCode === "0x") {
    console.error("FATAL: Factory deployment failed - no code at address");
    process.exit(1);
  }

  // 2. Read factory config
  console.log("\n--- Step 2: Verify Factory ---");
  const implResult = castCall(factoryAddr, "implementation()");
  console.log("Implementation:", implResult);

  const feeRecipResult = castCall(factoryAddr, "feeRecipient()");
  console.log("Fee Recipient:", feeRecipResult);

  const feeBpsResult = castCall(factoryAddr, "defaultFeeBps()");
  console.log("Fee (bps):", feeBpsResult);

  const minStakeResult = castCall(factoryAddr, "minStake()");
  console.log("Min Stake:", ethers.formatEther(minStakeResult), "STT");

  const maxStakeResult = castCall(factoryAddr, "maxStake()");
  console.log("Max Stake:", ethers.formatEther(maxStakeResult), "STT");

  // 3. Create a duel via factory
  const marketAddr = "0x89ed92fdb79e0f1ee6b753704b6fb5023ec8bb0e"; // resolved ETH-0-29AUG26-0800
  const stakeAmount = ethers.parseEther("0.5");
  const joinDeadline = Math.floor(Date.now() / 1000) + 3600;

  console.log("\n--- Step 3: Create Duel ---");
  const createResult = castSend(
    `--gas-limit 1000000 --value ${ethers.formatEther(stakeAmount)}ether "${factoryAddr}" "createDuel(address,uint256)" "${marketAddr}" ${joinDeadline}`
  );
  console.log(createResult);

  // Get clone address from transaction logs
  const txHash = createResult.transactionHash;
  const txReceipt = await provider.getTransactionReceipt(txHash);
  console.log("Create TX:", txHash);
  console.log("Gas used:", txReceipt.gasUsed.toString());

  // Find DuelCreated event
  const factoryInterface = new ethers.Interface([
    "event DuelCreated(address indexed clone, address indexed playerA, uint256 stakeAmount, address marketAddress, uint256 joinDeadline)",
  ]);

  let cloneAddr;
  for (const log of txReceipt.logs) {
    try {
      const parsed = factoryInterface.parseLog({ topics: log.topics, data: log.data });
      if (parsed?.name === "DuelCreated") {
        cloneAddr = parsed.args.clone;
        console.log("Clone:", cloneAddr);
        console.log("Player A:", parsed.args.playerA);
        console.log("Stake:", ethers.formatEther(parsed.args.stakeAmount), "STT");
        break;
      }
    } catch {}
  }

  if (!cloneAddr) {
    console.error("FATAL: Could not find DuelCreated event");
    process.exit(1);
  }

  // 4. Player B deposits STT
  console.log("\n--- Step 4: Player B Deposits ---");
  const depositResult = execSync(
    `wsl -d Ubuntu -- "/home/imaarm/.foundry/bin/cast" send --rpc-url "${RPC}" --private-key "${KEY_B}" --gas-limit 2500000 --value ${ethers.formatEther(stakeAmount)}ether "${cloneAddr}" ""`,
    { encoding: "utf8" }
  );
  const depositParsed = {};
  for (const line of depositResult.split("\n").filter((l) => l.trim())) {
    const [key, ...rest] = line.split(/\s{2,}/);
    if (key && rest.length) depositParsed[key.trim()] = rest.join("  ").trim();
  }
  console.log(depositParsed);

  // 5. Player B joins
  console.log("\n--- Step 5: Player B Joins ---");
  const joinResult = execSync(
    `wsl -d Ubuntu -- "/home/imaarm/.foundry/bin/cast" send --rpc-url "${RPC}" --private-key "${KEY_B}" --gas-limit 300000 "${cloneAddr}" "join()"`,
    { encoding: "utf8" }
  );
  const joinParsed = {};
  for (const line of joinResult.split("\n").filter((l) => l.trim())) {
    const [key, ...rest] = line.split(/\s{2,}/);
    if (key && rest.length) joinParsed[key.trim()] = rest.join("  ").trim();
  }
  console.log(joinParsed);

  // 6. Read final state
  console.log("\n--- Step 6: Read State ---");
  const stateResult = castCall(cloneAddr, "state()");
  const states = ["CREATED", "LOCKED", "SETTLED", "REFUNDED", "CANCELLED"];
  console.log("State:", states[Number(stateResult)]);

  const playerAResult = castCall(cloneAddr, "playerA()");
  console.log("Player A:", playerAResult);

  const playerBResult = castCall(cloneAddr, "playerB()");
  console.log("Player B:", playerBResult);

  const potResult = castCall(cloneAddr, "getPot()");
  console.log("Pot:", ethers.formatEther(potResult), "STT");

  console.log("\n=== DUEL LOCKED ===");
  console.log(`Factory: ${factoryAddr}`);
  console.log(`Clone: ${cloneAddr}`);
  console.log("To settle: wait for DreamDEX market to resolve, then call settle()");
}

main().catch(console.error);
