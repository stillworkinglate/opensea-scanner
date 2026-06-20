export function resolveOpenSeaApiKey(clientKey?: string): string | undefined {
  const envKey = process.env.OPENSEA_API_KEY?.trim();
  const trimmedClientKey = clientKey?.trim();
  return envKey || trimmedClientKey || undefined;
}