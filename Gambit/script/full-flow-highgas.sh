#!/bin/bash
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
PK_A="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
PK_B="0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7"
FACTORY="0x3E106bA72C3AdB511076Cf849c4A70bb132Be395"
MARKET="0x89ed92fdb79e0f1ee6b753704b6fb5023ec8bb0e"
B_ADDR="0x0022EC010030158cC27B283BA640706eDBa6080f"
DEADLINE=$(($(date +%s) + 7200))

echo "=== FULL FLOW WITH HIGH GAS ==="

# Step 1: Create duel
echo -e "\n--- Step 1: Create Duel ---"
TX1=$(cast send --rpc-url "$RPC" --private-key "$PK_A" --gas-limit 5000000 --value "0.5ether" "$FACTORY" "createDuel(address,uint256)" "$MARKET" "$DEADLINE" --json 2>&1)
CLONE=$(echo "$TX1" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('Status:', d['status'])
for log in d.get('logs',[]):
    t=log.get('topics',[])
    if len(t)>=2:
        print('0x'+t[1][-40:])
        break
" | tail -1)
echo "Clone: $CLONE"
sleep 3

# Step 2: B deposits
echo -e "\n--- Step 2: B Deposits ---"
cast send --rpc-url "$RPC" --private-key "$PK_B" --gas-limit 2500000 --value "0.5ether" --data "0x" "$CLONE" 2>&1
sleep 2

echo "Deposits(B):"
cast call --rpc-url "$RPC" "$CLONE" "deposits(address)" "$B_ADDR"

# Step 3: B joins with HIGH gas (Somnia needs 1M+ gas remaining for DELEGATECALL)
echo -e "\n--- Step 3: B Joins (gas limit 5000000) ---"
cast send --rpc-url "$RPC" --private-key "$PK_B" --gas-limit 5000000 "$CLONE" "join()" 2>&1
sleep 2

echo -e "\n--- Final state ---"
echo "state():"
cast call --rpc-url "$RPC" "$CLONE" "state()"
echo "playerB():"
cast call --rpc-url "$RPC" "$CLONE" "playerB()"
echo "pot():"
cast call --rpc-url "$RPC" "$CLONE" "getPot()"
