const BASE_URL = "http://localhost:3000";

const TOTAL_REQUESTS = 200;
const CONCURRENCY = 50;

async function sendRequest(index) {
  const payload = {
    transaction_id: `txn_load_${Date.now()}_${index}`,
    source_account: "ACC_1001",
    destination_account: "ACC_2001",
    amount: 1500.5,
    currency: "INR",
  };

  const start = performance.now();

  try {
    const response = await fetch(`${BASE_URL}/v1/webhooks/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return {
      status: response.status,
      duration: performance.now() - start,
    };
  } catch (error) {
    return {
      status: "ERROR",
      error: error.message,
      duration: performance.now() - start,
    };
  }
}

async function runTest() {
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < TOTAL_REQUESTS) {
      const index = nextIndex++;
      results.push(await sendRequest(index));
    }
  }

  const start = performance.now();

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const totalTime = performance.now() - start;

  const successful = results.filter((r) => r.status === 202).length;
  const failed = results.length - successful;

  const durations = results.map((r) => r.duration).sort((a, b) => a - b);

  console.log("\n===== LOAD TEST RESULTS =====");
  console.log("Total requests:", results.length);
  console.log("Successful (202):", successful);
  console.log("Failed:", failed);
  console.log("Total duration:", totalTime.toFixed(2), "ms");
  console.log(
    "Requests/sec:",
    (results.length / (totalTime / 1000)).toFixed(2),
  );
  console.log(
    "Average latency:",
    (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2),
    "ms",
  );
  console.log(
    "P95 latency:",
    durations[Math.ceil(durations.length * 0.95) - 1].toFixed(2),
    "ms",
  );

  if (failed > 0) {
    console.log("\nFailed responses:");
    console.log(results.filter((r) => r.status !== 202).slice(0, 10));
  }
}

runTest();
