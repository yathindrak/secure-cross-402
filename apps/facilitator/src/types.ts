export interface PaymentPayload {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
  verifyingContract: string;
  chainId: number;
  signature: string;
}
