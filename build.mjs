import { buildStandalone } from './scripts/build-artifacts.mjs';
try {
  const {output,html}=await buildStandalone();
  console.log(`Standalone output: ${output} (${Buffer.byteLength(html)} bytes)`);
} catch(error) { console.error(error);process.exitCode=1; }
