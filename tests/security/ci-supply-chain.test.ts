import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');
const workflow = (name: string) => read(`.github/workflows/${name}`);

describe('container and supply-chain hygiene', () => {
  it('keeps secrets, tests and repository metadata out of the image build context', () => {
    const dockerignore = read('.dockerignore');

    for (const pattern of ['node_modules', '.next', '.git', '.env', '.env.*', 'tests', '.github']) {
      expect(dockerignore).toContain(pattern);
    }
  });

  it('runs the production image as a non-root user with an application healthcheck', () => {
    const dockerfile = read('Dockerfile');
    const runner = dockerfile.slice(dockerfile.indexOf('AS runner'));

    expect(runner).toContain('USER nextjs');
    expect(runner).toContain('/api/health');
    expect(runner).not.toContain('npm ci');
    expect(runner).not.toContain('COPY .env');
    expect(dockerfile).toContain('org.opencontainers.image.source');
  });

  it('does not inherit the app HTTP healthcheck on the worker', () => {
    const compose = read('docker-compose.ghcr.yml');
    const worker = compose.slice(compose.indexOf('  worker:'));

    expect(worker).toContain('healthcheck:');
    expect(worker).toContain('disable: true');
    expect(worker).not.toContain('/api/health');
    expect(compose).toContain('pgdata:/var/lib/postgresql/data');
    expect(compose).toContain('uploads:/app/uploads');
    expect(compose).toContain('127.0.0.1:${APP_PORT:-3000}:3000');
  });

  it('fails builds if Next.js error checking or TLS verification is disabled', () => {
    const nextConfig = read('next.config.ts');

    expect(nextConfig).not.toContain('ignoreBuildErrors');
    expect(nextConfig).not.toContain('ignoreDuringBuilds');
    expect(nextConfig).not.toContain('NODE_TLS_REJECT_UNAUTHORIZED');
  });

  it('gates publishing on the reusable quality workflow and least-privilege permissions', () => {
    const ci = workflow('ci.yml');
    const publish = workflow('publish-image.yml');

    for (const gate of [
      'workflow_call',
      'pull_request',
      'npm run test:e2e',
      'npm audit --audit-level=high',
      'gitleaks/gitleaks-action@v3',
      'prisma migrate status',
      'git diff --check',
    ]) {
      expect(ci).toContain(gate);
    }

    expect(publish).toContain('needs: quality');
    expect(publish).toContain('packages: write');
    expect(publish).toContain('platforms: linux/amd64,linux/arm64');
    expect(publish).toContain('cache-from: type=gha');
    expect(publish).toContain('docker/build-push-action');
    expect(publish).toContain('provenance: true');
    expect(publish).toContain('sbom: true');
    expect(publish).not.toContain('pull_request_target');
    expect(publish).not.toContain('pull_request:');
    expect(publish).not.toContain('write-all');
  });

  it('never promotes latest for a prerelease version tag', () => {
    const publish = workflow('publish-image.yml');

    expect(publish).toContain('if [[ "$version" == *-* ]]');
    expect(publish).toContain('latest=false');
    expect(publish).toContain("if: steps.tags.outputs.latest == 'true'");
  });

  it('does not track environment files or private keys', () => {
    const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
    const sensitive = tracked.filter(
      (path) =>
        /(^|\/)\.env($|\.)/.test(path) ||
        /(^|\/)(\.dev\.vars|id_rsa|id_ed25519|[^/]+\.(pem|p12|pfx|key))$/.test(path)
    );

    expect(sensitive.filter((path) => !/\.env\.(example|sample|template)$/.test(path))).toEqual([]);
  });

  it('uses the patched nodemailer release and has no separate type stubs', () => {
    const pkg = JSON.parse(read('package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(pkg.dependencies.nodemailer).toBe('^10.6.0');
    expect(pkg.devDependencies['@types/nodemailer']).toBeUndefined();
  });
});
