import { ethers } from 'ethers';
import { PaymentPayload } from '../types';
import { getRpcUrlForChain, getTokenAddressForChain } from '../utils/helpers';
import { getEnv } from '../env';

const { FACILITATOR_PRIVATE_KEY } = getEnv();
const PRIVATE_KEY = FACILITATOR_PRIVATE_KEY;

export async function verifyPaymentOnChain(userChain: string, payload: PaymentPayload): Promise<boolean> {
  console.log(`[VERIFY-PAYMENT] Verifying payment on ${userChain} for ${payload.from} → ${payload.to}, amount: ${payload.value}`);

  try {
    const rpcUrl = getRpcUrlForChain(userChain);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const tokenAddress = getTokenAddressForChain(userChain);

    const tokenAbi = [
      'function transferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce,bytes signature)'
    ];

    const token = new ethers.Contract(tokenAddress, tokenAbi, wallet);

    // Execute the transferWithAuthorization with user's signed payload
    console.log(`[VERIFY-PAYMENT] Executing transferWithAuthorization on ${userChain}`);
    const tx = await token.transferWithAuthorization(
      payload.from,
      payload.to,
      payload.value,
      payload.validAfter,
      payload.validBefore,
      payload.nonce,
      payload.signature
    );

    console.log(`[VERIFY-PAYMENT] transferWithAuthorization transaction submitted: ${tx.hash}`);
    const receipt = await tx.wait(1); // Wait for 1 confirmation
    // TODO: maybe we can have a risk scoring system and wait for more or break (before this whole func?)
    console.log(`[VERIFY-PAYMENT] transferWithAuthorization transaction confirmed: ${tx.hash}`);

    // if the transaction succeeded, the payment is verified
    // which means the user's sig was valid and the transfer was executed
    const paymentReceived = receipt.status === 1;

    console.log(`[VERIFY-PAYMENT] Payment verification: ${paymentReceived ? 'SUCCESS' : 'FAILED'}`);
    console.log(`[VERIFY-PAYMENT] Transaction status: ${receipt.status}`);

    return paymentReceived;
  } catch (error) {
    console.error(`[VERIFY-PAYMENT] Error verifying payment on ${userChain}:`, error);
    return false;
  }
}

export async function settleWithPreFundedBalance(targetChain: string, payload: PaymentPayload, resourceServerAddress?: string): Promise<{ success: boolean; error?: string }> {
  console.log(`[SETTLE-PRE-FUNDED] Settling on ${targetChain} with pre-funded balance for ${payload.value}`);

  try {
    // setup facilitator wallet on resource server chain
    const rpcUrl = getRpcUrlForChain(targetChain);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const tokenAddress = getTokenAddressForChain(targetChain);

    const tokenAbi = [
      'function balanceOf(address account) view returns (uint256)',
      'function transfer(address to, uint256 amount) returns (bool)'
    ];

    const token = new ethers.Contract(tokenAddress, tokenAbi, wallet);
    const balance = await token.balanceOf(wallet.address);

    console.log(`[SETTLE-PRE-FUNDED] Pre-funded balance on ${targetChain}: ${balance.toString()}, required: ${payload.value}`);

    if (balance < BigInt(payload.value)) {
      return { success: false, error: 'insufficient_pre_funded_balance' };
    }

    // We pay the resource server address, not the facilitator (payload.to is facilitator's address)
    if (!resourceServerAddress) {
      return { success: false, error: 'resource_server_address_required' };
    }
    console.log(`[SETTLE-PRE-FUNDED] Paying resource server: ${resourceServerAddress}`);

    const tx = await token.transfer(resourceServerAddress, payload.value);
    console.log(`[SETTLE-PRE-FUNDED] Settlement transaction submitted: ${tx.hash}`);
    await tx.wait();
    console.log(`[SETTLE-PRE-FUNDED] Settlement transaction confirmed: ${tx.hash}`);

    return { success: true };
  } catch (error) {
    console.error(`[SETTLE-PRE-FUNDED] Error settling on ${targetChain}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
