const firstWords = [
  "Quiet",
  "North",
  "Drift",
  "Warm",
  "Open",
  "Hidden",
  "Kind",
  "Soft",
  "Velvet",
  "Signal",
];

const secondWords = [
  "Harbor",
  "Meadow",
  "Lantern",
  "Echo",
  "Maple",
  "Current",
  "Ridge",
  "Pulse",
  "Cedar",
  "Comet",
];

export function generateAnonymousHandle() {
  const adjective = firstWords[Math.floor(Math.random() * firstWords.length)];
  const noun = secondWords[Math.floor(Math.random() * secondWords.length)];
  const suffix = Math.floor(100 + Math.random() * 900);

  return `${adjective}${noun}${suffix}`;
}
