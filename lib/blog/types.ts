export interface BlogPost {
  slug: string
  title: string
  description: string
  content: string
  author: string
  authorEmail: string
  publishedAt: string
  updatedAt?: string
  category: string
  tags: string[]
  featured?: boolean
  image?: string
  readingTime?: number
  seoKeywords?: string[]
}

export interface BlogCategory {
  name: string
  slug: string
  description: string
}


