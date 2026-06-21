export interface Ech0File {
  id: string;
  file: {
    id: string;
    url: string;
  };
}

export interface Ech0Tag {
  id: string;
  name: string;
}

export interface Ech0Item {
  id: string;
  content: string;
  echo_files: Ech0File[];
  tags: Ech0Tag[];
  created_at: number;
  fav_count: number;
  username?: string;
  extension?: {
    type: string;
    payload: Record<string, string>;
  };
}

export interface Ech0QueryResult {
  total: number;
  items: Ech0Item[];
}

export interface Ech0Comment {
  id: string;
  echo_id: string;
  nickname: string;
  content: string;
  created_at: number;
}

export async function fetchEchos(
  serverUrl: string,
  params: { page: number; pageSize: number }
): Promise<Ech0QueryResult> {
  const url = `${serverUrl.replace(/\/$/, '')}/api/echo/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      page: params.page,
      pageSize: params.pageSize,
      sortOrder: 'desc',
    }),
  });

  if (!res.ok) {
    throw new Error(`Ech0 API error: ${res.status}`);
  }

  const json = await res.json();
  const data = json.data;
  return {
    total: data.total ?? 0,
    items: data.items ?? [],
  };
}

export async function fetchEch0Comments(serverUrl: string, echoId: string): Promise<Ech0Comment[]> {
  const baseUrl = serverUrl.replace(/\/$/, '');
  const url = `${baseUrl}/api/comments?echo_id=${encodeURIComponent(echoId)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Ech0 comments API error: ${res.status}`);
  }

  const json = await res.json();
  return Array.isArray(json?.data) ? (json.data as Ech0Comment[]) : [];
}

export interface GitHubRepoData {
  name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  owner: { avatar_url: string };
}

const ghCache = new Map<string, GitHubRepoData | null>();

export async function fetchGitHubRepo(repoUrl: string): Promise<GitHubRepoData | null> {
  const parts = repoUrl.replace(/\/$/, '').split('/').filter(Boolean);
  const owner = parts[parts.length - 2];
  const repo = parts[parts.length - 1];
  if (!owner || !repo) return null;

  const key = `${owner}/${repo}`;
  if (ghCache.has(key)) return ghCache.get(key)!;

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!res.ok) { ghCache.set(key, null); return null; }
    const data = await res.json() as GitHubRepoData;
    ghCache.set(key, data);
    return data;
  } catch {
    ghCache.set(key, null);
    return null;
  }
}
