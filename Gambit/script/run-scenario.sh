#!/bin/bash
set -e
export PATH="/home/imaarm/.foundry/bin:$PATH"
RPC="https://api.infra.testnet.somnia.network"
PK_A="0xd9c246d4b642c0d95adf60a8a6e680352b996a9d139ca9f5d4fa1f545487095a"
PK_B="0x76d73b841d6b086cf98dda0f97588ec9f463472b6f016eae73f51b966be7aed7"
FACTORY="0x3E106bA72C3AdB511076Cf849c4A70bb132Be395"
MARKET="0x89ed92fdb79e0f1ee6b753704b6fb5023ec8bb0e"
STAKE="0.5ether"
DEADLINE=$(($(date +%s) + 3600))
B_ADDR="0x0022EC010030158cC27B283BA640706eDBa6080f"

echo "=== GAMBIT SCENARIO ==="
echo "Factory: $FACTORY"

# Step 1: Player A creates duel
echo -e "\n--- Step 1: Create Duel ---"
RECEIPT=$(cast send --rpc-url "$RPC" --private-key "$PK_A" --gas-limit 5000000 --value "$STAKE" "$FACTORY" "createDuel(address,uint256)" "$MARKET" "$DEADLINE" --json 2>&1)
echo "$RECEIPT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Status:', d['status']); print('Gas:', d['gasUsed'])"

# Extract clone from receipt logs - first indexed param of first log
CLONE=$(echo "$RECEIPT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for log in d.get('logs',[]):
    t=log.get('topics',[])
    if len(t)>=2 and log.get('address','').lower()=='$FACTORY'.lower():
        print('0x'+t[1][-40:])
        break
")
echo "Clone: $CLONE"

# Verify clone state
echo -e "\n--- Verify Clone ---"
STATE=$(cast call --rpc-url "$RPC" "$CLONE" "state()" 2>/dev/null | head -c 3)
echo "State: $STATE (0=CREATED)"
PA=$(cast call --rpc-url "$RPC" "$CLONE" "playerA()" 2>/dev/null)
echo "Player A: $PA"

# Step 2: Player B deposits STT via receive()
echo -e "\n--- Step 2: Player B Deposits ---"
DEP_RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK_B" --gas-limit 2500000 --value "$STAKE" "$CLONE" "" --json 2>&1) || true
echo "$DEP_RESULT" | python3 -c "
import sys,json
raw=sys.stdin.read()
try:
    d=json.loads(raw)
    print('Status:', d.get('status','?'))
    print('Gas:', d.get('gasUsed','?'))
except:
    for line in raw.splitlines():
        if 'status' in line.lower() or 'gas' in line.lower():
            print(line.strip())
" || echo "$DEP_RESULT" | head -5
DEP=$(cast call --rpc-url "$RPC" "$CLONE" "deposits(address)" "$B_ADDR" 2>/dev/null)
echo "B deposit recorded: $DEP"

# Step 3: Player B joins
echo -e "\n--- Step 3: Player B Joins ---"
JOIN_RESULT=$(cast send --rpc-url "$RPC" --private-key "$PK_B" --gas-limit 500000 "$CLONE" "join()" --json 2>&1) || true
echo "$JOIN_RESULT" | python3 -c "
import sys,json
raw=sys.stdin.read()
try:
    d=json.loads(raw)
    print('Status:', d.get('status','?'))
    print('Gas:', d.get('gasUsed','?'))
except:
    for line in raw.splitlines():
        if 'status' in line.lower() or 'gas' in line.lower():
            print(line.strip())
" || echo "$JOIN_RESULT" | head -5

STATE2=$(cast call --rpc-url "$RPC" "$CLONE" "state()" 2>/dev/null | head -c 3)
echo "State: $STATE2 (1=LOCKED)"
POT=$(cast call --rpc-url "$RPC" "$CLONE" "getPot()" 2>/dev/null)
echo "Pot: $POT"

echo -e "\n=== DUEL LOCKED SUCCESSFULLY ==="
echo "Clone: $CLONE"
echo "Factory: $FACTORY"
echo "Next: settle() after DreamDEX market resolution"
