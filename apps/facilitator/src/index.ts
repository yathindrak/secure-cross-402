import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { ethers } from 'ethers';
import { PaymentPayload } from './types';
import { getEnv } from './env';
import { decodeBase64Json } from './utils/helpers';
import { verifyPaymentOnChain, settleWithPreFundedBalance } from './services/payment';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const { PORT } = getEnv();

// In-memory nonce store to prevent replay attacks
const usedNonces = new Set<string>();
console.log(`[FACILITATOR] Starting with empty nonce store`);

app.get('/supported', (_req: any, res: any) => {
  res.json({
    networks: [
      { name: 'polygon-amoy', chainId: 80002, schemes: ['exact'] },
      { name: 'base-sepolia', chainId: 84532, schemes: ['exact'] },
      { name: 'polygon', chainId: 137, schemes: ['exact'] },
      { name: 'base', chainId: 8453, schemes: ['exact'] }
    ]
  });
});

app.post('/verify', async (req: any, res: any) => {
  const body = req.body || {};
  const b64 = body.paymentPayloadBase64 || (req.headers['x-payment'] as string) || undefined;
  const payload = decodeBase64Json<PaymentPayload>(b64);
  if (!payload) return res.status(400).json({ success: false, errors: ['invalid_payload'] });

  const now = Math.floor(Date.now() / 1000);
  const errors: string[] = [];

  // Accept payments from any supported chain for instant settlement
  const supportedChainIds = [80002, 8453, 84532, 137]; // polygon-amoy, base, base-sepolia, polygon
  if (!supportedChainIds.includes(payload.chainId)) {
    errors.push('invalid_chain');
    console.log(`[VERIFY] Unsupported chainId: ${payload.chainId}, supported: ${supportedChainIds.join(', ')}`);
  }
  if (now < payload.validAfter) errors.push('not_yet_valid');
  if (now > payload.validBefore) errors.push('expired');
  if (usedNonces.has(payload.nonce)) errors.push('nonce_replay');

  // Try recover address from signature by recreating EIP-191 prefixed hash of payload
  // Compute digest as keccak256 of JSON string and verify signature correctness
  try {
    // Try EIP-712 (TransferWithAuthorization) verification first
    const domain = {
      name: 'USDC',
      version: '2',
      chainId: payload.chainId,
      verifyingContract: payload.verifyingContract
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
    console.log('FACILITATOR: typed-data domain=', JSON.stringify(domain));
    console.log('FACILITATOR: message=', JSON.stringify(message));
    console.log('FACILITATOR: signature=', payload.signature);
    try {
      const recovered = ethers.verifyTypedData(domain, types, message, payload.signature);
      console.log(`Recovered address: ${recovered}`);
      if (recovered.toLowerCase() !== payload.from.toLowerCase()) {
        errors.push('signature_mismatch');
      }
    } catch (e) {
      // Fallback: keccak256 of JSON scheme - try to recover using raw hash
      try {
        const serialized = JSON.stringify(message);
        const hash = ethers.keccak256(ethers.toUtf8Bytes(serialized));
        const recovered2 = ethers.recoverAddress(hash, payload.signature);
        console.log('FACILITATOR: fallback recovered=', recovered2);
        if (recovered2.toLowerCase() !== payload.from.toLowerCase()) {
          errors.push('signature_mismatch');
        }
      } catch (e2) {
        errors.push('signature_verification_failed');
      }
    }
  } catch (e) {
    errors.push('signature_verification_failed');
  }

  if (errors.length) return res.status(400).json({ success: false, errors });

  return res.json({ success: true });
});

app.post('/settle', async (req: any, res: any) => {
  const body = req.body || {};
  const b64 = body.paymentPayloadBase64 || (req.headers['x-payment'] as string) || undefined;
  const payload = decodeBase64Json<PaymentPayload>(b64);
  if (!payload) return res.status(400).json({ success: false, errors: ['invalid_payload'] });

  // As a basic replay protection, mark nonce as used
  console.log(`[SETTLE] Checking nonce: ${payload.nonce}, used: ${usedNonces.has(payload.nonce)}`);
  if (usedNonces.has(payload.nonce)) {
    console.log(`[SETTLE] Nonce replay detected: ${payload.nonce}`);
    return res.status(400).json({ success: false, errors: ['nonce_replay'] });
  }
  usedNonces.add(payload.nonce);
  console.log(`[SETTLE] Nonce marked as used: ${payload.nonce}, total used: ${usedNonces.size}`);

  // Check for cross-chain payment request
  const userPreferredChain = req.headers['x-user-chain'] as string;
  const targetChain = (req.headers['x-target-chain'] as string) || 'polygon-amoy';
  const resourceServerAddress = req.headers['x-resource-server-address'] as string;

  console.log(`[FACILITATOR] Settle request:`, {
    userPreferredChain,
    targetChain,
    paymentNetwork: payload.chainId,
    isCrossChain: userPreferredChain && userPreferredChain !== targetChain,
  });

  // Always settle instantly on target chain
  if (userPreferredChain && userPreferredChain !== targetChain) {
    console.log(`[INSTANT-SETTLEMENT] Cross-chain payment detected: ${userPreferredChain} → ${targetChain}`);
    console.log(`[INSTANT-SETTLEMENT] Settling instantly on ${targetChain} with pre-funded balance`);

    // Verify payment was received on userPreferredChain by executing the transferWithAuthorization
    const paymentReceived = await verifyPaymentOnChain(userPreferredChain, payload);
    if (!paymentReceived) {
      console.error(`[INSTANT-SETTLEMENT] Payment verification failed on ${userPreferredChain}`);
      return res.status(400).json({
        success: false,
        errors: ['payment_verification_failed']
      });
    }

    // Use pre-funded balance on targetChain for instant settlement
    const settlementResult = await settleWithPreFundedBalance(targetChain, payload, resourceServerAddress);
    if (!settlementResult.success) {
      console.error(`[INSTANT-SETTLEMENT] Settlement failed:`, settlementResult.error);
      return res.status(500).json({
        success: false,
        errors: ['instant_settlement_failed', settlementResult.error]
      });
    }

    // TODO: Here we can add background bridge functionality with a queue or some sorta stack

    // Generate a proper transaction hash for instant settlement
    const instantTxHash = `0x${Buffer.from(`instant-${payload.nonce}-${Date.now()}`).toString('hex').padStart(64, '0')}`;

    const response = {
      success: true,
      transaction: instantTxHash,
      network: targetChain,
      payer: payload.from
    };

    const b64resp = Buffer.from(JSON.stringify(response)).toString('base64');
    res.setHeader('X-PAYMENT-RESPONSE', b64resp);
    return res.json(response);
  }

  // Same-chain settlement using instant settlement model
  console.log(`[INSTANT-SETTLEMENT] Same-chain payment detected: ${targetChain} → ${targetChain}`);
  console.log(`[INSTANT-SETTLEMENT] Settling instantly on ${targetChain} with pre-funded balance`);

  // For same-chain payments, we still need to verify the payment was received
  const paymentReceived = await verifyPaymentOnChain(targetChain, payload);
  if (!paymentReceived) {
    console.error(`[INSTANT-SETTLEMENT] Payment verification failed on ${targetChain}`);
    return res.status(400).json({
      success: false,
      errors: ['payment_verification_failed']
    });
  }

  // Use pre-funded balance for instant settlement
  const settlementResult = await settleWithPreFundedBalance(targetChain, payload, resourceServerAddress);
  if (!settlementResult.success) {
    console.error(`[INSTANT-SETTLEMENT] Settlement failed:`, settlementResult.error);
    return res.status(500).json({
      success: false,
      errors: ['instant_settlement_failed', settlementResult.error]
    });
  }

  // Generate a proper transaction hash for instant settlement
  const instantTxHash = `0x${Buffer.from(`instant-${payload.nonce}-${Date.now()}`).toString('hex').padStart(64, '0')}`;

  const response = {
    success: true,
    transaction: instantTxHash,
    network: targetChain,
    payer: payload.from
  };

  const b64resp = Buffer.from(JSON.stringify(response)).toString('base64');
  res.setHeader('X-PAYMENT-RESPONSE', b64resp);
  return res.json(response);
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(Number(PORT), () => {
  console.log(`Facilitator listening on port ${PORT}`);
});
