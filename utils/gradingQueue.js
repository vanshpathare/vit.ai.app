/**
 * Dynamic Lightweight In-Memory Task Queue
 * Throttles concurrent execution to respect external API rate restrictions (15 RPM)
 */
class GradingQueue {
  constructor(maxConcurrency = 2) {
    this.queue = [];
    this.activeCount = 0;
    this.maxConcurrency = maxConcurrency; // Processes 2 requests at a time to prevent bursting past 15 RPM
  }

  /**
   * Pushes a grading task into the FIFO queue matrix
   * @param {Function} taskFunction - An isolated async function wrapping the AI call
   * @returns {Promise<any>} The resolved result from the async task
   */
  enqueue(taskFunction) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFunction, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    this.activeCount++;
    const { taskFunction, resolve, reject } = this.queue.shift();

    try {
      // Execute the task with a built-in automatic retry engine
      const result = await this.executeWithRetry(taskFunction);
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeCount--;
      // Trigger a tiny 1-second pacing delay before pulling the next item to space out traffic
      setTimeout(() => this.processNext(), 1000);
    }
  }

  /**
   * Resilient execution engine utilizing Exponential Backoff to counter 429 anomalies
   */
  async executeWithRetry(taskFunction, retries = 3, delay = 2000) {
    try {
      return await taskFunction();
    } catch (error) {
      // If we encounter a Rate Limit (429) or Server error, check if we have retry fuel left
      if (
        retries > 0 &&
        (error.message.includes("429") ||
          error.message.includes("Too Many Requests"))
      ) {
        console.warn(
          `⚠️ API rate limit encountered. Retrying task in ${delay}ms... (${retries} attempts left)`,
        );
        await new Promise((res) => setTimeout(res, delay));
        return this.executeWithRetry(taskFunction, retries - 1, delay * 2); // Double the delay duration
      }
      throw error; // Propagate the fault if retries are depleted or it's a different runtime error
    }
  }
}

// Export a single global instance so all incoming student requests share the exact same queue manager
export const gradingQueue = new GradingQueue();
