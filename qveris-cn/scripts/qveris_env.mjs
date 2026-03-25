export function readQverisApiKey() {
  const apiKey = process.env.QVERIS_API_KEY;
  if (!apiKey) {
    console.error("Error: QVERIS_API_KEY environment variable not set");
    console.error("Get your API key at https://qveris.cn");
    process.exit(1);
  }
  return apiKey;
}
