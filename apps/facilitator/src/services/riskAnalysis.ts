import { ethers } from 'ethers';
import { createPublicClient, http, Address } from 'viem';
import { mainnet } from 'viem/chains';
import { getEnv } from '../env';

const { CHAINALYSIS_ORACLE_CONTRACT_ADDRESS } = getEnv();

const chainalysisScreenerAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "addr",
        "type": "address"
      }
    ],
    "name": "isSanctioned",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export interface AddressSecurityInsights {
  cyberCrime: boolean;
  moneyLaundering: boolean;
  financialCrime: boolean;
  darkwebTransactions: boolean;
  phishingActivities: boolean;
  fakeKyc: boolean;
  blacklist: boolean;
  stealingAttack: boolean;
  blackmailActivities: boolean;
  sanctioned: boolean;
  maliciousMiningActivities: boolean;
  honeypot: boolean;
  chainalysisSanctioned: boolean;
  sanctionsScore: number; // 0-100, where 0 is highest risk
}

export interface RiskScore {
  score: number; // 0-100, where 100 is highest risk, 0 is lowest risk
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: {
    // Address Security Factors (0-100)
    addressSecurity: {
      overall: number;
      cyberCrime: number;
      moneyLaundering: number;
      financialCrime: number;
      darkwebTransactions: number;
      phishingActivities: number;
      fakeKyc: number;
      blacklist: number;
      stealingAttack: number;
      blackmailActivities: number;
      sanctioned: number;
      maliciousMiningActivities: number;
      honeypot: number;
      chainalysisSanctioned: number;
      sanctionsScore: number;
    };
    // Transaction History Factors (0-100)
    transactionHistory: {
      overall: number;
      hasSufficientHistory: boolean;
      transactionCount: number;
      activityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    };
    // KYC & Identity Factors (0-100)
    kycStatus: boolean;
  };
  metadata: {
    analysisTimestamp: string;
    dataSources: string[];
    confidence: number; // 0-100, how confident we are in the analysis
    lastUpdated: string;
  };
}

export interface KycStatus {
  isKycVerified: boolean;
}

export async function isSanctionedByChainalysis(address: string): Promise<boolean> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(),
    });

    const isSanctioned = await client.readContract({
      address: CHAINALYSIS_ORACLE_CONTRACT_ADDRESS as Address,
      abi: chainalysisScreenerAbi,
      functionName: "isSanctioned",
      args: [address as Address],
    });

    return isSanctioned as boolean;
  } catch (error) {
    console.error('[RISK-ANALYSIS] Error checking Chainalysis sanctions:', error);
    // Return false on error to avoid blocking legitimate transactions
    return false;
  }
}

/**
 * Get comprehensive security overview for an address using GoPlus Labs API
 */
