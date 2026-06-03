import { routeStreamGeneration } from './lib/ai/router';

async function check() {
  console.log("Starting stream generation...");
  try {
    const generator = routeStreamGeneration(
      "You are a helpful AI.",
      "Say hello world.",
      0.7,
      undefined,
      'fast',
      true
    );
    for await (const chunk of generator) {
      process.stdout.write(chunk);
    }
    console.log("\nDone.");
  } catch (err) {
    console.error("\nError:", err);
  }
}
check().catch(console.error);
