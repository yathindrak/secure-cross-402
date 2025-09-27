import { ethers } from 'ethers';
import { getEnv } from './env';

export async function createPaymentPayload(from: string, to: string, value: string, verifyingContract: string, chainId?: number) {
  const now = Math.floor(Date.now() / 1000);
  const nonceRaw = Math.random().toString(36).slice(2);
  const nonce = ethers.id(nonceRaw); // bytes32
  const payload = {
    from,
    to,
    value,
    validAfter: now - 60,
    validBefore: now + 300,
    nonce: nonce,
    verifyingContract,
    chainId: chainId || 80002 // user provided chainId or default to polygon-amoy
  } as any;

  // EIP-712 domain and types for EIP-3009 TransferWithAuthorization
  const domain = {
    name: 'USDC',
    version: '2',
    chainId: payload.chainId,
    verifyingContract: verifyingContract
  };

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' }
    ]
  };

  const message = {
    from: payload.from,
    to: payload.to,
    value: payload.value,
    validAfter: payload.validAfter,
    validBefore: payload.validBefore,
    nonce: payload.nonce
  };

  const { PRIVATE_KEY } = getEnv();
  const wallet = new ethers.Wallet(PRIVATE_KEY);

  // Ensure verifyingContract is a valid address to avoid ENS lookup in signTypedData
  const verifyingContractAddress = ethers.isAddress(verifyingContract) ? verifyingContract : ethers.ZeroAddress;
  domain.verifyingContract = verifyingContractAddress;
  // normalize in payload so facilitator reads the same value
  payload.verifyingContract = verifyingContractAddress;

  // Sign EIP-712 typed data
  // ethers v6 wallet provides signTypedData
  const signature = await (wallet as any).signTypedData(domain, types, message);
  payload.signature = signature;
  // Keep original raw nonce for debugging if needed
  payload._rawNonce = nonceRaw;
  // Debug: write typed data to console for facilitator comparison
  console.log('CLIENT: typed-data domain=', JSON.stringify(domain));
  console.log('CLIENT: types=', JSON.stringify(types));
  console.log('CLIENT: message=', JSON.stringify(message));
  console.log('CLIENT: signature=', signature);
  return payload;
}

export function encodePaymentPayload(payload: any) {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
