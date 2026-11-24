import type { CleanedSalesRow } from '../types/sales';

export type SankeyFlowMode = 'region-brand' | 'region-channel-brand';

export type SankeyNodeCategory = 'region' | 'channel' | 'brand';

export interface SalesSankeyNode {
  name: string;
  category: SankeyNodeCategory;
  totalIdr: number;
}

export interface SalesSankeyLink {
  source: number;
  target: number;
  value: number;
  sourceName: string;
  targetName: string;
}

export interface SalesSankeyResult {
  nodes: SalesSankeyNode[];
  links: SalesSankeyLink[];
  omittedNegativeCount: number;
  totalFlowIdr: number;
}

export function buildSalesSankeyData(
  rows: CleanedSalesRow[],
  mode: SankeyFlowMode = 'region-brand'
): SalesSankeyResult {
  if (rows.length === 0) {
    return {
      nodes: [],
      links: [],
      omittedNegativeCount: 0,
      totalFlowIdr: 0,
    };
  }

  // Aggregate directed edges: (sourceKey -> targetKey)
  const edgeTotals = new Map<
    string,
    {
      sourceKey: string;
      sourceName: string;
      sourceCategory: SankeyNodeCategory;
      targetKey: string;
      targetName: string;
      targetCategory: SankeyNodeCategory;
      value: number;
    }
  >();

  const addEdge = (
    sourceCategory: SankeyNodeCategory,
    sourceName: string,
    targetCategory: SankeyNodeCategory,
    targetName: string,
    amount: number
  ) => {
    const sourceKey = `${sourceCategory}:${sourceName}`;
    const targetKey = `${targetCategory}:${targetName}`;
    const edgeKey = `${sourceKey}=>${targetKey}`;
    const existing = edgeTotals.get(edgeKey);
    if (existing) {
      existing.value += amount;
    } else {
      edgeTotals.set(edgeKey, {
        sourceKey,
        sourceName,
        sourceCategory,
        targetKey,
        targetName,
        targetCategory,
        value: amount,
      });
    }
  };

  for (const row of rows) {
    const region = row.region || 'Tidak Diketahui';
    const channel = row.outlet_type || 'Lainnya';
    const brand = row.brand || 'Lainnya';

    if (mode === 'region-brand') {
      addEdge('region', region, 'brand', brand, row.net_sales_idr);
    } else {
      addEdge('region', region, 'channel', channel, row.net_sales_idr);
      addEdge('channel', channel, 'brand', brand, row.net_sales_idr);
    }
  }

  let omittedNegativeCount = 0;
  const positiveEdges = Array.from(edgeTotals.values()).filter((e) => {
    if (e.value <= 0) {
      omittedNegativeCount += 1;
      return false;
    }
    return true;
  });

  if (positiveEdges.length === 0) {
    return {
      nodes: [],
      links: [],
      omittedNegativeCount,
      totalFlowIdr: 0,
    };
  }

  // Compute node totals from positive edges so nodes stay balanced and sorted
  const nodeTotals = new Map<
    string,
    { name: string; category: SankeyNodeCategory; inSum: number; outSum: number }
  >();

  const ensureNode = (key: string, name: string, category: SankeyNodeCategory) => {
    let node = nodeTotals.get(key);
    if (!node) {
      node = { name, category, inSum: 0, outSum: 0 };
      nodeTotals.set(key, node);
    }
    return node;
  };

  for (const edge of positiveEdges) {
    const s = ensureNode(edge.sourceKey, edge.sourceName, edge.sourceCategory);
    const t = ensureNode(edge.targetKey, edge.targetName, edge.targetCategory);
    s.outSum += edge.value;
    t.inSum += edge.value;
  }

  const categoryOrder: Record<SankeyNodeCategory, number> = {
    region: 0,
    channel: 1,
    brand: 2,
  };

  const sortedNodeEntries = Array.from(nodeTotals.entries()).sort(([, a], [, b]) => {
    if (categoryOrder[a.category] !== categoryOrder[b.category]) {
      return categoryOrder[a.category] - categoryOrder[b.category];
    }
    const totalA = Math.max(a.inSum, a.outSum);
    const totalB = Math.max(b.inSum, b.outSum);
    return totalB - totalA;
  });

  const nodeIndexByKey = new Map<string, number>();
  const nodes: SalesSankeyNode[] = sortedNodeEntries.map(([key, info], idx) => {
    nodeIndexByKey.set(key, idx);
    return {
      name: info.name,
      category: info.category,
      totalIdr: Math.max(info.inSum, info.outSum),
    };
  });

  const links: SalesSankeyLink[] = positiveEdges
    .map((e) => ({
      source: nodeIndexByKey.get(e.sourceKey) ?? 0,
      target: nodeIndexByKey.get(e.targetKey) ?? 0,
      value: Math.round(e.value),
      sourceName: e.sourceName,
      targetName: e.targetName,
    }))
    .sort((a, b) => b.value - a.value);

  // Total flow represented from leftmost stage (regions)
  const totalFlowIdr = nodes
    .filter((n) => n.category === 'region')
    .reduce((acc, n) => acc + n.totalIdr, 0);

  return {
    nodes,
    links,
    omittedNegativeCount,
    totalFlowIdr,
  };
}
