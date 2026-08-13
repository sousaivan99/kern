const timeZones = ["UTC", "America/New_York", "Europe/Luxembourg"] as const

for (const timeZone of timeZones) {
  console.log(`Testing date behavior with TZ=${timeZone}`)
  const result = Bun.spawnSync([process.execPath, "test", "tests/date.test.ts"], {
    cwd: `${import.meta.dir}/..`,
    env: { ...process.env, TZ: timeZone },
    stderr: "inherit",
    stdout: "inherit",
  })
  if (result.exitCode !== 0) process.exit(result.exitCode)
}
