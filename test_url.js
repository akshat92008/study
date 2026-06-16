try {
  new URL("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...");
  console.log("Valid");
} catch (e) {
  console.log("Invalid:", e.message);
}
