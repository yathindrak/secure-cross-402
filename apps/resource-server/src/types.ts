export interface PaymentRequirements {
  scheme: string;
  network: string;
  resource: string;
  description?: string;
  mimeType?: string;
  payTo: string;
  maxAmountRequired: string;
  maxTimeoutSeconds?: number;
  asset?: string;
  extra?: Record<string, any>;
  outputSchema?: Record<string, any>;
}
