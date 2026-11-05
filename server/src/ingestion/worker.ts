import { Worker } from "bullmq";
import { queueConnection, IngestionJob } from "./queue";
import { ingestDocument } from "./ingest";

// Run separately from the API:  npm run worker
const worker = new Worker<IngestionJob>(
  "ingestion",
  async (job) => {
    const { documentId, chunkSize, chunkOverlap } = job.data;
    console.log(`[worker] ingesting ${documentId}`);
    await ingestDocument(documentId, chunkSize, chunkOverlap);
    console.log(`[worker] done ${documentId}`);
  },
  { connection: queueConnection, concurrency: 1 } // concurrency 1 keeps RAM low on small PCs
);

worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id} failed: ${err.message}`));
console.log("[worker] waiting for jobs...");
