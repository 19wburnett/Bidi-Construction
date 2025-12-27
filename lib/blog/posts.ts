import { BlogPost } from './types'

// Blog posts data - In production, this could come from a CMS, database, or markdown files
export const blogPosts: BlogPost[] = [
  // Example blog post - you can add more posts here
  {
    slug: 'how-ai-is-transforming-construction-estimating',
    title: 'How AI is Transforming Construction Estimating in 2025',
    description: 'Discover how artificial intelligence is revolutionizing the construction industry by automating takeoffs, reducing errors, and saving contractors valuable time.',
    content: `
# How AI is Transforming Construction Estimating in 2025

The construction industry has traditionally been slow to adopt new technologies, but artificial intelligence is changing that narrative. In 2025, AI-powered estimating tools are becoming essential for General Contractors who want to stay competitive.

## The Problem with Traditional Estimating

Manual construction estimating is time-consuming and error-prone. Contractors spend hours:
- Reviewing plans line by line
- Calculating material quantities
- Identifying missing specifications
- Coordinating with subcontractors

## How AI Solves These Challenges

Modern AI estimating platforms like Bidi use advanced computer vision and machine learning to:

1. **Automate Plan Analysis** - Instantly extract materials, dimensions, and specifications from PDF plans
2. **Detect Missing Information** - Identify gaps in plans before they become costly change orders
3. **Generate Accurate Estimates** - Calculate material and labor costs with industry-standard pricing
4. **Streamline Bid Collection** - Automatically reach out to subcontractors and manage communications

## Real-World Impact

Contractors using AI estimating tools report:
- 80% reduction in estimating time
- 95% reduction in calculation errors
- Faster bid turnaround times
- More competitive pricing

## The Future of Construction Estimating

As AI technology continues to evolve, we can expect even more sophisticated features:
- Real-time material cost updates
- Predictive analytics for project risks
- Integration with BIM models
- Automated code compliance checking

## Conclusion

AI is no longer a nice-to-have in construction estimating—it's becoming a necessity. Contractors who embrace these technologies now will have a significant competitive advantage in the years ahead.

Ready to see how AI can transform your estimating process? [Schedule a demo](/estimate) with Bidi today.
    `,
    author: 'Bidi Team',
    authorEmail: 'weston@bidicontracting.com',
    publishedAt: '2025-01-15',
    category: 'Technology',
    tags: ['AI', 'Construction Technology', 'Estimating', 'Automation'],
    featured: true,
    readingTime: 5,
    seoKeywords: ['AI construction estimating', 'construction AI', 'automated estimating', 'construction technology'],
  },
  // Add more blog posts here as you create them
]

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find(post => post.slug === slug)
}

export function getBlogPosts(filters?: {
  category?: string
  featured?: boolean
  limit?: number
}): BlogPost[] {
  let posts = [...blogPosts]

  if (filters?.category) {
    posts = posts.filter(post => post.category === filters.category)
  }

  if (filters?.featured) {
    posts = posts.filter(post => post.featured)
  }

  // Sort by published date (newest first)
  posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  if (filters?.limit) {
    posts = posts.slice(0, filters.limit)
  }

  return posts
}

export function getBlogCategories(): string[] {
  return Array.from(new Set(blogPosts.map(post => post.category)))
}

