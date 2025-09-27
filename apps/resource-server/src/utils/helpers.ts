export function getUsdcAddressForChain(chain: string): string {
  const tokenAddresses: Record<string, string> = {
    'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    'polygon': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    'polygon-amoy': '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'
  };
  return tokenAddresses[chain] || '';
}
