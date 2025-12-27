import PublicLayout from '@/components/public-layout'

export default function PublicPagesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PublicLayout>{children}</PublicLayout>
}

