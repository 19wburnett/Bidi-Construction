import { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PublicLayout from '@/components/public-layout'
import { getBlogPosts, getBlogCategories } from '@/lib/blog/posts'
import { Calendar, Clock, ArrowRight } from 'lucide-react'
import { StructuredData } from '@/components/structured-data'

export const metadata: Metadata = {
  title: 'Blog - Construction Estimating & Bid Management Insights',
  description: 'Expert insights on construction estimating, AI technology, bid management, and construction industry trends. Learn how to streamline your construction business.',
  keywords: [
    'construction blog',
    'construction estimating tips',
    'construction industry news',
    'bid management',
    'construction technology',
    'AI construction',
    'construction best practices',
  ],
  openGraph: {
    title: 'BIDI Blog - Construction Estimating & Bid Management Insights',
    description: 'Expert insights on construction estimating, AI technology, and bid management.',
    type: 'website',
  },
}

export default function BlogPage() {
  const posts = getBlogPosts()
  const categories = getBlogCategories()

  return (
    <>
      <StructuredData
        type="WebSite"
        data={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'BIDI Construction Blog',
          description: 'Expert insights on construction estimating, AI technology, and bid management.',
          url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://bidicontracting.com'}/blog`,
        }}
      />
      <PublicLayout>
        <div className="container mx-auto px-4 py-16">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-black dark:text-white mb-4">
              <span className="font-bidi">BIDI</span> <span className="font-bidi bidi-orange-text">Blog</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Expert insights on construction estimating, AI technology, and bid management
            </p>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-12">
              <Link href="/blog">
                <Badge variant="default" className="cursor-pointer">
                  All Posts
                </Badge>
              </Link>
              {categories.map(category => (
                <Link key={category} href={`/blog?category=${encodeURIComponent(category)}`}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950">
                    {category}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Blog Posts Grid */}
          {posts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map(post => (
                <Link key={post.slug} href={`/blog/${post.slug}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow duration-300 cursor-pointer group">
                    <CardHeader>
                      {post.featured && (
                        <Badge className="mb-2 w-fit bidi-orange-bg-light bidi-orange-text">
                          Featured
                        </Badge>
                      )}
                      <CardTitle className="group-hover:text-orange transition-colors">
                        {post.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {post.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {new Date(post.publishedAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                          {post.readingTime && (
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {post.readingTime} min read
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <Badge variant="secondary">{post.category}</Badge>
                        {post.tags.slice(0, 2).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center text-orange group-hover:underline">
                        Read more
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-600 dark:text-gray-300 text-lg">
                No blog posts yet. Check back soon for construction industry insights!
              </p>
            </div>
          )}
        </div>
      </PublicLayout>
    </>
  )
}

