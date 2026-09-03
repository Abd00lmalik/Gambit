import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { type Chain } from "viem";

export const somnia: Chain = {
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.infra.testnet.somnia.network"] },
    public: { http: ["https://api.infra.testnet.somnia.network"] },
  },
  blockExplorers: {
    default: {
      name: "Shannon Explorer",
      url: "https://shannon-explorer.somnia.network",
    },
  },
  testnet: true,
};

export const config = createConfig({
  chains: [somnia],
  connectors: [
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [somnia.id]: http("https://api.infra.testnet.somnia.network"),
  },
});
