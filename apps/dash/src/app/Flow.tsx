"use client";

import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  MiniMap,
  Controls,
  Node,
  Edge,
  Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import CustomNode from './CustomNode';
import { getLayoutedElements } from './helper-dagre-layout';

interface PaymentLog {
  id: number;
  correlationId: string;
  clientAgentUrl?: string;
  resourceServerUrl?: string;
  serviceAgentUrl?: string;
  facilitatorUrl?: string;
  paymentStatus: string;
  riskLevel?: string;
  riskRationale?: string;
  paymentPayload?: string;
  settlementTxHash?: string;
  verificationTxHash?: string;
  verificationTxUrl?: string;
  settlementTxUrl?: string;
  userChain?: string;
  serverChain?: string;
  timestamp: string;
}

const nodeTypes = {
  custom: CustomNode,
};

const Flow = () => {
  const [paymentLogs, setPaymentLogs] = useState<PaymentLog[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<any>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<any>>([]);

  useEffect(() => {
    const fetchPaymentLogs = async () => {
      const res = await fetch('/api/paymentlogs');
      const data: PaymentLog[] = await res.json();
      console.log("Fetched payment logs:", data);
      setPaymentLogs(data);
    };

    fetchPaymentLogs();
  }, []);

  useEffect(() => {
    if (paymentLogs.length > 0) {
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];
      
      // Group payment logs by correlationId and sort them by timestamp
      const groupedLogs = paymentLogs.reduce((acc, log) => {
        if (!acc[log.correlationId]) {
          acc[log.correlationId] = [];
        }
        acc[log.correlationId].push(log);
        return acc;
      }, {} as Record<string, PaymentLog[]>);

      Object.entries(groupedLogs).forEach(([correlationId, logs]) => {
        // Sort logs for this correlationId by timestamp to ensure proper flow
        logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        let previousNodeId: string | null = null;

        logs.forEach((log) => {
          // Create a node for the payment log entry
          const logNodeId = `log-${log.id}`;
          newNodes.push({
            id: logNodeId,
            type: 'custom',
            position: { x: 0, y: 0 },
            data: {
              name: log.paymentStatus,
              job: `Timestamp: ${new Date(log.timestamp).toLocaleString()}`,
              emoji: '📝',
              logDetails: log,
              isMainLogNode: true,
            },
          });

          if (previousNodeId) {
            newEdges.push({
              id: `e-${previousNodeId}-${logNodeId}`,
              source: previousNodeId,
              target: logNodeId,
              type: 'default',
            });
          }
          previousNodeId = logNodeId;

          // Add nodes for verification transaction if available
          if (log.verificationTxHash) {
            const verificationNodeId = `verification-${log.id}`;
            newNodes.push({
              id: verificationNodeId,
              type: 'custom',
              position: { x: 0, y: 0 },
              data: {
                name: 'Verification',
                job: `Tx: ${log.verificationTxHash.substring(0, 10)}...`,
                emoji: '🔍',
                logDetails: {
                  verificationTxHash: log.verificationTxHash,
                  verificationTxUrl: log.verificationTxUrl,
                  userChain: log.userChain,
                },
                isVerificationNode: true,
              },
            });
            newEdges.push({
              id: `e-${logNodeId}-${verificationNodeId}`,
              source: logNodeId,
              target: verificationNodeId,
              type: 'default',
            });
            previousNodeId = verificationNodeId;
          }

          // Add nodes for settlement transaction if available
          if (log.settlementTxHash) {
            const settlementNodeId = `settlement-${log.id}`;
            newNodes.push({
              id: settlementNodeId,
              type: 'custom',
              position: { x: 0, y: 0 },
              data: {
                name: 'Settlement',
                job: `Tx: ${log.settlementTxHash.substring(0, 10)}...`,
                emoji: '💰',
                logDetails: {
                  settlementTxHash: log.settlementTxHash,
                  settlementTxUrl: log.settlementTxUrl,
                  serverChain: log.serverChain,
                },
                isSettlementNode: true,
              },
            });
            // Connect from verification if it exists, otherwise from the log node
            const sourceIdForSettlement = log.verificationTxHash ? `verification-${log.id}` : logNodeId;
            newEdges.push({
              id: `e-${sourceIdForSettlement}-${settlementNodeId}`,
              source: sourceIdForSettlement,
              target: settlementNodeId,
              type: 'default',
            });
            previousNodeId = settlementNodeId;
          }
        });
      });

      const layouted = getLayoutedElements(newNodes, newEdges, 'TB', (id: string) => newNodes.find(node => node.id === id) as Node<any> | undefined);

      console.log("Layouted nodes:", layouted.nodes);
      console.log("Layouted edges:", layouted.edges);

      setNodes(layouted.nodes);
      setEdges(layouted.edges);
    }
  }, [paymentLogs]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [],
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-teal-50"
      >
        <MiniMap />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default Flow;
