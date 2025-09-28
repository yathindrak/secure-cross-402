import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface CustomNodeData {
  name: string;
  job: string;
  emoji: string;
  logDetails?: any; // To pass the entire log object for detailed display
  isMainLogNode?: boolean;
  isVerificationNode?: boolean;
  isSettlementNode?: boolean;
}

function CustomNode({ data }: { data: CustomNodeData }) {
  const { logDetails, isMainLogNode, isVerificationNode, isSettlementNode } = data;

  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-white border-2 border-stone-400 max-w-sm">
      <div className="flex items-center">
        <div className="rounded-full w-10 h-10 flex justify-center items-center bg-gray-100 flex-shrink-0">
          {data.emoji}
        </div>
        <div className="ml-2 flex-grow">
          <div className="text-sm font-bold text-gray-800 break-words">{data.name}</div>
          <div className="text-xs text-gray-600 break-words">{data.job}</div>
        </div>
      </div>

      {logDetails && (
        <div className="mt-2 text-xs text-gray-700 space-y-1">
          {isMainLogNode && (logDetails.clientAgentUrl || logDetails.resourceServerUrl || logDetails.facilitatorUrl || logDetails.serviceAgentUrl) && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="font-bold mb-1">Agent Details:</p>
              {logDetails.clientAgentUrl && (
                <p><strong>Client Agent:</strong> <a href={logDetails.clientAgentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{logDetails.clientAgentUrl.split(':').slice(0, 2).join(':')}...</a></p>
              )}
              {logDetails.resourceServerUrl && (
                <p><strong>Resource Server:</strong> <a href={logDetails.resourceServerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{logDetails.resourceServerUrl.split(':').slice(0, 2).join(':')}...</a></p>
              )}
              {logDetails.facilitatorUrl && (
                <p><strong>Facilitator:</strong> <a href={logDetails.facilitatorUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{logDetails.facilitatorUrl.split(':').slice(0, 2).join(':')}...</a></p>
              )}
              {logDetails.serviceAgentUrl && (
                <p><strong>Service Agent:</strong> <a href={logDetails.serviceAgentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{logDetails.serviceAgentUrl.split(':').slice(0, 2).join(':')}...</a></p>
              )}
            </div>
          )}

          {isMainLogNode && ((logDetails.paymentStatus && data.name !== logDetails.paymentStatus) || logDetails.riskLevel || logDetails.riskRationale) ? (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="font-bold mb-1">Status & Risk:</p>
              {logDetails.paymentStatus && data.name !== logDetails.paymentStatus && (
                <p><strong>Status:</strong> {logDetails.paymentStatus}</p>
              )}
              {logDetails.riskLevel && (
                <p><strong>Risk Level:</strong> {logDetails.riskLevel}</p>
              )}
              {logDetails.riskRationale && (
                <p><strong>Risk Rationale:</strong> {logDetails.riskRationale}</p>
              )}
            </div>
          ) : null}

          {(isVerificationNode || isSettlementNode) && (logDetails.userChain || logDetails.serverChain) ? (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="font-bold mb-1">Chain Information:</p>
              {isVerificationNode && logDetails.userChain && (
                <p><strong>User Chain:</strong> {logDetails.userChain}</p>
              )}
              {isSettlementNode && logDetails.serverChain && (
                <p><strong>Server Chain:</strong> {logDetails.serverChain}</p>
              )}
            </div>
          ) : null}

          {(isVerificationNode && logDetails.verificationTxHash) || (isSettlementNode && logDetails.settlementTxHash) ? (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="font-bold mb-1">Transaction Details:</p>
              {isVerificationNode && logDetails.verificationTxHash && (
                <p><strong>Verification Tx:</strong> <a href={logDetails.verificationTxUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{logDetails.verificationTxHash.substring(0, 10)}...</a></p>
              )}
              {isSettlementNode && logDetails.settlementTxHash && (
                <p><strong>Settlement Tx:</strong> <a href={logDetails.settlementTxUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{logDetails.settlementTxHash.substring(0, 10)}...</a></p>
              )}
            </div>
          ) : null}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="w-16 !bg-teal-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-16 !bg-teal-500"
      />
    </div>
  );
}

export default memo(CustomNode);
