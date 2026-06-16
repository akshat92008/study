import { routeStreamGeneration } from './lib/ai/router';

async function check() {
  console.log("Starting stream generation with assistant first...");
  try {
    const userPrompt = [
      { role: 'assistant', content: 'Hello! I am an AI.' },
      { role: 'user', content: 'What is 2+2?' }
    ];
    const generator = routeStreamGeneration(
      "You are a helpful AI.",
      userPrompt,
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