export const getAddressSecurityOverview = async (address: string): Promise<AddressSecurityInsights> => {
  try {
    // Get GoPlus Labs data
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/address_security/${address}`,
    );
    const { code, result } = await res.json();
    
    // Get Chainalysis sanctions data
    const chainalysisSanctioned = await isSanctionedByChainalysis(address);
    
    if (code !== 1 || !result) {
      return {
        cyberCrime: false,
        moneyLaundering: false,
        financialCrime: false,
        darkwebTransactions: false,
        phishingActivities: false,
        fakeKyc: false,
        blacklist: false,
        stealingAttack: false,
        blackmailActivities: false,
        sanctioned: false,
        maliciousMiningActivities: false,
        honeypot: false,
        chainalysisSanctioned,
        sanctionsScore: chainalysisSanctioned ? 0 : 100,
      };
    }

    const goPlusSanctioned = !!Number(result.sanctioned);
    const isSanctioned = goPlusSanctioned || chainalysisSanctioned;
    
    // Calculate sanctions score (0 = lowest risk, 100 = highest risk)
    let sanctionsScore = 0;
    if (isSanctioned) sanctionsScore = 100; // Highest risk if sanctioned
    else if (goPlusSanctioned || chainalysisSanctioned) sanctionsScore = 50; // Medium risk if partial sanction detected

    const insights = {
      cyberCrime: !!Number(result.cybercrime),
      moneyLaundering: !!Number(result.money_laundering),
      financialCrime: !!Number(result.financial_crime),
      darkwebTransactions: !!Number(result.darkweb_transactions),
      phishingActivities: !!Number(result.phishing_activities),
      fakeKyc: !!Number(result.fake_kyc),
      blacklist: !!Number(result.blacklist_doubt),
      stealingAttack: !!Number(result.stealing_attack),
      blackmailActivities: !!Number(result.blackmail_activities),
      sanctioned: isSanctioned,
      maliciousMiningActivities: !!Number(result.malicious_mining_activities),
      honeypot: !!Number(result.honeypot_related_address),
      chainalysisSanctioned,
      sanctionsScore,
    };

    return insights;
  } catch (error) {
    console.error('[RISK-ANALYSIS] Error fetching address security overview:', error);
    // Return safe defaults on error
    return {
      cyberCrime: false,
      moneyLaundering: false,
      financialCrime: false,
      darkwebTransactions: false,
      phishingActivities: false,
      fakeKyc: false,
      blacklist: false,
      stealingAttack: false,
      blackmailActivities: false,
      sanctioned: false,
      maliciousMiningActivities: false,
      honeypot: false,
      chainalysisSanctioned: false,
      sanctionsScore: 100,
    };
  }
};

/**
 * Analyze transaction history for an address with detailed metrics
 */
export async function analyzeTransactionHistory(
  address: string
): Promise<{
  hasSufficientHistory: boolean;
  transactionCount: number;
  activityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  overallScore: number;
}> {
  try {
    const rpcUrl = 'https://ethereum-rpc.publicnode.com';

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const txCount = await provider.getTransactionCount(address);
    
    // Determine activity level
    let activityLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (txCount > 50) activityLevel = 'HIGH';
    else if (txCount > 10) activityLevel = 'MEDIUM';
    
    // Calculate overall score (0-100, where 100 is highest risk)
    let overallScore = 0;
    if (txCount <= 5) overallScore += 40; // High risk for insufficient history
    if (activityLevel === 'LOW') overallScore += 20; // High risk for low activity
    else if (activityLevel === 'MEDIUM') overallScore += 10; // Medium risk for medium activity
    
    return {
      hasSufficientHistory: txCount > 5,
      transactionCount: txCount,
      activityLevel,
      overallScore: Math.min(overallScore, 100)
    };
  } catch (error) {
    console.error(`[RISK-ANALYSIS] Error analyzing transaction history for ${address}:`, error);
    return {
      hasSufficientHistory: false,
      transactionCount: 0,
      activityLevel: 'LOW',
      overallScore: 0
    };
  }
}

/**
 * Placeholder for KYC verification via smart contract
 * This will be implemented later when KYC contracts are deployed
 */
export async function getKycStatusPlaceholder(address: string): Promise<KycStatus> {
  // TODO: Implement KYC verification via smart contract
  // For now, return placeholder status with granular factors
  return {
    isKycVerified: false,
  };
}

/**
 * Calculate comprehensive risk score based on multiple factors
 */
export async function calculateRiskScore(
  address: string
): Promise<RiskScore> {
  console.log(`[RISK-ANALYSIS] Calculating risk score for ${address}`);

  // Get address security insights
  const securityInsights = await getAddressSecurityOverview(address);
  
  // Analyze transaction history with detailed metrics
  const transactionAnalysis = await analyzeTransactionHistory(address);
  
  // Check KYC status
  const kycStatus = await getKycStatusPlaceholder(address);
  
  // Calculate individual factor scores (0-100, where 100 is best)
  const addressSecurityFactors = calculateAddressSecurityFactors(securityInsights);
  const kycRiskScore = kycStatus.isKycVerified ? 0 : 70; // 0 risk if verified, 70 if not verified

  // Weighted average of all factors
  const weights = {
    kycStatus: 0.40,        // Increased weight to 40%
    addressSecurity: 0.35,  // 35% weight - most important
    transactionHistory: 0.25, // 25% weight
  };

  const overallScore = Math.round(
    (addressSecurityFactors.overall * weights.addressSecurity) +
    (transactionAnalysis.overallScore * weights.transactionHistory) +
    (kycRiskScore * weights.kycStatus)
  );

  // Determine risk level (100 is highest risk, 0 is lowest risk)
  let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (overallScore >= 80) level = 'CRITICAL';
  else if (overallScore >= 60) level = 'HIGH';
  else if (overallScore >= 30) level = 'MEDIUM';
  else level = 'LOW';

  // Calculate confidence based on data availability
  const confidence = calculateConfidence(securityInsights, transactionAnalysis, kycStatus);

  const result: RiskScore = {
    score: overallScore,
    level,
    factors: {
      addressSecurity: addressSecurityFactors,
      transactionHistory: {
        overall: transactionAnalysis.overallScore,
        hasSufficientHistory: transactionAnalysis.hasSufficientHistory,
        transactionCount: transactionAnalysis.transactionCount,
        activityLevel: transactionAnalysis.activityLevel
      },
      kycStatus: kycStatus.isKycVerified,
    },
    metadata: {
      analysisTimestamp: new Date().toISOString(),
      dataSources: ['gopluslabs', 'alchemy', 'ethereum_rpc'],
      confidence,
      lastUpdated: new Date().toISOString()
    }
  };
  
  return result;
}

/**
 * Calculate detailed address security factors
 */
function calculateAddressSecurityFactors(insights: AddressSecurityInsights): {
  overall: number;
  cyberCrime: number;
  moneyLaundering: number;
  financialCrime: number;
  darkwebTransactions: number;
  phishingActivities: number;
  fakeKyc: number;
  blacklist: number;
  stealingAttack: number;
  blackmailActivities: number;
  sanctioned: number;
  maliciousMiningActivities: number;
  honeypot: number;
  chainalysisSanctioned: number;
  sanctionsScore: number;
} {
  // Convert boolean flags to scores (100 = risk present, 0 = no risk)
  const cyberCrime = insights.cyberCrime ? 100 : 0;
  const moneyLaundering = insights.moneyLaundering ? 100 : 0;
  const financialCrime = insights.financialCrime ? 100 : 0;
  const darkwebTransactions = insights.darkwebTransactions ? 100 : 0;
  const phishingActivities = insights.phishingActivities ? 100 : 0;
  const fakeKyc = insights.fakeKyc ? 100 : 0;
  const blacklist = insights.blacklist ? 100 : 0;
  const stealingAttack = insights.stealingAttack ? 100 : 0;
  const blackmailActivities = insights.blackmailActivities ? 100 : 0;
  const sanctioned = insights.sanctioned ? 100 : 0;
  const maliciousMiningActivities = insights.maliciousMiningActivities ? 100 : 0;
  const honeypot = insights.honeypot ? 100 : 0;
  const chainalysisSanctioned = insights.chainalysisSanctioned ? 100 : 0;
  const sanctionsScore = insights.sanctionsScore;

  // Calculate overall score with weighted importance
  const weights = {
    sanctioned: 0.20,      // Most critical
    chainalysisSanctioned: 0.15, // Very critical
    sanctionsScore: 0.10,  // Sanctions score weight
    blacklist: 0.15,       // Very critical
    cyberCrime: 0.12,      // High importance
    moneyLaundering: 0.12, // High importance
    financialCrime: 0.08,  // Medium importance
    stealingAttack: 0.04,  // Medium importance
    phishingActivities: 0.02, // Lower importance
    darkwebTransactions: 0.01, // Lower importance
    blackmailActivities: 0.01, // Lower importance
    maliciousMiningActivities: 0.00, // Lower importance
    fakeKyc: 0.00,         // Lower importance
    honeypot: 0.00         // Lowest importance
  };

  const overall = Math.round(
    (sanctioned * weights.sanctioned) +
    (chainalysisSanctioned * weights.chainalysisSanctioned) +
    (sanctionsScore * weights.sanctionsScore) +
    (blacklist * weights.blacklist) +
    (cyberCrime * weights.cyberCrime) +
    (moneyLaundering * weights.moneyLaundering) +
    (financialCrime * weights.financialCrime) +
    (stealingAttack * weights.stealingAttack) +
    (phishingActivities * weights.phishingActivities) +
    (darkwebTransactions * weights.darkwebTransactions) +
    (blackmailActivities * weights.blackmailActivities) +
    (maliciousMiningActivities * weights.maliciousMiningActivities) +
    (fakeKyc * weights.fakeKyc) +
    (honeypot * weights.honeypot)
  );

  return {
    overall,
    cyberCrime,
    moneyLaundering,
    financialCrime,
    darkwebTransactions,
    phishingActivities,
    fakeKyc,
    blacklist,
    stealingAttack,
    blackmailActivities,
    sanctioned,
    maliciousMiningActivities,
    honeypot,
    chainalysisSanctioned,
    sanctionsScore
  };
}

/**
 * Calculate confidence in the risk analysis
 */
function calculateConfidence(
  securityInsights: AddressSecurityInsights,
  transactionAnalysis: any,
  kycStatus: KycStatus
): number {
  let confidence = 0;
  
  // Data availability factors (more data = higher confidence = lower risk contribution)
  if (securityInsights) confidence += 30; 
  if (kycStatus.isKycVerified) confidence += 25;
  if (transactionAnalysis.transactionCount > 0) confidence += 20;
  
  return Math.max(0, 100 - confidence); // Invert confidence to align with risk score (higher confidence = lower risk contribution)
}

