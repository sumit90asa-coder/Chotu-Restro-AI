import { NextResponse } from 'next/server';

export async function GET() {
  const commit = process.env.RENDER_GIT_COMMIT || process.env.NEXT_PUBLIC_GIT_COMMIT || 'e71f6bc';
  return NextResponse.json({
    service: 'Chotu Restro AI Frontend',
    version: '1.0.0',
    git_commit: commit.slice(0, 7),
    git_commit_full: commit,
    build_timestamp: process.env.BUILD_TIMESTAMP || '2026-11-26T20:00:00Z',
    environment: process.env.NODE_ENV || 'production',
  });
}
