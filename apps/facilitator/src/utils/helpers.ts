import { getEnv } from "../env";

const { AMOY_RPC_URL, AMOY_USDC_ADDRESS } = getEnv();

export function getRpcUrlForChain(chain: string): string {
  const rpcUrls: Record<string, string> = {
    'base': 'https://mainnet.base.org',
    'base-sepolia': 'https://sepolia.base.org',
    'polygon': 'https://polygon-rpc.com',
    'polygon-amoy': AMOY_RPC_URL
  };
  return rpcUrls[chain] || '';
}

export function getTokenAddressForChain(chain: string): string {
  const tokenAddresses: Record<string, string> = {
    'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    'polygon': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    'polygon-amoy': AMOY_USDC_ADDRESS
  };
  return tokenAddresses[chain] || '';
}

export function generateJobId(): string {
  return `bridge-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function decodeBase64Json<T = any>(b64?: string): T | null {
  if (!b64) return null;
  try {
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json) as T;
  } catch (e) {
    return null;
  }
}
