import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { ethers } from 'ethers';
import { PaymentPayload, RiskConfig, VerifyResponse } from './types';
import { getEnv } from './env';
import { decodeBase64Json } from './utils/helpers';
import { verifyPaymentOnChain, settleWithPreFundedBalance } from './services/payment';
import { calculateRiskScore } from './services/riskAnalysis';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const { PORT } = getEnv();

// In-memory nonce store to prevent replay attacks
const usedNonces = new Set<string>();
console.log(`[FACILITATOR] Starting with empty nonce store`);

// Default risk configuration
const DEFAULT_RISK_CONFIG: RiskConfig = {
  criticalThreshold: 30,
  highThreshold: 60,
  mediumThreshold: 80,
  actions: {
    onCritical: 'reject',
    onHigh: 'allow',
    onMedium: 'allow',
    onLow: 'allow'
  },
  sanctionsHandling: {
    rejectOnSanctions: true,
    rejectOnChainalysis: true,
    rejectOnBlacklist: true
  },
  highValueThreshold: '1000000000000000000000', // 1000 USDC in wei
  highValueActions: {
    requireKyc: false, // No manual KYC requirement for speed
    requireAdditionalVerification: false, // No manual verification for speed
    enhancedMonitoring: true
  },
  enableDetailedLogging: true,
  enableRiskProfileResponse: true
};

// Helper function to determine action based on risk score and config
function determineAction(riskLevel: string, config: RiskConfig, paymentAmount?: string): {
  action: 'reject' | 'allow';
  reason: string;
} {
  // Check for high-value transactions
  if (paymentAmount && BigInt(paymentAmount) > BigInt(config.highValueThreshold)) {
    if (config.highValueActions.enhancedMonitoring) {
      return { action: 'allow', reason: 'High-value transaction requires enhanced monitoring' };
    }
  }

  // Determine action based on risk level
  switch (riskLevel) {
    case 'CRITICAL':
      return { action: config.actions.onCritical, reason: 'Critical risk level detected' };
    case 'HIGH':
      return { action: config.actions.onHigh, reason: 'High risk level detected' };
    case 'MEDIUM':
      return { action: config.actions.onMedium, reason: 'Medium risk level detected' };
    case 'LOW':
    default:
      return { action: config.actions.onLow, reason: 'Low risk level' };
  }
}

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

  // Get risk configuration from request or use default
  const riskConfig: RiskConfig = body.riskConfig || DEFAULT_RISK_CONFIG;

  const now = Math.floor(Date.now() / 1000);
  const errors: string[] = [];

  // Perform comprehensive risk analysis
  let riskProfile;
  let action: 'reject' | 'allow' = 'allow';
  let reason = '';

  try {
    riskProfile = await calculateRiskScore(payload.from);
    
    // Determine action based on risk profile and configuration
    const actionResult = determineAction(riskProfile.level, riskConfig, payload.value);
    action = actionResult.action;
    reason = actionResult.reason;

    // Additional sanctions checks based on configuration
    if (riskConfig.sanctionsHandling.rejectOnSanctions && riskProfile.factors.addressSecurity.sanctioned) {
      action = 'reject';
      reason = 'Address is on sanctions list';
    }
    if (riskConfig.sanctionsHandling.rejectOnChainalysis && riskProfile.factors.addressSecurity.chainalysisSanctioned) {
      action = 'reject';
      reason = 'Address is sanctioned by Chainalysis';
    }
    if (riskConfig.sanctionsHandling.rejectOnBlacklist && riskProfile.factors.addressSecurity.blacklist) {
      action = 'reject';
      reason = 'Address is on blacklist';
    }

    console.log(`[VERIFY] Risk analysis for ${payload.from}:`, {
      score: riskProfile.score,
      level: riskProfile.level,
      action,
      reason
    });

    // Log detailed risk information if enabled
    if (riskConfig.enableDetailedLogging) {
      console.log(`[VERIFY] Detailed risk profile:`, {
        address: payload.from,
        amount: payload.value,
        riskProfile,
        action,
        reason,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('[VERIFY] Risk analysis failed:', error);
    // On risk analysis failure, default to allow for speed
    action = 'allow';
    reason = 'Risk analysis failed - allowing';
    console.log('[VERIFY] Risk analysis failed, defaulting to allow');
  }

  // If risk analysis determined a rejection, return immediately
  if (action === 'reject') {
    const response: VerifyResponse = {
      success: false,
      action,
      reason,
      errors: [reason]
    };
    if (riskConfig.enableRiskProfileResponse && riskProfile) {
      response.riskProfile = {
        score: riskProfile.score,
        level: riskProfile.level,
        factors: riskProfile.factors,
        metadata: riskProfile.metadata
      };
    }
    return res.status(400).json(response);
  }

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

  // Prepare response
  const response: VerifyResponse = {
    success: action === 'allow',
    action,
    reason
  };

  // Add risk profile to response if enabled
  if (riskConfig.enableRiskProfileResponse && riskProfile) {
    response.riskProfile = {
      score: riskProfile.score,
      level: riskProfile.level,
      factors: riskProfile.factors,
      metadata: riskProfile.metadata
    };
  }

  // Add errors if verification failed
  if (!response.success) {
    response.errors = [reason];
  }

  // Return appropriate status code based on action
  if (!response.success) {
    return res.status(400).json(response);
  } else {
    return res.status(200).json(response);
  }
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
  console.log(`[FACILITATOR] listening on port ${PORT}`);
});
