# Sandbox Configuration

The animation plugin runs user-generated code inside isolated Docker containers (sandboxes). Each sandbox gets its own resource limits, network, and port allocation.

## Resource Limits

Configure via environment variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_MEMORY` | `1g` | Memory limit per container |
| `SANDBOX_MEMORY_SWAP` | Same as `SANDBOX_MEMORY` | Swap limit. Set higher than memory to allow swap usage |
| `SANDBOX_CPUS` | `2` | CPU cores per container |

### Examples

```env
# Minimal (low-end machines)
SANDBOX_MEMORY=512m
SANDBOX_CPUS=1

# Default
SANDBOX_MEMORY=1g
SANDBOX_CPUS=2

# Heavy workloads (3D scenes, particles, complex renders)
SANDBOX_MEMORY=4g
SANDBOX_CPUS=4

# Maximum (dedicated render machine)
SANDBOX_MEMORY=8g
SANDBOX_CPUS=8
```

### Memory + Swap

By default, swap equals the memory limit (no swap). To allow swap:

```env
SANDBOX_MEMORY=2g
SANDBOX_MEMORY_SWAP=4g  # 2g RAM + 2g swap
```

Setting swap to `-1` allows unlimited swap (not recommended).

## Docker Images

Override the default images if you build custom ones:

| Variable | Default |
|----------|---------|
| `SANDBOX_IMAGE_THEATRE` | `koda/animation-sandbox` |
| `SANDBOX_IMAGE_REMOTION` | `koda/remotion-sandbox` |

## Other Settings

These are hardcoded in `src/lib/sandbox/docker-provider.ts` and can be changed there:

| Setting | Value | Description |
|---------|-------|-------------|
| Port range | `15173–15272` | Host ports for sandbox dev servers (max 100 concurrent) |
| Idle timeout | 30 minutes | Sandboxes auto-destroy after inactivity |
| Cleanup interval | 5 minutes | How often idle sandboxes are checked |
| Command timeout | 30 seconds | Default timeout for commands |
| Max timeout | 5 minutes | Maximum allowed timeout |

## Recommended Settings by Use Case

| Use Case | Memory | CPUs | Notes |
|----------|--------|------|-------|
| Simple 2D animations | `512m` | `1` | Text, shapes, basic motion |
| Standard Remotion renders | `1g` | `2` | Most animations work fine here |
| 3D scenes (Three.js) | `4g` | `4` | Three.js + Remotion needs headroom |
| Particle systems / data-viz | `2g` | `2` | D3 + canvas-heavy work |
| Video rendering (final output) | `4g–8g` | `4` | Chromium rendering is memory-hungry |

## Troubleshooting

### Container killed unexpectedly
Your container is likely running out of memory. Increase `SANDBOX_MEMORY`:
```env
SANDBOX_MEMORY=4g
```

### Render hangs or is very slow
Increase CPU allocation:
```env
SANDBOX_CPUS=4
```

### Check container resource usage
```bash
# See live stats for all sandboxes
docker stats --filter "name=koda-sandbox-"

# Check if a container was OOM-killed
docker inspect <container-id> --format '{{.State.OOMKilled}}'
```
