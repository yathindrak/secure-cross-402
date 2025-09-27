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

export interface RiskConfig {
  // Risk level thresholds
  criticalThreshold: number; // 0-30
  highThreshold: number;     // 30-60
  mediumThreshold: number;   // 60-80
  
  // Action configurations
  actions: {
    onCritical: 'reject';
    onHigh: 'reject' | 'allow';
    onMedium: 'allow';
    onLow: 'allow';
  };
  
  // Sanctions handling
  sanctionsHandling: {
    rejectOnSanctions: boolean;
    rejectOnChainalysis: boolean;
    rejectOnBlacklist: boolean;
  };
  
  // High-value transaction handling
  highValueThreshold: string; // in wei
  highValueActions: {
    requireKyc: boolean;
    requireAdditionalVerification: boolean;
    enhancedMonitoring: boolean;
  };
  
  // Monitoring and logging
  enableDetailedLogging: boolean;
  enableRiskProfileResponse: boolean;
}

export interface VerifyResponse {
  success: boolean;
  errors?: string[];
  riskProfile?: {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    factors: any;
    metadata: any;
  };
  action?: 'reject' | 'allow';
  reason?: string;
}
