export const MEDIA_DELETE_BATCH_SIZE = 200;

export function splitIntoBatches(items, batchSize = MEDIA_DELETE_BATCH_SIZE) {
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error("Batch size must be a positive integer");
  const batches = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
}

export async function readApiJson(response, fallbackMessage) {
  const text = await response.text();
  let body = {};

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      const status = response.status ? ` (${response.status})` : "";
      throw new Error(`${fallbackMessage}. The server returned an unexpected response${status}. Please try again.`);
    }
  }

  if (!response.ok) throw new Error(body.error || `${fallbackMessage} (${response.status})`);
  return body;
}
