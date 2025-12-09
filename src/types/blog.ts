
export interface PostMetadata {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  categories: string[];
  summary: string;
  prev?: string; // slug of previous post
  next?: string; // slug of next post
}

export type PostManifest = PostMetadata[];
