#!/bin/bash
PATH="$HOME/.foundry/bin:$PATH"
OUT="/mnt/c/Users/USER/head2head-testnet/Gambit/out"
LOG="/mnt/c/Users/USER/head2head-testnet/Gambit/bytecode-debug.txt"

python3 << 'PYEOF' > "$LOG"
import json
data = json.load(open("/mnt/c/Users/USER/head2head-testnet/Gambit/out/GambitFactory.sol/GambitFactory.json"))
bc = data["bytecode"]["object"]
print("Type:", type(bc))
print("Length:", len(bc))
print("Starts with 0x:", bc.startswith("0x"))
print("First 80 chars:", bc[:80])
print("Last 80 chars:", bc[-80:])
PYEOF
