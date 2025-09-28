# Safe Cross X402

## Project Overview

**Safe Cross X402** introduces a significant architectural **enhancement** to existing x402 payment architectures. At its core, this system empowers users to pay for premium HTTP resources using their preferred blockchain, while resource servers seamlessly receive funds faster on their desired chain. As an initial step, payments are efficiently settled between the **Polygon Amoy testnet** and **Base Sepolia testnet**. While our project demonstrates an Agent-to-Agent (A2A) workflow, it is designed to support single or multiple agents and users consuming a Safe Cross X402 enabled server.

## Problems with existing x402 architecture
1. Only supports single chain payments. So both users and servers are forced to use the same chain.
2. Prone to chain reorganizations: In existing x402 implementations, especially those relying on minimal block confirmations (e.g. 0 or 1 block confirmations) also we cant go for very longer confirmations since that can cause HTTP request timeouts. A transaction often malicious, initially appearing settled might be reverted due to a chain reorg, leading to a loss for the resource server.

## Innovations

The central innovation of this architecture is the **Generic Risk-Aware Cross-Chain Facilitator**. 
This Facilitator extends the standard x402 protocol by integrating, 
1. Comprehensive risk assessment (in between the standard HTTP request and response) and allow servers to decide what to allow or block. 
2. Faster cross-chain settlements between users (agents) and servers. where users can pay for services on their preferred chain and servers can receive funds on their desired chain.
3. Relays the payment from client to server which is different from the standard x402 architecture. From this we can have a more flexible and secure payment system.

## Why we dont use bridges?

Delay!
Bridges introduce significant delays, often exceeding the standard HTTP gateway timeout. Such delays can result in HTTP 504 (Gateway Timeout) errors, leading to a poor user experience and failed transactions.

## For risks mitigation aspect, Why not just use blockchains provide AI-driven protection for transaction?

That would be nice but we wanted to build an architecture works for almost all of the evm chains.

# Key improvements and extensions to the x402 architecture

* **Enhanced HTTP Headers**: The introduction of critical headers such as `X-CORRELATION-ID`, `X-USER-CHAIN`, `X-TARGET-CHAIN`, and `X-RESOURCE-SERVER-ADDRESS`. These headers empower agents with more flexibility and enable the Facilitator to make informed decisions regarding cross-chain routing and settlement.
* **Time-Critical Risk-Based Settlement**: The Facilitator incorporates a sophisticated Risk Scoring Engine that assesses transaction risk through multiple aspects (e.g., address security screening, transaction history analysis). This allows resource servers to dynamically decide whether to allow or reject providing services to users based on this comprehensive risk analysis, enhancing security and compliance.
* **Time-Critical Cross-Chain Settlements**: By pre-funding target chains, the Facilitator ensures instant settlement from the resource server's perspective, mitigating HTTP gateway timeouts and enabling a smooth user experience even for complex cross-chain transactions.

## Time-Critical 402 Risk-Based Settlements

A critical aspect of **x402 risk-based settlements** for cross-chain transactions is their time-sensitivity within typical HTTP request-response cycles. Traditional blockchain bridges can introduce significant delays, often exceeding the standard HTTP gateway timeout. Such delays can result in HTTP 504 (Gateway Timeout) errors, leading to a poor user experience and failed transactions.

To mitigate this, the **Facilitator** plays a crucial role. It is designed to operate with pre-funded balances on various target chains. This pre-funding allows for **instant settlement** of payments from the perspective of the resource server, completing the transaction within the tight HTTP response window. The actual cross-chain bridging of funds from the user's preferred chain to the facilitator's pre-funded balance can then occur asynchronously in the background (this is pretty easy to implement and didnt bother on this due to time constraints), decoupled from the immediate HTTP request. This approach ensures a fast, responsive payment experience while maintaining the security and verifiability of blockchain transactions.

## Architecture

![Architecture Diagram](Architecture%20Diagram.png)

The project's architecture (as illustrated in the `Architecture Diagram.png` diagram) is composed of several interacting agents and services, designed to handle the complexities of A2A payments and risk assessment:

### **Key Components and Flow**

1.  **Agent A**: Initiates requests to Agent B. These calls include the standard `X-PAYMENT` header, along with additional headers for enhanced functionality:
    *   `X-CORRELATION-ID`: Inspired from web2 requests correlation. We use it for correlating a request across multiple hops and services.
    *   `X-USER-CHAIN`: Specifies the user's preferred blockchain for payment, enabling cross-chain capabilities.

2.  **Agent B**: Acts as an optional intermediary. It can either forward the payment payload directly to the `x402 enabled server` or process and forward it with modifications. Agent B receives 402/2xx responses from the server, including the `X-PAYMENT-RESPONSE` header.

3.  **x402 Enabled Server (Resource Server)**:
    *   Exposes premium endpoints that require payment.
    *   Responds with HTTP 402 (Payment Required) challenges, providing `PaymentRequirements` if a payment header is missing or invalid.
    *   Sends additional headers to the Facilitator for settlement:
        *   `X-TARGET-CHAIN`: The blockchain on which the resource server wishes to receive funds.
        *   `X-RESOURCE-SERVER-ADDRESS`: The address on the target chain where the funds should be sent.
    *   Configurable to allow or block certain risk types based on server preferences.
    *   Instantly settles payments to the server's target chain, facilitated by the pre-funded balances of the Facilitator.

4.  **Generic Risk-Aware Cross-Chain Facilitator (`apps/facilitator`)**: This is a central component responsible for payment verification, risk analysis, and cross-chain settlement.
    *   **Payment Verification**: Verifies `X-PAYMENT` payloads using EIP-3009 `transferWithAuthorization` signatures with 1 block confirmations.
    *   **Risk Scoring Engine**: Integrates with external services to assess transaction risk:
        *   **Address Security Screening**: Checks for sanctioned addresses using data from Chainalysis sanctioned addresses oracle and GoPlusLabs API.
        *   **Transaction History Analysis**: Evaluates past transaction patterns for anomalies.
    *   **Cross-Chain Settlement**: For cross-chain payments, the Facilitator uses its pre-funded balances on the target chain to instantly settle payments to the `x402 enabled server`. The actual transfer from the user's chain to the facilitator's balance will happen in the background.

### **Core Services**

## Quick Start Guide

### Launch Instructions

1.  **Setup Environment**
    ```bash
    # Create .env files for each service in apps/<service-name> based on env.example
    # WARNING: Never commit real keys to version control
    ```

2.  **Compile Packages**
    ```bash
    # From repository root
    bun install
    bun run build
    ```

3.  **Start All Services**

    ```bash
    # Terminal 1 - Start Facilitator
    cd apps/facilitator
    bun start

    # Terminal 2 - Start Resource Server
    cd apps/resource-server
    bun start

    # Terminal 3 - Start Service Agent
    cd apps/service-agent
    bun start

    # Terminal 4 - Start Client Agent
    cd apps/client-agent
    bun start

    # Terminal 5 - Start Dash app
    cd apps/dash
    bun start
    ```