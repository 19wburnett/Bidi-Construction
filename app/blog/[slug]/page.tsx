import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getBlogPost, getBlogPosts } from '@/lib/blog/posts'
import PublicLayout from '@/components/public-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, ArrowLeft, ArrowRight } from 'lucide-react'
import { StructuredData } from '@/components/structured-data'

interface BlogPostPageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateStaticParams() {
  const posts = getBlogPosts()
  return posts.map(post => ({
    slug: post.slug,
  }))
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) {
    return {
      title: 'Post Not Found',
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bidicontracting.com'

  return {
    title: `${post.title} | Bidi Blog`,
    description: post.description,
    keywords: post.seoKeywords || [],
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
      url: `${baseUrl}/blog/${post.slug}`,
      images: post.image ? [post.image] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
    alternates: {
      canonical: `${baseUrl}/blog/${post.slug}`,
    },
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = getBlogPost(slug)
  const allPosts = getBlogPosts()
  const currentIndex = allPosts.findIndex(p => p.slug === slug)
  const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null
  const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null

  if (!post) {
    notFound()
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bidicontracting.com'

  // Convert markdown-like content to HTML (simple implementation)
  const formatContent = (content: string) => {
    return content
      .split('\n')
      .map((line, index) => {
        if (line.startsWith('# ')) {
          return `<h1 class="text-3xl font-bold mt-8 mb-4">${line.substring(2)}</h1>`
        }
        if (line.startsWith('## ')) {
          return `<h2 class="text-2xl font-bold mt-6 mb-3">${line.substring(3)}</h2>`
        }
        if (line.startsWith('### ')) {
          return `<h3 class="text-xl font-bold mt-4 mb-2">${line.substring(4)}</h3>`
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return `<li class="ml-4 mb-1">${line.substring(2)}</li>`
        }
        if (line.trim() === '') {
          return '<br />'
        }
        if (line.includes('[') && line.includes('](')) {
          // Simple link parsing
          const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/)
          if (linkMatch) {
            return `<p class="mb-4"><a href="${linkMatch[2]}" class="text-orange hover:underline">${linkMatch[1]}</a></p>`
          }
        }
        return `<p class="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">${line}</p>`
      })
      .join('')
  }

  return (
    <>
      <StructuredData
        type="Organization"
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          author: {
            '@type': 'Person',
            name: post.author,
            email: post.authorEmail,
          },
          publisher: {
            '@type': 'Organization',
            name: 'Bidi Construction',
            logo: {
              '@type': 'ImageObject',
              url: `${baseUrl}/brand/Bidi%20Contracting%20Logo.svg`,
            },
          },
          datePublished: post.publishedAt,
          dateModified: post.updatedAt || post.publishedAt,
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `${baseUrl}/blog/${post.slug}`,
          },
          keywords: post.tags.join(', '),
        }}
      />
      <PublicLayout>
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          {/* Back Button */}
          <Link href="/blog">
            <Button variant="ghost" className="mb-8">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Blog
            </Button>
          </Link>

          {/* Article Header */}
          <header className="mb-8">
            {post.featured && (
              <Badge className="mb-4 bidi-orange-bg-light bidi-orange-text">
                Featured Post
              </Badge>
            )}
            <h1 className="text-4xl sm:text-5xl font-bold text-black dark:text-white mb-4">
              {post.title}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
              {post.description}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
              {post.readingTime && (
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  {post.readingTime} min read
                </div>
              )}
              <div>
                By <span className="font-semibold">{post.author}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge variant="secondary">{post.category}</Badge>
              {post.tags.map(tag => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </header>

          {/* Article Content */}
          <article
            className="prose prose-lg dark:prose-invert max-w-none mb-12"
            dangerouslySetInnerHTML={{ __html: formatContent(post.content) }}
          />

          {/* Navigation */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-8 mt-12">
            <div className="flex justify-between items-center">
              {prevPost ? (
                <Link href={`/blog/${prevPost.slug}`}>
                  <div className="group">
                    <div className="text-sm text-gray-500 mb-1">Previous Post</div>
                    <div className="flex items-center text-orange group-hover:underline">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      {prevPost.title}
                    </div>
                  </div>
                </Link>
              ) : (
                <div></div>
              )}
              {nextPost && (
                <Link href={`/blog/${nextPost.slug}`}>
                  <div className="group text-right">
                    <div className="text-sm text-gray-500 mb-1">Next Post</div>
                    <div className="flex items-center text-orange group-hover:underline">
                      {nextPost.title}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 p-8 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
            <h3 className="text-2xl font-bold mb-4">Ready to Transform Your Estimating Process?</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              See how Bidi's AI-powered platform can automate your construction estimating and bid management.
            </p>
            <Link href="/estimate">
              <Button variant="orange" size="lg">
                Schedule a Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </PublicLayout>
    </>
  )
}

