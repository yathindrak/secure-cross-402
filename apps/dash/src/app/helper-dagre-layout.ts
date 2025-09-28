import {
    type Node,
    type Edge,
} from '@xyflow/react';
import dagre from 'dagre';

export const getLayoutedElements = (
    nodes: Node[],
    edges: Edge[],
    direction = 'LR',
    getNodeData: (id: string) => Node | undefined,
): { nodes: Node[]; edges: Edge[] } => {
    // Removed prepareHierarchicalElements call as it expects a single "root" node
    const sortedNodes = nodes; // Directly use input nodes
    const hierarchyEdges = edges; // Directly use input edges

    if (sortedNodes.length === 0) {
        return { nodes: [], edges: [] };
    }

    const isHorizontal = direction === 'LR';
    const dagreGraph = initializeDagreGraph(direction);

    addNodesToDagreGraph(dagreGraph, sortedNodes, getNodeData);
    addEdgesToDagreGraph(dagreGraph, hierarchyEdges);

    dagre.layout(dagreGraph);

    const positionedNodes = createPositionedNodes(sortedNodes, dagreGraph, isHorizontal);

    return { nodes: positionedNodes, edges: hierarchyEdges };
};

const initializeDagreGraph = (direction = 'LR'): dagre.graphlib.Graph => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction });
    return dagreGraph;
};

const addNodesToDagreGraph = (
    graph: dagre.graphlib.Graph,
    nodes: Node[],
    getNodeData: (id: string) => Node | undefined
): void => {
    nodes.forEach((node) => {
        const nodeData = getNodeData(node.id);
        const width = (nodeData?.measured?.width || 172) + 20; 
        const height = (nodeData?.measured?.height || 36) + 10;

        graph.setNode(node.id, {
            width: width,
            height: height,
        });
    });
};

const addEdgesToDagreGraph = (
    graph: dagre.graphlib.Graph,
    edges: Edge[]
): void => {
    edges.forEach((edge) => {
        graph.setEdge(edge.source, edge.target);
    });
};

const createPositionedNodes = (
    nodes: Node[],
    graph: dagre.graphlib.Graph,
    isHorizontal: boolean
): Node[] => {
    return nodes.map((node) => {
        const nodeWithPosition = graph.node(node.id);
        return {
            ...node,
            targetPosition: isHorizontal ? 'left' : 'top',
            sourcePosition: isHorizontal ? 'right' : 'bottom',
            position: {
                x: nodeWithPosition.x,
                y: nodeWithPosition.y,
            },
        } as Node;
    });
};
