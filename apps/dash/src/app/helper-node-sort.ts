import { Edge, isEdge, isNode, Node } from "@xyflow/react";
import { orderBy } from "lodash";

// ソースノードとランクを決定するヘルパー関数
export const determineSourceAndRank = (
    selectedNodes: Node[],
    direction: "parallel" | "series",
    nodes: Node[],
    edges: Edge[]
): { sourceNodeId: string, newRank: number } => {
    // 単一ノード選択の場合
    if (selectedNodes.length === 1) {
        const selectedNodeId = selectedNodes[0].id;
        const selectedNodeRank = selectedNodes[0].data?.rank as number;

        if (direction === "series") {
            // 直列追加（子ノードとして追加）
            const sourceNodeId = selectedNodeId;
            const sameParentNodes = nodes.filter(node => node.data?.parent === sourceNodeId);
            const maxRank = sameParentNodes.length === 0 ? 0 :
                Math.max(...sameParentNodes.map(node => node.data?.rank as number));
            return { sourceNodeId, newRank: maxRank + 1 };
        } else {
            // 並列追加（兄弟ノードとして追加）
            const edge = edges.find(edge => edge.target === selectedNodeId);
            const sourceNodeId = edge?.source ?? selectedNodeId;
            return { sourceNodeId, newRank: selectedNodeRank ? selectedNodeRank + 0.5 : 1 };
        }
    }
    // 複数選択またはノード未選択の場合
    const sourceNodeId = nodes[0].id;
    const sameParentNodes = nodes.filter(node => node.data?.parent === "root");
    const maxRank = sameParentNodes.length === 0 ? 0 :
        Math.max(...sameParentNodes.map(node => node.data?.rank as number));
    return { sourceNodeId, newRank: maxRank + 1 };
};

// ノードのランクを再計算するヘルパー関数
export const recalculateRanks = (nodes: Node[]): Node[] => {
    return nodes.map(node => {
        const sameParentNodes = nodes.filter(n => n.data?.parent === node.data?.parent);
        const sortedSameParentNodes = sameParentNodes.sort((a, b) => {
            const rankA = a.data?.rank as number || 0;
            const rankB = b.data?.rank as number || 0;
            return rankA === rankB ? a.id.localeCompare(b.id) : rankA - rankB;
        });
        return { ...node, data: { ...node.data, rank: sortedSameParentNodes.indexOf(node) } };
    });
};

// 階層構造を再帰的に処理するユーティリティ関数
export const traverseHierarchy = <T>(
    nodes: Node[],
    parentId: string | null,
    processor: (nodes: Node[], parentId: string | null) => T[]
): T[] => {
    const childNodes = nodes.filter(node => node.data?.parent === parentId);
    const currentLevel = processor(childNodes, parentId);
    const childResults = childNodes.flatMap(node =>
        traverseHierarchy(nodes, node.id, processor)
    );
    return [...currentLevel, ...childResults];
};

// ノードをランク順にソートする関数
export const sortNodesByRank = (nodes: Node[]): Node[] => {
    return orderBy(nodes, [(node: Node) => node.data?.rank || 0], ['asc']);
};

// 親子関係に基づいてエッジを生成する関数
export const createHierarchyEdges = (nodes: Node[], parentId: string | null): Edge[] => {
    if (parentId === null) return [];
    return nodes.map(node => ({
        id: `${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: 'default',
    }));
};

// ノードとエッジの階層構造を準備する関数
export const prepareHierarchicalElements = (nodes: Node[]): { sortedNodes: Node[]; hierarchyEdges: Edge[] } => {
    const rootNode = nodes.find(node => node.id === "root");
    if (!rootNode) return { sortedNodes: [], hierarchyEdges: [] };

    const nodeResults = traverseHierarchy(nodes, "root", sortNodesByRank);
    const sortedNodes = [rootNode, ...nodeResults.filter(isNode)];
    const edgeResults = traverseHierarchy(sortedNodes, 'root', createHierarchyEdges);
    const hierarchyEdges = edgeResults.filter(isEdge);

    return { sortedNodes, hierarchyEdges };
};
