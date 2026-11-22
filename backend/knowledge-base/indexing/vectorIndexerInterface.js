/**
 * @file vectorIndexerInterface.js
 * @brief Semantic vector embedding interface and contract specification for future AI retrieval.
 * Provides the architectural boundary for dense vector indexing without violating offline constraints.
 * @project CASETHREAD
 */

class VectorIndexerInterface {
  /**
   * Generates a normalized vector embedding for an input text.
   * @param {string} text
   * @returns {Promise<Array<number>>}
   */
  async generateEmbedding(text) {
    throw new Error('generateEmbedding() must be implemented by an authorized vector embedding provider.');
  }

  /**
   * Stores a vector embedding for a specific chunk ID.
   * @param {number} chunkId
   * @param {Array<number>} vector
   * @returns {Promise<boolean>}
   */
  async storeVector(chunkId, vector) {
    throw new Error('storeVector() must be implemented by a vector storage engine.');
  }

  /**
   * Computes cosine similarity between two numeric vectors.
   * cosine_similarity = (A . B) / (||A|| * ||B||)
   * @param {Array<number>} vecA
   * @param {Array<number>} vecB
   * @returns {number}
   */
  static cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Performs semantic nearest-neighbor search across stored vectors.
   * @param {Array<number>} queryVector
   * @param {number} topK
   * @returns {Promise<Array<{ chunkId: number, score: number }>>}
   */
  async searchVector(queryVector, topK = 5) {
    throw new Error('searchVector() must be implemented by a vector storage engine.');
  }
}

module.exports = VectorIndexerInterface;
