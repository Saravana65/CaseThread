/**
 * @file nativeGraphService.js
 * @brief Dispatches cross-case graph payloads to the native C DSA algorithm engine.
 * Executes BFS, DFS, Connected Components, and Shortest Path traversals in compiled C (O(V+E)),
 * capturing microsecond-level traces, predecessor trees, and partition components.
 * @project CASETHREAD
 */

const cEngineService = require('../../../services/cEngineService');

class NativeGraphService {
  /**
   * Run BFS traversal on the cross-case graph starting from a specified node.
   * @param {object} cPayload - Native C graph payload from CrossCaseGraphBuilder
   * @param {number} startNodeId - Root node index
   * @returns {Promise<object>} Trace steps, queue events, and execution latency
   */
  static async runBfs(cPayload, startNodeId = 0) {
    const payload = JSON.parse(JSON.stringify(cPayload));
    payload.lab_query = {
      algorithm: 'BFS',
      mode: 'REAL',
      start_node_id: parseInt(startNodeId, 10) || 0,
      target_node_id: 0
    };

    const res = await cEngineService.runAnalysis(payload);
    return {
      algorithm: 'BFS',
      start_node_id: startNodeId,
      lab_result: res.lab_result,
      metrics: res.metrics,
      execution_latency_ms: res.execution_latency_ms
    };
  }

  /**
   * Run DFS branch exploration on the cross-case graph.
   * @param {object} cPayload
   * @param {number} startNodeId
   * @returns {Promise<object>}
   */
  static async runDfs(cPayload, startNodeId = 0) {
    const payload = JSON.parse(JSON.stringify(cPayload));
    payload.lab_query = {
      algorithm: 'DFS',
      mode: 'REAL',
      start_node_id: parseInt(startNodeId, 10) || 0,
      target_node_id: 0
    };

    const res = await cEngineService.runAnalysis(payload);
    return {
      algorithm: 'DFS',
      start_node_id: startNodeId,
      lab_result: res.lab_result,
      metrics: res.metrics,
      execution_latency_ms: res.execution_latency_ms
    };
  }

  /**
   * Compute unweighted shortest path connecting two historical cases or attributes via native C BFS.
   * @param {object} cPayload
   * @param {number} sourceNodeId
   * @param {number} targetNodeId
   * @returns {Promise<object>} Found status, hop count, path array, and predecessor trace
   */
  static async runShortestPath(cPayload, sourceNodeId, targetNodeId) {
    const payload = JSON.parse(JSON.stringify(cPayload));
    payload.lab_query = {
      algorithm: 'SHORTEST_PATH',
      mode: 'REAL',
      start_node_id: parseInt(sourceNodeId, 10) || 0,
      target_node_id: parseInt(targetNodeId, 10) || 1
    };

    const res = await cEngineService.runAnalysis(payload);
    return {
      algorithm: 'SHORTEST_PATH',
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      lab_result: res.lab_result,
      metrics: res.metrics,
      execution_latency_ms: res.execution_latency_ms
    };
  }

  /**
   * Partition cross-case graph into connected components and identify isolated nodes.
   * @param {object} cPayload
   * @returns {Promise<object>} Connected components count, isolated nodes count, partition map
   */
  static async runConnectedComponents(cPayload) {
    const payload = JSON.parse(JSON.stringify(cPayload));
    payload.lab_query = {
      algorithm: 'CONNECTED_COMPONENTS',
      mode: 'REAL',
      start_node_id: 0,
      target_node_id: 0
    };

    const res = await cEngineService.runAnalysis(payload);
    return {
      algorithm: 'CONNECTED_COMPONENTS',
      connected_components: res.metrics?.connected_components || 1,
      isolated_nodes_count: res.metrics?.isolated_nodes_count || 0,
      lab_result: res.lab_result,
      metrics: res.metrics,
      graph_nodes: res.graph_nodes,
      execution_latency_ms: res.execution_latency_ms
    };
  }
}

module.exports = NativeGraphService;
